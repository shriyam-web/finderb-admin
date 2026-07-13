/** Client-safe business URL slug helpers (mirrors FinderB main app). */

export function slugifyBusinessName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildBusinessSlugCandidate(businessName: string, city?: string | null): string {
  const base = slugifyBusinessName(businessName);
  if (!base) return "business";

  const cityPart = city ? slugifyBusinessName(city) : "";
  if (!cityPart || base.endsWith(cityPart) || base.includes(`-${cityPart}`)) {
    return base.slice(0, 96);
  }

  return `${base}-${cityPart}`.slice(0, 96);
}

export function withSlugSuffix(base: string, suffix: string): string {
  return `${base}-${suffix}`.slice(0, 96).replace(/-+$/g, "");
}

export function resolveBusinessSlug(business: {
  slug?: string | null;
  name?: string | null;
  businessName?: string | null;
  city?: string | null;
}): string {
  const persisted = business.slug?.trim();
  if (persisted) return persisted;

  return buildBusinessSlugCandidate(
    business.name || business.businessName || "business",
    business.city,
  );
}

export function getBusinessProfilePath(business: {
  id: string;
  slug?: string | null;
  name?: string | null;
  businessName?: string | null;
  city?: string | null;
}): string {
  return `/business/${resolveBusinessSlug(business)}`;
}
