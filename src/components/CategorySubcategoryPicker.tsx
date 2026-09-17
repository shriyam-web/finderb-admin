"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  inferCategoryLevel,
  joinBusinessCategories,
  matchCategoriesFromLabel,
  resolveCategoryLabel,
  splitBusinessCategories,
  type CategoryRef,
} from "../lib/categoryLabel";

function hasSymbol(url?: string | null) {
  return Boolean(url && url !== "Not Set");
}

function SymbolThumb({
  symbol,
  name,
  size = "md",
}: {
  symbol?: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const text = size === "sm" ? "text-[9px]" : "text-[11px]";
  return (
    <div
      className={`${dim} rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 text-teal-700 font-semibold ${text}`}
    >
      {hasSymbol(symbol) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={symbol!}
          alt=""
          className="max-w-[75%] max-h-[75%] object-contain"
        />
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
}

function PickerOption({
  cat,
  selected,
  onSelect,
}: {
  cat: CategoryRef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${
        selected ? "bg-teal-50" : "hover:bg-slate-50"
      }`}
    >
      <SymbolThumb symbol={cat.symbol} name={cat.name} size="sm" />
      <span
        className={`text-xs flex-1 truncate ${selected ? "font-semibold text-teal-900" : "font-medium text-slate-800"}`}
      >
        {cat.name}
      </span>
      {selected && (
        <svg
          className="w-3.5 h-3.5 text-teal-600 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

function DropdownSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: CategoryRef | null;
  placeholder: string;
  options: CategoryRef[];
  onChange: (cat: CategoryRef | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="space-y-1 relative">
      <label className="text-xs text-slate-500">{label}</label>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {value ? (
          <>
            <SymbolThumb symbol={value.symbol} name={value.name} size="sm" />
            <span className="text-xs font-medium text-slate-900 truncate flex-1">
              {value.name}
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-400 flex-1">{placeholder}</span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full px-2.5 py-2 text-left text-[11px] text-slate-400 hover:bg-slate-50 border-b border-slate-100"
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <PickerOption
              key={opt.id}
              cat={opt}
              selected={value?.id === opt.id}
              onSelect={() => {
                onChange(opt);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategorySubcategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: CategoryRef[];
  value: string;
  onChange: (label: string) => void;
}) {
  const selectedLabels = useMemo(
    () => splitBusinessCategories(value),
    [value],
  );

  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const [leafId, setLeafId] = useState("");

  const roots = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const children = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === parentId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, parentId],
  );

  const leaves = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === childId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, childId],
  );

  const selectedRoot = roots.find((p) => p.id === parentId) || null;
  const selectedChild = children.find((c) => c.id === childId) || null;
  const selectedLeaf = leaves.find((c) => c.id === leafId) || null;
  const rootIsGroup = selectedRoot
    ? inferCategoryLevel(selectedRoot, categories) === 0
    : false;

  const draftLabel = useMemo(() => {
    if (!selectedRoot) return "";
    if (inferCategoryLevel(selectedRoot, categories) === 0) {
      if (!selectedChild) return "";
      return resolveCategoryLabel(selectedChild.name, selectedLeaf?.name);
    }
    return resolveCategoryLabel(selectedRoot.name, selectedChild?.name);
  }, [categories, selectedChild, selectedLeaf, selectedRoot]);

  const canAdd =
    Boolean(draftLabel) &&
    !selectedLabels.some(
      (label) => label.toLowerCase() === draftLabel.toLowerCase(),
    );

  // Selection is "complete" when there are no further child levels to pick.
  const draftComplete = Boolean(
    draftLabel &&
      ((rootIsGroup && selectedChild && (leaves.length === 0 || selectedLeaf)) ||
        (!rootIsGroup &&
          selectedRoot &&
          (children.length === 0 || selectedChild) &&
          (leaves.length === 0 || selectedLeaf || !childId))),
  );

  useEffect(() => {
    if (!draftComplete || !canAdd || !draftLabel) return;
    // Auto-set the first mapping so existing single-category flows stay one-tap.
    if (selectedLabels.length === 0) {
      onChange(draftLabel);
      setParentId("");
      setChildId("");
      setLeafId("");
    }
  }, [canAdd, draftComplete, draftLabel, onChange, selectedLabels.length]);

  const addDraft = () => {
    if (!canAdd || !draftLabel) return;
    onChange(joinBusinessCategories([...selectedLabels, draftLabel]));
    setParentId("");
    setChildId("");
    setLeafId("");
  };

  const removeLabel = (label: string) => {
    onChange(
      joinBusinessCategories(
        selectedLabels.filter(
          (item) => item.toLowerCase() !== label.toLowerCase(),
        ),
      ),
    );
  };

  return (
    <div className="px-3 py-2 space-y-2.5">
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 max-w-full rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-medium text-teal-900"
            >
              <span className="truncate">{label}</span>
              <button
                type="button"
                onClick={() => removeLabel(label)}
                className="shrink-0 text-teal-700/70 hover:text-teal-900"
                aria-label={`Remove ${label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <DropdownSelect
        label={
          rootIsGroup ||
          roots.some((r) => inferCategoryLevel(r, categories) === 0)
            ? "Parent category"
            : "Category"
        }
        value={selectedRoot}
        placeholder="Select category"
        options={roots}
        onChange={(parent) => {
          setParentId(parent?.id || "");
          setChildId("");
          setLeafId("");
        }}
      />
      {parentId && children.length > 0 && (
        <DropdownSelect
          label={rootIsGroup ? "Category" : "Subcategory"}
          value={selectedChild}
          placeholder={rootIsGroup ? "Select category" : "Select subcategory"}
          options={children}
          onChange={(child) => {
            setChildId(child?.id || "");
            setLeafId("");
          }}
        />
      )}
      {childId && leaves.length > 0 && (
        <DropdownSelect
          label="Subcategory"
          value={selectedLeaf}
          placeholder="Select subcategory"
          options={leaves}
          onChange={(leaf) => {
            setLeafId(leaf?.id || "");
          }}
        />
      )}

      {draftLabel ? (
        <div className="flex items-center gap-2 pt-0.5">
          <SymbolThumb
            symbol={
              selectedLeaf?.symbol ||
              selectedChild?.symbol ||
              selectedRoot?.symbol
            }
            name={
              selectedLeaf?.name ||
              selectedChild?.name ||
              selectedRoot?.name ||
              ""
            }
            size="sm"
          />
          <p className="text-[10px] text-slate-500 truncate flex-1">
            {selectedLabels.length ? "Add as" : "Saves as"}{" "}
            <span className="font-medium text-slate-700">{draftLabel}</span>
          </p>
          <button
            type="button"
            disabled={!canAdd}
            onClick={addDraft}
            className="shrink-0 rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            {selectedLabels.length ? "Add" : "Set"}
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-slate-400">
          Pick a category (and subcategory if needed), then add it. You can map
          multiple categories.
        </p>
      )}
    </div>
  );
}

export function CategoryLabelDisplay({
  label,
  categories,
}: {
  label: string;
  categories: CategoryRef[];
}) {
  const labels = useMemo(() => splitBusinessCategories(label), [label]);

  if (!labels.length) return <RowFallback value="—" />;

  return (
    <div className="flex items-start justify-between gap-4 px-3 py-1.5">
      <span className="text-xs text-slate-500 shrink-0 pt-0.5">Categories</span>
      <div className="flex flex-col items-end gap-1 min-w-0">
        {labels.map((entry) => {
          const { parent, child } = matchCategoriesFromLabel(entry, categories);
          const display = parent
            ? resolveCategoryLabel(parent.name, child?.name)
            : entry;
          return (
            <div
              key={entry}
              className="flex items-center gap-2 min-w-0 justify-end"
            >
              <SymbolThumb
                symbol={child?.symbol || parent?.symbol}
                name={child?.name || parent?.name || entry}
                size="sm"
              />
              <span className="text-xs font-medium text-slate-900 truncate text-right">
                {display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowFallback({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5">
      <span className="text-xs text-slate-500 shrink-0">Category</span>
      <span className="text-xs font-medium text-slate-900 text-right">
        {value}
      </span>
    </div>
  );
}
