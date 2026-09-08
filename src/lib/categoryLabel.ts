/** Shared helpers for FinderB category labels stored on Business.category. */

export type CategoryRef = {
  id: string;
  name: string;
  parent_id?: string | null;
  symbol?: string | null;
  level?: number | null;
};

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
  const raw = (label || "").trim();
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

/**
 * Live partner count for a category card.
 * - Parent: merchants whose label starts with this parent (alone or Parent › Child)
 * - Child: merchants assigned to that specific Parent › Child (or legacy child-only name)
 */
export function countPartnersForCategory(
  merchants: { category: string }[],
  cat: CategoryRef,
  allCategories: CategoryRef[],
): number {
  const parentsById = new Map(allCategories.map((c) => [c.id, c]));
  const kind = inferCategoryLevel(cat, allCategories);

  return merchants.filter((m) => {
    const parsed = parseCategoryLabel(m.category);
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
  }).length;
}
