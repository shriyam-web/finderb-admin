/** Shared helpers for FinderB category labels stored on Business.category. */

export type CategoryRef = {
  id: string;
  name: string;
  parent_id?: string | null;
  symbol?: string | null;
  level?: number | null;
};

/** Delimiter for multi category / subcategory mappings on Business.category. */
export const BUSINESS_CATEGORY_SEP = " ||| ";

export function splitBusinessCategories(
  label: string | null | undefined,
): string[] {
  return (label || "")
    .split(/\s*\|\|\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function joinBusinessCategories(labels: string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique.join(BUSINESS_CATEGORY_SEP);
}

export function primaryBusinessCategory(
  label: string | null | undefined,
): string {
  return splitBusinessCategories(label)[0] || "";
}

export function inferCategoryLevel(
  cat: CategoryRef,
  all: CategoryRef[],
): 0 | 1 | 2 {
  if (cat.level === 0) return 0;
  if (!cat.parent_id) return 1;
  const parent = all.find((item) => item.id === cat.parent_id);
  if (parent?.level === 0) return 1;
  return 2;
}

export function parseCategoryLabel(label: string | null | undefined): {
  parent: string;
  child: string | null;
} {
  const raw = primaryBusinessCategory(label);
  if (!raw) return { parent: "", child: null };
  const match = raw.match(/^(.+?)\s*[›>]\s*(.+)$/);
  if (match) {
    return { parent: match[1].trim(), child: match[2].trim() };
  }
  return { parent: raw, child: null };
}

export function resolveCategoryLabel(
  parentName: string,
  childName?: string | null,
): string {
  const parent = parentName.trim();
  const child = (childName || "").trim();
  if (!parent) return "";
  return child ? `${parent} › ${child}` : parent;
}

function namesEqual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Resolve stored label → parent + optional child category rows. */
export function matchCategoriesFromLabel(
  label: string | null | undefined,
  categories: CategoryRef[],
): { parent: CategoryRef | null; child: CategoryRef | null } {
  const { parent: parentName, child: childName } = parseCategoryLabel(label);
  if (!parentName) return { parent: null, child: null };

  const parents = categories.filter((c) => !c.parent_id);
  const byParentId = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  // Exact "Parent › Child"
  if (childName) {
    const parent = parents.find((p) => namesEqual(p.name, parentName)) || null;
    if (parent) {
      const child =
        byParentId(parent.id).find((c) => namesEqual(c.name, childName)) ||
        null;
      return { parent, child };
    }
  }

  // Exact parent-only
  const exactParent = parents.find((p) => namesEqual(p.name, parentName));
  if (exactParent) return { parent: exactParent, child: null };

  // Legacy: label is a child name only
  const childOnly = categories.find(
    (c) => c.parent_id && namesEqual(c.name, parentName),
  );
  if (childOnly) {
    const parent = categories.find((c) => c.id === childOnly.parent_id) || null;
    return { parent, child: childOnly };
  }

  return { parent: null, child: null };
}

function merchantMatchesSingleLabel(
  entry: string,
  cat: CategoryRef,
  allCategories: CategoryRef[],
): boolean {
  const parentsById = new Map(allCategories.map((c) => [c.id, c]));
  const kind = inferCategoryLevel(cat, allCategories);
  const parsed = parseCategoryLabel(entry);
  if (!parsed.parent) return false;

  if (kind === 0) {
    const categoryChildren = allCategories.filter((c) => c.parent_id === cat.id);
    const categoryNames = new Set(
      categoryChildren.map((c) => c.name.trim().toLowerCase()),
    );
    const subNames = new Set(
      allCategories
        .filter((c) => categoryChildren.some((mid) => mid.id === c.parent_id))
        .map((c) => c.name.trim().toLowerCase()),
    );
    const parentNorm = parsed.parent.toLowerCase();
    const childNorm = (parsed.child || "").toLowerCase();
    if (categoryNames.has(parentNorm)) return true;
    if (subNames.has(parentNorm) || (childNorm && subNames.has(childNorm))) {
      return true;
    }
    return false;
  }

  if (kind === 2) {
    const parent = cat.parent_id ? parentsById.get(cat.parent_id) : null;
    if (!parent) return false;
    if (parsed.child) {
      return (
        namesEqual(parsed.parent, parent.name) &&
        namesEqual(parsed.child, cat.name)
      );
    }
    return namesEqual(parsed.parent, cat.name);
  }

  // Category (level 1)
  if (namesEqual(parsed.parent, cat.name)) return true;
  if (!parsed.child) {
    return allCategories.some(
      (c) => c.parent_id === cat.id && namesEqual(c.name, parsed.parent),
    );
  }
  return false;
}

/**
 * Live partner count for a category card.
 * Merchants may map to multiple category labels (joined with BUSINESS_CATEGORY_SEP).
 */
export function countPartnersForCategory(
  merchants: { category: string }[],
  cat: CategoryRef,
  allCategories: CategoryRef[],
): number {
  return merchants.filter((m) =>
    splitBusinessCategories(m.category).some((entry) =>
      merchantMatchesSingleLabel(entry, cat, allCategories),
    ),
  ).length;
}
