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

export async function fetchAdminBusinessReports() {
  const res = await fetch(`${getPublicSiteUrl()}/api/admin/business-reports`, {
    method: "GET",
    headers: requestHeaders(),
    cache: "no-store",
  });
  return res.json();
}

export async function deleteAdminBusinessReport(reportId: string) {
  const res = await fetch(`${getPublicSiteUrl()}/api/admin/business-reports`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({ action: "delete", reportId }),
  });
  return res.json();
}
