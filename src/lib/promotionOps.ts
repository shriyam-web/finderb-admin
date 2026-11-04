export const PROMO_TAB = "Business Promotions";

const FORWARD: Record<string, string[]> = {
  payment_successful: ["under_review", "rejected", "cancelled", "refund_pending"],
  under_review: ["editing", "video_ready", "rejected", "cancelled", "refund_pending"],
  editing: ["video_ready", "under_review", "rejected"],
  video_ready: ["ad_active", "editing", "rejected"],
  ad_active: ["completed"],
  refund_pending: ["refunded", "cancelled"],
};

export function canMoveCampaign(from: string, to: string) {
  return (FORWARD[from] || []).includes(to);
}

export function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
