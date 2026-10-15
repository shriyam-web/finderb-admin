import { getPublicSiteUrl } from "./site";

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const secret =
    process.env.FINDERB_SUPPORT_LOGIN_SECRET?.trim() ||
    process.env.FINDERB_DISPATCH_SECRET?.trim();
  if (secret) headers["x-finderb-dispatch"] = secret;
  return headers;
}

export async function fetchAdminChangeRequests(status: string) {
  const search = new URLSearchParams({ status });
  const res = await fetch(
    `${getPublicSiteUrl()}/api/admin/change-requests?${search.toString()}`,
    { method: "GET", headers: requestHeaders(), cache: "no-store" },
  );
  return res.json();
}

export async function postAdminChangeRequestAction(body: Record<string, unknown>) {
  const res = await fetch(`${getPublicSiteUrl()}/api/admin/change-requests`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}
