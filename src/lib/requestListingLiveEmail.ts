/**
 * Browser helper — asks Admin API to trigger the FinderB “you’re live” email.
 * Never throws; safe to fire-and-forget after activation.
 */
export async function requestListingLiveEmail(
  adminId: string | null | undefined,
  businessId: string | null | undefined,
): Promise<void> {
  const aid = String(adminId || "").trim();
  const bid = String(businessId || "").trim();
  if (!aid || !bid) return;

  try {
    const res = await fetch("/api/business/notify-listing-live", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ adminId: aid, businessId: bid }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[listing-live] admin proxy failed",
        res.status,
        body.slice(0, 200),
      );
    }
  } catch (error) {
    console.warn("[listing-live] admin proxy error", error);
  }
}
