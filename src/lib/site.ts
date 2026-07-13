import { getBusinessProfilePath } from "./businessSlug";

export function getPublicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_FINDERB_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "https://finderb.com";
}

export function getBusinessLoginUrl(): string {
  return `${getPublicSiteUrl()}/business/login`;
}

export function getBusinessProfileUrl(business: {
  id: string;
  slug?: string | null;
  name?: string | null;
  businessName?: string | null;
  city?: string | null;
}): string {
  return `${getPublicSiteUrl()}${getBusinessProfilePath(business)}`;
}
