"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { uploadToCloudinary } from "../utils/cloudinary";
import {
  countPartnersForCategory,
  inferCategoryLevel,
  type CategoryRef,
} from "../lib/categoryLabel";

export type AdminCategory = {
  id: string;
  name: string;
  items: number;
  status: string;
  banner: string;
  symbol: string;
  parent_id?: string | null;
  level?: number;
  fixedSlots: number;
  type: "Merchant" | "Service";
  position_1_business_id?: string | null;
  position_2_business_id?: string | null;
  position_3_business_id?: string | null;
  position_4_business_id?: string | null;
  position_5_business_id?: string | null;
  position?: number;
};

type MerchantLite = {
  id: string;
  name: string;
  category: string;
};

type Kind = 0 | 1 | 2;

const KIND_META: Record<
  Kind,
  {
    label: string;
    short: string;
    hint: string;
    livesUnder: string;
    createLabel: string;
    bar: string;
    card: string;
    badge: string;
    chevron: string;
  }
> = {
  0: {
    label: "Parent Category",
    short: "Parent",
    hint: "A grouping folder only. Merchants are never saved on this name.",
    livesUnder: "Stays at the top. Nothing sits above it.",
    createLabel: "Create parent category",
    bar: "bg-violet-500",
    card: "bg-violet-50/80 border-violet-200",
    badge: "bg-violet-600 text-white",
    chevron: "text-violet-700",
  },
  1: {
    label: "Category",
    short: "Category",
    hint: "Merchants attach here. This is what people browse on FinderB.",
    livesUnder: "Optional: nest it under a Parent Category folder.",
    createLabel: "Create category",
    bar: "bg-teal-600",
    card: "bg-teal-50/50 border-teal-200",
    badge: "bg-teal-700 text-white",
    chevron: "text-teal-800",
  },
  2: {
    label: "Subcategory",
    short: "Subcategory",
    hint: "A more specific type under a Category, e.g. Restaurants → Fine Dining.",
    livesUnder: "Must sit under a Category.",
    createLabel: "Create subcategory",
    bar: "bg-amber-500",
    card: "bg-amber-50/70 border-amber-200",
    badge: "bg-amber-600 text-white",
    chevron: "text-amber-800",
  },
};

function kindOf(cat: CategoryRef, all: CategoryRef[]): Kind {
  return inferCategoryLevel(cat, all);
}

function getCategoryConfiguredSlots(cat: AdminCategory) {
  const configured = Math.min(Math.max(cat.fixedSlots || 0, 0), 5);
  return configured > 0 ? configured : 5;
}

function getCategoryBookedSlots(cat: AdminCategory, partnerCount = 0) {
  const capacity = getCategoryConfiguredSlots(cat);
  const fromPositions = [
    cat.position_1_business_id,
    cat.position_2_business_id,
    cat.position_3_business_id,
    cat.position_4_business_id,
    cat.position_5_business_id,
  ]
    .slice(0, capacity)
    .filter(Boolean).length;
  const fromPartners = Math.min(Math.max(partnerCount, 0), capacity);
  return Math.max(fromPositions, fromPartners);
}

function getCategoryFreeSlots(cat: AdminCategory, partnerCount = 0) {
  return Math.max(
    0,
    getCategoryConfiguredSlots(cat) - getCategoryBookedSlots(cat, partnerCount),
  );
}

function isCategoryInfoComplete(cat: AdminCategory) {
  const has = (v?: string | null) => Boolean(v && v !== "Not Set");
  return Boolean(cat.name?.trim()) && has(cat.banner) && has(cat.symbol);
}

function childrenOf(all: AdminCategory[], parentId: string) {
  return all.filter((c) => c.parent_id === parentId);
}

function slotSummary(cat: AdminCategory, partnerCount: number) {
  const configured = getCategoryConfiguredSlots(cat);
  const booked = getCategoryBookedSlots(cat, partnerCount);
  const free = configured - booked;
  if (booked === 0 && free === configured) return `${configured} slots free`;
  if (free === 0) return `${booked}/${configured} full`;
  return `${booked}/${configured} slots · ${free} free`;
}

