import { getPublicSiteUrl } from "./site";

function reviewHeaders(): Record<string, string> {
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

export async function fetchAdminReviews(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  const res = await fetch(
    `${getPublicSiteUrl()}/api/admin/reviews?${search.toString()}`,
    { method: "GET", headers: reviewHeaders(), cache: "no-store" },
  );
  return res.json();
}

export async function postAdminReviewAction(body: Record<string, unknown>) {
  const res = await fetch(`${getPublicSiteUrl()}/api/admin/reviews`, {
    method: "POST",
    headers: reviewHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}
