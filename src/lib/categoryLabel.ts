/** Shared helpers for FinderB category labels stored on Business.category. */

export type CategoryRef = {
  id: string;
  name: string;
  parent_id?: string | null;
  symbol?: string | null;
};

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

  return merchants.filter((m) => {
    const parsed = parseCategoryLabel(m.category);
    if (!parsed.parent) return false;

    if (cat.parent_id) {
      const parent = parentsById.get(cat.parent_id);
      if (!parent) return false;
      if (parsed.child) {
        return (
          namesEqual(parsed.parent, parent.name) &&
          namesEqual(parsed.child, cat.name)
        );
      }
      // Legacy child-only label
      return namesEqual(parsed.parent, cat.name);
    }

    // Parent card: any merchant under this parent tree
    if (namesEqual(parsed.parent, cat.name)) return true;

    // Legacy: merchant stored only child name belonging to this parent
    if (!parsed.child) {
      return allCategories.some(
        (c) =>
          c.parent_id === cat.id && namesEqual(c.name, parsed.parent),
      );
    }
    return false;
  }).length;
}