function KindBadge({ kind }: { kind: Kind }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
    >
      {meta.short}
    </span>
  );
}

function CategorySymbol({
  cat,
  size = "md",
}: {
  cat: Pick<AdminCategory, "name" | "symbol" | "banner">;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold text-teal-700`}
    >
      {cat.symbol && cat.symbol !== "Not Set" ? (
        <img
          src={cat.symbol}
          className="max-h-[70%] max-w-[70%] object-contain"
          alt=""
        />
      ) : cat.banner && cat.banner !== "Not Set" ? (
        <img src={cat.banner} className="h-full w-full object-cover" alt="" />
      ) : (
        cat.name[0]
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export default function CategoriesContent({
  categories,
  categoryError,
  onUpdateCategory,
  onCreateCategory,
  merchants,
  canManage = false,
}: {
  categories: AdminCategory[];
  setCategories: Dispatch<SetStateAction<AdminCategory[]>>;
  categoryError: string | null;
  onUpdateCategory: (
    catName: string,
    updates: Partial<AdminCategory>,
  ) => Promise<void>;
  onCreateCategory: (category: Partial<AdminCategory>) => Promise<void>;
  merchants: MerchantLite[];
  canManage?: boolean;
}) {
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null,
  );
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState<Partial<AdminCategory>>({
    name: "",
    type: "Merchant",
    status: "Active",
    banner: "Not Set",
    symbol: "Not Set",
    fixedSlots: 0,
    level: 1,
    parent_id: null,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [merchantSearch, setMerchantSearch] = useState<{
    [key: string]: string;
  }>({});
  const [categorySearch, setCategorySearch] = useState("");
  const [slotsFilter, setSlotsFilter] = useState<
    "All" | "Free" | "Booked" | "Full"
  >("All");
  const [infoFilter, setInfoFilter] = useState<"All" | "Complete" | "Missing">(
    "All",
  );
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Active" | "Inactive"
  >("All");
  const [kindFilter, setKindFilter] = useState<"All" | Kind>("All");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const partnerCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) {
      map.set(cat.id, countPartnersForCategory(merchants, cat, categories));
    }
    return map;
  }, [categories, merchants]);

  const filtersActive = Boolean(
    categorySearch.trim() ||
      slotsFilter !== "All" ||
      infoFilter !== "All" ||
      statusFilter !== "All" ||
      kindFilter !== "All",
  );

  const matchesFilters = useCallback(
    (cat: AdminCategory) => {
      const q = categorySearch.trim().toLowerCase();
      if (q) {
        const parentName = cat.parent_id
          ? categories.find((c) => c.id === cat.parent_id)?.name || ""
          : "";
        const haystack = `${cat.name} ${parentName} ${cat.type}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "All" && cat.status !== statusFilter) return false;
      if (kindFilter !== "All" && kindOf(cat, categories) !== kindFilter) {
        return false;
      }

      const partners = partnerCountById.get(cat.id) ?? 0;
      const booked = getCategoryBookedSlots(cat, partners);
      const free = getCategoryFreeSlots(cat, partners);
      if (slotsFilter === "Free" && free <= 0) return false;
      if (slotsFilter === "Booked" && booked <= 0) return false;
      if (slotsFilter === "Full" && free > 0) return false;
      if (infoFilter === "Complete" && !isCategoryInfoComplete(cat)) {
        return false;
      }
      if (infoFilter === "Missing" && isCategoryInfoComplete(cat)) {
        return false;
      }
      return true;
    },
    [
      categorySearch,
      slotsFilter,
      infoFilter,
      statusFilter,
      kindFilter,
      categories,
      partnerCountById,
    ],
  );

  const filteredCategories = useMemo(
    () => categories.filter(matchesFilters),
    [categories, matchesFilters],
  );

  const matchingIds = useMemo(
    () => new Set(filteredCategories.map((c) => c.id)),
    [filteredCategories],
  );

  const isExpanded = (id: string) => filtersActive || expandedIds.has(id);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (preset?: Partial<AdminCategory>) => {
    setEditingCategory(null);
    setNewCategory({
      name: "",
      type: "Merchant",
      status: "Active",
      banner: "Not Set",
      symbol: "Not Set",
      fixedSlots: 0,
      level: 1,
      parent_id: null,
      ...preset,
    });
    setIsAddingCategory(true);
  };

  const handleSave = async () => {
    if (!canManage || !editingCategory) return;
    await onUpdateCategory(editingCategory.name, editingCategory);
    setEditingCategory(null);
  };

  const handleCreate = async () => {
    if (!canManage) return;
    if (!newCategory.name) return;
    const kind = (newCategory.level ?? 1) as Kind;
    if (kind === 2 && !newCategory.parent_id) return;
    await onCreateCategory(newCategory);
    setIsAddingCategory(false);
    setNewCategory({
      name: "",
      type: "Merchant",
      status: "Active",
      banner: "Not Set",
      symbol: "Not Set",
      fixedSlots: 0,
      level: 1,
      parent_id: null,
    });
  };

  const handleImageUpload = async (
    file: File,
    type: "banner" | "symbol",
    isEditing: boolean,
  ) => {
    if (!canManage) return;
    try {
      setUploading(type);
      setUploadProgress((prev) => ({ ...prev, [type]: 0 }));
      const url = await uploadToCloudinary(file, (progress) => {
        setUploadProgress((prev) => ({ ...prev, [type]: progress }));
      });
      if (isEditing && editingCategory) {
        setEditingCategory({ ...editingCategory, [type]: url as string });
      } else {
        setNewCategory({ ...newCategory, [type]: url });
      }
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[type];
          return next;
        });
      }, 1500);
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const getFilteredMerchants = (search: string) => {
    if (!search) return [];
    return merchants
      .filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.id.toLowerCase().includes(search.toLowerCase()),
      )
      .slice(0, 5);
  };

  const parentGroups = useMemo(
    () =>
      categories.filter(
        (c) => !c.parent_id && kindOf(c, categories) === 0,
      ),
    [categories],
  );

  const ungroupedCategories = useMemo(
    () =>
      categories.filter(
        (c) => !c.parent_id && kindOf(c, categories) === 1,
      ),
    [categories],
  );

  const visibleParentGroups = parentGroups.filter((parent) => {
    if (matchingIds.has(parent.id)) return true;
    const mids = childrenOf(categories, parent.id);
    return mids.some(
      (mid) =>
        matchingIds.has(mid.id) ||
        childrenOf(categories, mid.id).some((sub) => matchingIds.has(sub.id)),
    );
  });

  const visibleUngrouped = ungroupedCategories.filter((cat) => {
    if (matchingIds.has(cat.id)) return true;
    return childrenOf(categories, cat.id).some((sub) => matchingIds.has(sub.id));
  });

  const orphanFiltered = useMemo(() => {
    const knownParents = new Set(categories.map((c) => c.id));
    return filteredCategories.filter(
      (c) => c.parent_id && !knownParents.has(c.parent_id),
    );
  }, [categories, filteredCategories]);

  const fieldLabel = "block text-xs font-medium text-slate-600 mb-1";
  const fieldInput =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40";

  const renderCategoryForm = (
    cat: Partial<AdminCategory>,
    setCat: (c: Partial<AdminCategory>) => void,
    isEditing: boolean,
  ) => {
    const kind = (typeof cat.level === "number" ? cat.level : kindOf(cat as AdminCategory, categories)) as Kind;
    const safeKind: Kind = kind === 0 || kind === 1 || kind === 2 ? kind : 1;
    const meta = KIND_META[safeKind];
    const parentOptions =
      safeKind === 1
        ? categories.filter(
            (c) => c.id !== cat.id && kindOf(c, categories) === 0,
          )
        : safeKind === 2
          ? categories.filter(
              (c) => c.id !== cat.id && kindOf(c, categories) === 1,
            )
          : [];
    const parentRow = cat.parent_id
      ? categories.find((c) => c.id === cat.parent_id)
      : null;
    const grandparent =
      parentRow?.parent_id
        ? categories.find((c) => c.id === parentRow.parent_id)
        : null;
    const pathParts = [
      safeKind === 0 ? cat.name : grandparent?.name,
      safeKind === 1 ? cat.name : parentRow?.name,
      safeKind === 2 ? cat.name : null,
    ].filter(Boolean);

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-3.5 ${meta.card}`}>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">
              {isEditing ? "Editing" : "Adding"} · {meta.label}
            </p>
            <h2 className="truncate text-base font-semibold text-slate-900">
              {isEditing ? cat.name || "Untitled" : meta.createLabel.replace("Create ", "New ")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              isEditing ? setEditingCategory(null) : setIsAddingCategory(false)
            }
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  1. What is this?
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Pick one. Parent Category is only a folder. Category is what merchants join. Subcategory sits under a Category.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([0, 1, 2] as Kind[]).map((nextLevel) => {
                  const item = KIND_META[nextLevel];
                  const selected = safeKind === nextLevel;
                  return (
                    <button
                      key={nextLevel}
                      type="button"
                      disabled={!canManage}
                      onClick={() => {
                        const options =
                          nextLevel === 1
                            ? categories.filter(
                                (c) =>
                                  c.id !== cat.id &&
                                  kindOf(c, categories) === 0,
                              )
                            : nextLevel === 2
                              ? categories.filter(
                                  (c) =>
                                    c.id !== cat.id &&
                                    kindOf(c, categories) === 1,
                                )
                              : [];
                        setCat({
                          ...cat,
                          level: nextLevel,
                          parent_id:
                            nextLevel === 0
                              ? null
                              : options.some((p) => p.id === cat.parent_id)
                                ? cat.parent_id
                                : null,
                        });
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? `${item.card} ring-2 ring-offset-1 ring-slate-300`
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className={`mb-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.badge}`}>
                        {item.short}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">
                        {item.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                2. Name and placement
              </h3>
              <div>
                <label className={fieldLabel}>Name</label>
                <input
                  type="text"
                  value={cat.name || ""}
                  onChange={(e) => setCat({ ...cat, name: e.target.value })}
                  className={fieldInput}
                  placeholder={
                    safeKind === 0
                      ? "e.g. Food & Dining"
                      : safeKind === 1
                        ? "e.g. Restaurants"
                        : "e.g. Fine Dining"
                  }
                />
              </div>

              {safeKind === 0 ? (
                <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                  {KIND_META[0].livesUnder}
                </p>
              ) : (
                <div>
                  <label className={fieldLabel}>
                    {safeKind === 2
                      ? "Sits under which Category?"
                      : "Group under a Parent Category? (optional)"}
                  </label>
                  <select
                    value={cat.parent_id || ""}
                    onChange={(e) =>
                      setCat({ ...cat, parent_id: e.target.value || null })
                    }
                    className={fieldInput}
                  >
                    <option value="">
                      {safeKind === 2
                        ? "Select a category…"
                        : "None — keep as ungrouped category"}
                    </option>
                    {parentOptions.map((parent) => {
                      const above =
                        parent.parent_id
                          ? categories.find((c) => c.id === parent.parent_id)
                          : null;
                      return (
                        <option key={parent.id} value={parent.id}>
                          {above
                            ? `${above.name} › ${parent.name}`
                            : parent.name}
                        </option>
                      );
                    })}
                  </select>
                  {safeKind === 2 && !cat.parent_id && (
                    <p className="mt-1 text-[11px] text-rose-600">
                      A subcategory must belong to a Category.
                    </p>
                  )}
                </div>
              )}

              {pathParts.length > 0 && cat.name && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Path:{" "}
                  <span className="font-medium text-slate-900">
                    {pathParts.join(" › ")}
                  </span>
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel}>Status</label>
                  <select
                    value={cat.status}
                    onChange={(e) => setCat({ ...cat, status: e.target.value })}
                    className={fieldInput}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Listing type</label>
                  <select
                    value={cat.type}
                    onChange={(e) =>
                      setCat({
                        ...cat,
                        type: e.target.value as "Merchant" | "Service",
                      })
                    }
                    className={fieldInput}
                  >
                    <option value="Merchant">Merchant</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Sort position</label>
                  <input
                    type="number"
                    value={cat.position || 0}
                    onChange={(e) =>
                      setCat({
                        ...cat,
                        position: parseInt(e.target.value) || 0,
                      })
                    }
                    className={fieldInput}
                  />
                </div>
                {safeKind !== 0 && (
                  <div>
                    <label className={fieldLabel}>Fixed partner slots</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={cat.fixedSlots || 0}
                      onChange={(e) =>
                        setCat({
                          ...cat,
                          fixedSlots: parseInt(e.target.value) || 0,
                        })
                      }
                      className={fieldInput}
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                3. Images
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    ["banner", "Banner"],
                    ["symbol", "Symbol"],
                  ] as const
                ).map(([type, label]) => {
                  const url = (cat as Record<string, unknown>)[type] as
                    | string
                    | undefined;
                  const hasImage = url && url !== "Not Set";
                  return (
                    <div
                      key={type}
                      className="space-y-2 rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-700">
                          {label}
                        </span>
                        {hasImage && (
                          <div
                            className={`flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 ${type === "banner" ? "h-9 w-14" : "h-9 w-9"}`}
                          >
                            <img
                              src={url}
                              alt=""
                              className={
                                type === "banner"
                                  ? "h-full w-full object-cover"
                                  : "max-h-[75%] max-w-[75%] object-contain"
                              }
                            />
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          handleImageUpload(e.target.files[0], type, isEditing)
                        }
                        className="hidden"
                        id={`${type}-upload-${isEditing ? "edit" : "new"}`}
                        disabled={uploading === type}
                      />
                      <label
                        htmlFor={`${type}-upload-${isEditing ? "edit" : "new"}`}
                        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs text-slate-500 transition-colors ${
                          uploading === type
                            ? "cursor-not-allowed border-teal-300 bg-teal-50/50"
                            : "border-slate-200 hover:border-teal-300 hover:bg-slate-50"
                        }`}
                      >
                        {uploading === type ? (
                          <span className="font-medium tabular-nums text-teal-700">
                            {(uploadProgress[type] || 0).toFixed(0)}%
                          </span>
                        ) : (
                          <span>
                            {hasImage
                              ? `Change ${label.toLowerCase()}`
                              : `Upload ${label.toLowerCase()}`}
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-3 lg:col-span-2">
            {safeKind === 0 ? (
              <div className="rounded-lg border border-violet-100 bg-violet-50 p-4 text-xs leading-relaxed text-violet-800">
                Parent Categories do not get partner pins. Add Categories inside
                this folder, then pin merchants on those Categories or their
                Subcategories.
              </div>
            ) : (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  4. Pinned partner spots
                </h3>
                <p className="text-[11px] text-slate-400">
                  Optional. These merchants stay in listing positions 1–5.
                </p>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {[1, 2, 3, 4, 5].map((pos) => {
                    const field =
                      `position_${pos}_business_id` as keyof AdminCategory;
                    const currentId = (cat as Record<string, unknown>)[field] as
                      | string
                      | undefined;
                    const merchant = merchants.find((m) => m.id === currentId);
                    return (
                      <div key={pos} className="relative space-y-1.5 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-xs font-semibold tabular-nums text-teal-700">
                            {pos}
                          </span>
                          <input
                            type="text"
                            value={
                              merchantSearch[field] !== undefined
                                ? merchantSearch[field]
                                : merchant
                                  ? merchant.name
                                  : currentId || ""
                            }
                            onChange={(e) =>
                              setMerchantSearch({
                                ...merchantSearch,
                                [field]: e.target.value,
                              })
                            }
                            onFocus={() =>
                              setMerchantSearch({
                                ...merchantSearch,
                                [field]:
                                  merchantSearch[field] ||
                                  (merchant ? merchant.name : currentId || ""),
                              })
                            }
                            className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                            placeholder="Search merchant"
                          />
                          {currentId && (
                            <button
                              type="button"
                              onClick={() => {
                                setCat({ ...cat, [field]: null });
                                setMerchantSearch({
                                  ...merchantSearch,
                                  [field]: "",
                                });
                              }}
                              className="rounded-md p-1 text-rose-500 hover:bg-rose-50"
                              aria-label="Clear spot"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {merchantSearch[field] && (
                          <div className="absolute left-8 right-2.5 z-20 mt-0.5 max-h-36 overflow-y-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                            {getFilteredMerchants(merchantSearch[field]).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setCat({ ...cat, [field]: m.id });
                                  setMerchantSearch({
                                    ...merchantSearch,
                                    [field]: m.name,
                                  });
                                  setTimeout(() => {
                                    setMerchantSearch((prev) => {
                                      const next = { ...prev };
                                      delete next[field];
                                      return next;
                                    });
                                  }, 100);
                                }}
                                className="w-full border-b border-slate-50 px-2.5 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                              >
                                <span className="block font-medium text-slate-900">
                                  {m.name}
                                </span>
                                <span className="block truncate text-[11px] text-slate-400">
                                  {m.category}
                                </span>
                              </button>
                            ))}
                            {getFilteredMerchants(merchantSearch[field]).length ===
                              0 && (
                              <div className="px-2.5 py-2 text-xs text-slate-400">
                                No merchants found
                              </div>
                            )}
                          </div>
                        )}
                        {merchant && !merchantSearch[field] && (
                          <p className="pl-7 text-[11px] text-emerald-600">
                            Linked: {merchant.name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3">
          <button
            type="button"
            onClick={() =>
              isEditing ? setEditingCategory(null) : setIsAddingCategory(false)
            }
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={isEditing ? handleSave : handleCreate}
            disabled={
              !canManage ||
              !cat.name ||
              !!uploading ||
              (safeKind === 2 && !cat.parent_id)
            }
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
          >
            {isEditing ? "Save changes" : meta.createLabel}
          </button>
        </div>
      </div>
    );
  };

  const renderCategoryRow = (
    cat: AdminCategory,
    opts: {
      subs: AdminCategory[];
      visibleSubs: AdminCategory[];
    },
  ) => {
    const partners = partnerCountById.get(cat.id) ?? 0;
    const open = isExpanded(cat.id);
    const hasSubs = opts.subs.length > 0;

    return (
      <div className={`overflow-hidden rounded-lg border ${KIND_META[1].card}`}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className={`h-9 w-1.5 shrink-0 rounded-full ${KIND_META[1].bar}`} />
          {hasSubs ? (
            <button
              type="button"
              onClick={() => toggleExpanded(cat.id)}
              className={`rounded-md p-1 ${KIND_META[1].chevron} hover:bg-white/70`}
              aria-expanded={open}
              aria-label={open ? "Collapse subcategories" : "Expand subcategories"}
            >
              <Chevron open={open} />
            </button>
          ) : (
            <span className="w-6" />
          )}
          <CategorySymbol cat={cat} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-900">
                {cat.name}
              </h3>
              <KindBadge kind={1} />
              {!isCategoryInfoComplete(cat) && (
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                  Missing info
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs tabular-nums text-slate-500">
              {partners} partner{partners === 1 ? "" : "s"}
              {hasSubs ? ` · ${opts.subs.length} subcategor${opts.subs.length === 1 ? "y" : "ies"}` : " · no subcategories"}
              {" · "}
              {slotSummary(cat, partners)}
            </p>
          </div>
          <StatusPill status={cat.status} />
          {canManage && (
            <RowActions
              onEdit={() => {
                setIsAddingCategory(false);
                setEditingCategory({
                  ...cat,
                  level: kindOf(cat, categories),
                });
              }}
              extra={
                <button
                  type="button"
                  onClick={() =>
                    openCreate({ level: 2, parent_id: cat.id })
                  }
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                >
                  + Subcategory
                </button>
              }
            />
          )}
        </div>

        {hasSubs && open && (
          <div className="border-t border-teal-100 bg-amber-50/40 px-3 py-2">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Subcategories
            </p>
            <div className="space-y-1.5">
              {opts.visibleSubs.length === 0 ? (
                <p className="px-1 py-1 text-xs text-slate-400">
                  No subcategories match filters
                </p>
              ) : (
                opts.visibleSubs.map((sub) => (
                  <SubcategoryRow
                    key={sub.id}
                    cat={sub}
                    partnerCount={partnerCountById.get(sub.id) ?? 0}
                    canManage={canManage}
                    onEdit={() => {
                      setIsAddingCategory(false);
                      setEditingCategory({
                        ...sub,
                        level: kindOf(sub, categories),
                      });
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {hasSubs && !open && (
          <button
            type="button"
            onClick={() => toggleExpanded(cat.id)}
            className="flex w-full items-center justify-between border-t border-teal-100 bg-amber-50/30 px-3 py-1.5 text-left text-[11px] font-medium text-amber-800 hover:bg-amber-50"
          >
            <span>
              {opts.subs.length} subcategor{opts.subs.length === 1 ? "y" : "ies"} hidden — click to expand
            </span>
            <Chevron open={false} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans antialiased">
      <div className="flex flex-col justify-between gap-3 px-0.5 sm:flex-row sm:items-end">
        <div>
          <h1 className="admin-page-title">Category Catalog</h1>
          <p className="admin-page-subtitle">
            Parent Category (folder) → Category (merchants) → Subcategory (specific type).
          </p>
        </div>
        {!isAddingCategory && !editingCategory && canManage && (
          <button
            type="button"
            onClick={() => openCreate({ level: 1 })}
            className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800"
          >
            Add item
          </button>
        )}
        {!canManage && (
          <p className="text-xs text-slate-500">
            View only — ask Controller for Edit on Categories.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="font-medium text-slate-500">Legend</span>
        {([0, 1, 2] as Kind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${KIND_META[k].bar}`} />
            <KindBadge kind={k} />
            <span className="text-slate-500">{KIND_META[k].hint.split(".")[0]}</span>
          </span>
        ))}
      </div>

      {categoryError && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {categoryError}
        </div>
      )}

      {isAddingCategory &&
        renderCategoryForm(newCategory, setNewCategory, false)}
      {editingCategory &&
        renderCategoryForm(
          editingCategory,
          (next) =>
            setEditingCategory((prev) =>
              prev ? { ...prev, ...next } : prev,
            ),
          true,
        )}

      {!isAddingCategory && !editingCategory && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search parent, category, or subcategory…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
            <select
              value={kindFilter === "All" ? "All" : String(kindFilter)}
              onChange={(e) =>
                setKindFilter(
                  e.target.value === "All"
                    ? "All"
                    : (Number(e.target.value) as Kind),
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/15"
            >
              <option value="All">All kinds</option>
              <option value="0">Parent categories</option>
              <option value="1">Categories</option>
              <option value="2">Subcategories</option>
            </select>
            <select
              value={slotsFilter}
              onChange={(e) =>
                setSlotsFilter(e.target.value as typeof slotsFilter)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/15"
            >
              <option value="All">All slots</option>
              <option value="Free">Slots free</option>
              <option value="Booked">Slots booked</option>
              <option value="Full">Fully booked</option>
            </select>
            <select
              value={infoFilter}
              onChange={(e) =>
                setInfoFilter(e.target.value as typeof infoFilter)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/15"
            >
              <option value="All">All info</option>
              <option value="Complete">Complete info</option>
              <option value="Missing">Missing info</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/15"
            >
              <option value="All">All status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-0.5 text-xs text-slate-500">
            <CountChip color="bg-violet-500" label="parent categories" value={filteredCategories.filter((c) => kindOf(c, categories) === 0).length} />
            <CountChip color="bg-teal-600" label="categories" value={filteredCategories.filter((c) => kindOf(c, categories) === 1).length} />
            <CountChip color="bg-amber-500" label="subcategories" value={filteredCategories.filter((c) => kindOf(c, categories) === 2).length} />
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setCategorySearch("");
                  setSlotsFilter("All");
                  setInfoFilter("All");
                  setStatusFilter("All");
                  setKindFilter("All");
                }}
                className="ml-auto font-medium text-teal-700 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-4">
            {visibleParentGroups.map((parent) => {
              const mids = childrenOf(categories, parent.id);
              const visibleMids = mids.filter((mid) => {
                if (!filtersActive) return true;
                if (matchingIds.has(mid.id)) return true;
                return childrenOf(categories, mid.id).some((sub) =>
                  matchingIds.has(sub.id),
                );
              });
              const parentPartners = partnerCountById.get(parent.id) ?? 0;

              return (
                <section
                  key={parent.id}
                  className={`overflow-hidden rounded-xl border ${KIND_META[0].card}`}
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span className={`h-10 w-1.5 shrink-0 rounded-full ${KIND_META[0].bar}`} />
                    <CategorySymbol cat={parent} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-slate-900">
                          {parent.name}
                        </h2>
                        <KindBadge kind={0} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Grouping folder · {mids.length} categor{mids.length === 1 ? "y" : "ies"} · {parentPartners} partner{parentPartners === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusPill status={parent.status} />
                    {canManage && (
                      <RowActions
                        onEdit={() => {
                          setIsAddingCategory(false);
                          setEditingCategory({
                            ...parent,
                            level: kindOf(parent, categories),
                          });
                        }}
                        extra={
                          <button
                            type="button"
                            onClick={() =>
                              openCreate({ level: 1, parent_id: parent.id })
                            }
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-100"
                          >
                            + Category
                          </button>
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-2 border-t border-violet-100 bg-white/70 p-2.5">
                    {visibleMids.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-slate-400">
                        No categories in this folder yet
                      </p>
                    ) : (
                      visibleMids.map((mid) => {
                        const subs = childrenOf(categories, mid.id);
                        const visibleSubs = filtersActive
                          ? subs.filter((s) => matchingIds.has(s.id))
                          : subs;
                        return (
                          <div key={mid.id}>
                            {renderCategoryRow(mid, {
                              subs,
                              visibleSubs,
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}

            {visibleUngrouped.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 px-0.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${KIND_META[1].bar}`} />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ungrouped categories
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Not inside a Parent Category folder
                  </span>
                </div>
                {visibleUngrouped.map((cat) => {
                  const subs = childrenOf(categories, cat.id);
                  const visibleSubs = filtersActive
                    ? subs.filter((s) => matchingIds.has(s.id))
                    : subs;
                  return (
                    <div key={cat.id}>
                      {renderCategoryRow(cat, {
                        subs,
                        visibleSubs,
                      })}
                    </div>
                  );
                })}
              </section>
            )}

            {orphanFiltered.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Other
                </h2>
                {orphanFiltered.map((cat) => (
                  <SubcategoryRow
                    key={cat.id}
                    cat={cat}
                    partnerCount={partnerCountById.get(cat.id) ?? 0}
                    canManage={canManage}
                    onEdit={() => {
                      setIsAddingCategory(false);
                      setEditingCategory({
                        ...cat,
                        level: kindOf(cat, categories),
                      });
                    }}
                  />
                ))}
              </section>
            )}

            {visibleParentGroups.length === 0 &&
              visibleUngrouped.length === 0 &&
              orphanFiltered.length === 0 &&
              categories.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500">
                  No categories match your search
                </div>
              )}

            {categories.length === 0 && !categoryError && (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
                No categories defined
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      <span className="font-medium tabular-nums text-slate-700">{value}</span>
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        status === "Active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
}

function RowActions({
  onEdit,
  extra,
}: {
  onEdit: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {extra}
      <button
        type="button"
        onClick={onEdit}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/80 hover:text-teal-700"
        title="Edit"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    </div>
  );
}

function SubcategoryRow({
  cat,
  partnerCount,
  canManage,
  onEdit,
}: {
  cat: AdminCategory;
  partnerCount: number;
  canManage: boolean;
  onEdit: () => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 ${KIND_META[2].card}`}>
      <span className={`h-7 w-1 shrink-0 rounded-full ${KIND_META[2].bar}`} />
      <CategorySymbol cat={cat} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm font-medium text-slate-900">
            {cat.name}
          </h4>
          <KindBadge kind={2} />
          {!isCategoryInfoComplete(cat) && (
            <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
              Missing info
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
          {partnerCount} partner{partnerCount === 1 ? "" : "s"} · {slotSummary(cat, partnerCount)}
        </p>
      </div>
      <StatusPill status={cat.status} />
      {canManage && <RowActions onEdit={onEdit} />}
    </div>
  );
}
