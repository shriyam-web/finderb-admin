import { getPublicSiteUrl } from "./site";

type SupportHeaders = Record<string, string>;

function supportHeaders(): SupportHeaders {
  const headers: SupportHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const secret =
    process.env.FINDERB_SUPPORT_LOGIN_SECRET?.trim() ||
    process.env.FINDERB_DISPATCH_SECRET?.trim();
  if (secret) headers["x-finderb-dispatch"] = secret;
  return headers;
}

export async function searchMerchantsForSupportLogin(query: string) {
  const res = await fetch(
    `${getPublicSiteUrl()}/api/business/support-login?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: supportHeaders(),
      cache: "no-store",
    },
  );
  return res.json();
}

export async function mintMerchantSupportLogin(input: {
  businessId: string;
  adminId: string;
  adminEmail?: string;
  reason?: string;
}) {
  const res = await fetch(`${getPublicSiteUrl()}/api/business/support-login`, {
    method: "POST",
    headers: supportHeaders(),
    body: JSON.stringify(input),
  });
  return res.json();
}
