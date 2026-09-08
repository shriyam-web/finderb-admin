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
    plural: string;
    listTitle: string;
    dot: string;
    badge: string;
    rail: string;
  }
> = {
  0: {
    label: "Parent category",
    short: "Parent",
    hint: "A folder for grouping. Merchants are never saved on this name.",
    livesUnder: "Stays at the top. Nothing sits above it.",
    createLabel: "Create parent category",
    plural: "parents",
    listTitle: "Parent categories",
    dot: "bg-slate-500",
    badge: "text-slate-600",
    rail: "border-l-[3px] border-l-slate-400",
  },
  1: {
    label: "Category",
    short: "Category",
    hint: "Merchants attach here. This is what people browse on FinderB.",
    livesUnder: "Optional: nest it under a parent category.",
    createLabel: "Create category",
    plural: "categories",
    listTitle: "Categories",
    dot: "bg-teal-600",
    badge: "text-teal-700",
    rail: "border-l-[3px] border-l-teal-600/80",
  },
  2: {
    label: "Subcategory",
    short: "Subcategory",
    hint: "A more specific type under a category, e.g. Restaurants → Fine Dining.",
    livesUnder: "Must sit under a category.",
    createLabel: "Create subcategory",
    plural: "subcategories",
    listTitle: "Subcategories",
    dot: "bg-indigo-400",
    badge: "text-indigo-700",
    rail: "border-l-[3px] border-l-indigo-400/80",
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

function ancestryPath(cat: AdminCategory, all: AdminCategory[]) {
  const parts: string[] = [];
  let current: AdminCategory | undefined = cat;
  const seen = new Set<string>();
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = all.find((c) => c.id === current?.parent_id);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(" › ");
}

function KindBadge({ kind }: { kind: Kind }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
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
  const [listKind, setListKind] = useState<Kind | null>(null);
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
    (cat: AdminCategory, opts?: { ignoreKind?: boolean }) => {
      const q = categorySearch.trim().toLowerCase();
      if (q) {
        const parentName = cat.parent_id
          ? categories.find((c) => c.id === cat.parent_id)?.name || ""
          : "";
        const haystack = `${cat.name} ${parentName} ${cat.type}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "All" && cat.status !== statusFilter) return false;
      if (
        !opts?.ignoreKind &&
        kindFilter !== "All" &&
        kindOf(cat, categories) !== kindFilter
      ) {
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
    () => categories.filter((cat) => matchesFilters(cat)),
    [categories, matchesFilters],
  );

  const kindLists = useMemo(() => {
    const base = categories.filter((cat) =>
      matchesFilters(cat, { ignoreKind: true }),
    );
    const sortByName = (a: AdminCategory, b: AdminCategory) =>
      a.name.localeCompare(b.name);
    return {
      0: base
        .filter((c) => kindOf(c, categories) === 0)
        .slice()
        .sort(sortByName),
      1: base
        .filter((c) => kindOf(c, categories) === 1)
        .slice()
        .sort(sortByName),
      2: base
        .filter((c) => kindOf(c, categories) === 2)
        .slice()
        .sort(sortByName),
    } as Record<Kind, AdminCategory[]>;
  }, [categories, matchesFilters]);

  const openKindList = (kind: Kind) => {
    setListKind((prev) => (prev === kind ? null : kind));
    setKindFilter("All");
  };

  const startEdit = (cat: AdminCategory) => {
    setIsAddingCategory(false);
    setEditingCategory({
      ...cat,
      level: kindOf(cat, categories),
    });
  };

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
      <div className="admin-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
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
              <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
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
                      className={`rounded-md px-2 py-2 text-center text-[13px] font-medium transition-colors ${
                        selected
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {item.short}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                {meta.hint}
              </p>
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
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                Parent categories do not get partner pins. Add categories inside
                this folder, then pin merchants on those categories or their
                subcategories.
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
      <div className="border-b border-slate-100 last:border-b-0">
        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 ${KIND_META[1].rail} bg-white hover:bg-teal-50/30`}
        >
          {hasSubs ? (
            <button
              type="button"
              onClick={() => toggleExpanded(cat.id)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-expanded={open}
              aria-label={open ? "Collapse subcategories" : "Expand subcategories"}
            >
              <Chevron open={open} />
            </button>
          ) : (
            <span className="w-7" />
          )}
          <CategorySymbol cat={cat} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-medium text-slate-900">
                {cat.name}
              </h3>
              <KindBadge kind={1} />
              {!isCategoryInfoComplete(cat) && (
                <span className="shrink-0 text-[11px] font-medium text-amber-700">
                  Missing info
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs tabular-nums text-slate-500">
              {partners} partner{partners === 1 ? "" : "s"}
              {hasSubs ? ` · ${opts.subs.length} subcategor${opts.subs.length === 1 ? "y" : "ies"}` : ""}
              {" · "}
              {slotSummary(cat, partners)}
            </p>
          </div>
          <StatusPill status={cat.status} />
          {canManage && (
            <RowActions
              onEdit={() => startEdit(cat)}
              extra={
                <button
                  type="button"
                  onClick={() =>
                    openCreate({ level: 2, parent_id: cat.id })
                  }
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  Add subcategory
                </button>
              }
            />
          )}
        </div>

        {hasSubs && open && (
          <div className="relative ml-6 mr-3 mb-2 mt-0 rounded-md border border-indigo-100/70 bg-indigo-50/25 py-1.5 pl-3 pr-2">
            <div className="pointer-events-none absolute bottom-2 left-[-13px] top-0 w-px bg-slate-200" />
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
                  onEdit={() => startEdit(sub)}
                />
              ))
            )}
          </div>
        )}

        {hasSubs && !open && (
          <button
            type="button"
            onClick={() => toggleExpanded(cat.id)}
            className="flex w-full items-center gap-2 border-t border-slate-50 bg-indigo-50/20 px-3 py-1.5 pl-[3.25rem] text-left text-[11px] text-indigo-800/70 hover:bg-indigo-50/40 hover:text-indigo-900"
          >
            <Chevron open={false} />
            <span>
              {opts.subs.length} subcategor{opts.subs.length === 1 ? "y" : "ies"}
            </span>
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
            className="admin-btn-primary"
          >
            Add
          </button>
        )}
        {!canManage && (
          <p className="text-xs text-slate-500">
            View only — ask Controller for Edit on Categories.
          </p>
        )}
      </div>

      <p className="px-0.5 text-[12px] text-slate-500">
        <KindBadge kind={0} />
        <span className="mx-2 text-slate-300">·</span>
        <KindBadge kind={1} />
        <span className="mx-2 text-slate-300">·</span>
        <KindBadge kind={2} />
        <span className="ml-2 text-slate-400">
          Subcategories stay collapsed until you open them. Click a count to
          open that list.
        </span>
      </p>

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
            {([0, 1, 2] as Kind[]).map((kind) => (
              <CountChip
                key={kind}
                kind={kind}
                value={kindLists[kind].length}
                active={listKind === kind}
                onClick={() => openKindList(kind)}
              />
            ))}
            {(filtersActive || listKind !== null) && (
              <button
                type="button"
                onClick={() => {
                  setCategorySearch("");
                  setSlotsFilter("All");
                  setInfoFilter("All");
                  setStatusFilter("All");
                  setKindFilter("All");
                  setListKind(null);
                }}
                className="ml-auto font-medium text-teal-700 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {listKind !== null ? (
            <KindListPanel
              kind={listKind}
              items={kindLists[listKind]}
              all={categories}
              partnerCountById={partnerCountById}
              canManage={canManage}
              onBack={() => setListKind(null)}
              onEdit={startEdit}
              onCreate={() =>
                openCreate({
                  level: listKind,
                  parent_id: listKind === 0 ? null : undefined,
                })
              }
            />
          ) : (
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
                  className={`admin-card overflow-hidden ${KIND_META[0].rail}`}
                >
                  <div className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
                    <CategorySymbol cat={parent} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                          {parent.name}
                        </h2>
                        <KindBadge kind={0} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {mids.length} categor{mids.length === 1 ? "y" : "ies"} · {parentPartners} partner{parentPartners === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusPill status={parent.status} />
                    {canManage && (
                      <RowActions
                        onEdit={() => startEdit(parent)}
                        extra={
                          <button
                            type="button"
                            onClick={() =>
                              openCreate({ level: 1, parent_id: parent.id })
                            }
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            Add category
                          </button>
                        }
                      />
                    )}
                  </div>
                  <div className="relative bg-slate-50/40 pl-3">
                    <div className="pointer-events-none absolute bottom-4 left-[7px] top-3 w-px bg-slate-200" />
                    {visibleMids.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-slate-400">
                        No categories in this folder yet
                      </p>
                    ) : (
                      visibleMids.map((mid) => {
                        const subs = childrenOf(categories, mid.id);
                        const visibleSubs = filtersActive
                          ? subs.filter((s) => matchingIds.has(s.id))
                          : subs;
                        return (
                          <div key={mid.id} className="ml-1">
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
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Ungrouped categories
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Not inside a parent category
                  </span>
                </div>
                <div
                  className={`admin-card overflow-hidden ${KIND_META[1].rail}`}
                >
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
                </div>
              </section>
            )}

            {orphanFiltered.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Other
                </h2>
                <div
                  className={`admin-card overflow-hidden ${KIND_META[2].rail}`}
                >
                {orphanFiltered.map((cat) => (
                  <SubcategoryRow
                    key={cat.id}
                    cat={cat}
                    partnerCount={partnerCountById.get(cat.id) ?? 0}
                    canManage={canManage}
                    onEdit={() => startEdit(cat)}
                  />
                ))}
                </div>
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
          )}
        </div>
      )}
    </div>
  );
}

function CountChip({
  kind,
  value,
  active,
  onClick,
}: {
  kind: Kind;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = KIND_META[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
        active
          ? "border-slate-300 bg-white text-slate-800"
          : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      <span className="text-sm font-semibold tabular-nums text-slate-800">
        {value}
      </span>
      <span>{meta.plural}</span>
    </button>
  );
}

function KindListPanel({
  kind,
  items,
  all,
  partnerCountById,
  canManage,
  onBack,
  onEdit,
  onCreate,
}: {
  kind: Kind;
  items: AdminCategory[];
  all: AdminCategory[];
  partnerCountById: Map<string, number>;
  canManage: boolean;
  onBack: () => void;
  onEdit: (cat: AdminCategory) => void;
  onCreate: () => void;
}) {
  const meta = KIND_META[kind];
  return (
    <section className={`admin-card overflow-hidden ${meta.rail}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-slate-50/70 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              {meta.listTitle}
            </h2>
            <KindBadge kind={kind} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {items.length} in this list
            {canManage ? " — open a row to edit" : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-white hover:text-slate-900"
        >
          Back to tree
        </button>
        {canManage && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md bg-teal-700 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-teal-800"
          >
            Add
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">
          Nothing matches this filter
        </p>
      ) : (
        <div>
          {items.map((cat) => {
            const partners = partnerCountById.get(cat.id) ?? 0;
            const path = ancestryPath(cat, all);
            return (
              <div
                key={cat.id}
                className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 last:border-b-0 hover:bg-slate-50/80"
              >
                <CategorySymbol cat={cat} size={kind === 2 ? "sm" : "md"} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-slate-900">
                      {cat.name}
                    </h3>
                    <KindBadge kind={kind} />
                    {!isCategoryInfoComplete(cat) && (
                      <span className="shrink-0 text-[11px] font-medium text-amber-700">
                        Missing info
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {path ? `${path} · ` : ""}
                    {partners} partner{partners === 1 ? "" : "s"}
                    {kind !== 0 ? ` · ${slotSummary(cat, partners)}` : ""}
                  </p>
                </div>
                <StatusPill status={cat.status} />
                {canManage && (
                  <RowActions
                    onEdit={() => onEdit(cat)}
                    extra={
                      <span className="pr-0.5 text-[11px] font-medium text-slate-500">
                        Edit
                      </span>
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
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
    <div
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 ${KIND_META[2].rail} bg-white/70 hover:bg-white`}
    >
      <CategorySymbol cat={cat} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm text-slate-800">
            {cat.name}
          </h4>
          <KindBadge kind={2} />
          {!isCategoryInfoComplete(cat) && (
            <span className="shrink-0 text-[11px] font-medium text-amber-700">
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
