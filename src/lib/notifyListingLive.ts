import { getPublicSiteUrl } from "./site";

export type NotifyListingLiveResult = {
  success: boolean;
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  to?: string;
};

/**
 * Asks the FinderB website to email the merchant that their listing is live.
 * Fire-and-forget friendly: never throws; logs failures.
 */
export async function notifyListingLiveOnSite(
  businessId: string,
): Promise<NotifyListingLiveResult> {
  const id = String(businessId || "").trim();
  if (!id) {
    return { success: false, reason: "businessId is required" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const secret = process.env.FINDERB_DISPATCH_SECRET?.trim();
  if (secret) {
    headers["x-finderb-dispatch"] = secret;
  }

  try {
    const res = await fetch(`${getPublicSiteUrl()}/api/business/listing-live`, {
      method: "POST",
      headers,
      body: JSON.stringify({ businessId: id }),
    });
    const json = (await res.json().catch(() => null)) as NotifyListingLiveResult | null;
    if (!res.ok) {
      console.warn(
        "[listing-live] site notify failed",
        res.status,
        json?.reason || json,
      );
      return {
        success: false,
        sent: false,
        reason: json?.reason || `HTTP ${res.status}`,
      };
    }
    return json || { success: true, sent: true };
  } catch (error) {
    console.warn("[listing-live] site notify error", error);
    return {
      success: false,
      sent: false,
      reason: error instanceof Error ? error.message : "Network error",
    };
  }
}
