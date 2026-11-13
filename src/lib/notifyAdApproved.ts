import { getPublicSiteUrl } from "./site";

export async function notifyAdApprovedOnSite(orderId: string): Promise<void> {
  const id = String(orderId || "").trim();
  if (!id) return;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const secret = process.env.FINDERB_DISPATCH_SECRET?.trim();
  if (secret) headers["x-finderb-dispatch"] = secret;
  try {
    const res = await fetch(`${getPublicSiteUrl()}/api/business/ad-approved`, {
      method: "POST",
      headers,
      body: JSON.stringify({ orderId: id }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      console.warn("[ad-approved] site notify failed", res.status, json);
    }
  } catch (error) {
    console.warn("[ad-approved] site notify error", error);
  }
}
