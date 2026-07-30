import { parseFinderbTimestamp } from "./formatDateTime";

export type MerchantPlanPreset = {
  id: string;
  label: string;
  selectedPlan: string;
  billingCycle: "monthly" | "annual";
  paymentStatus: "completed" | "pending" | "failed";
};

export const MERCHANT_PLAN_PRESETS: MerchantPlanPreset[] = [
  { id: "starter", label: "Starter", selectedPlan: "free", billingCycle: "monthly", paymentStatus: "pending" },
  { id: "growth_monthly", label: "Growth — Monthly", selectedPlan: "growth", billingCycle: "monthly", paymentStatus: "completed" },
  { id: "pro_annual", label: "Pro — Annual", selectedPlan: "pro", billingCycle: "annual", paymentStatus: "completed" },
];

/**
 * Map stored plan fields → preset id.
 * Paid plans are distinguished by billing cycle (same rule as planLabel):
 * annual → Pro — Annual, otherwise → Growth — Monthly.
 * Do not key off selectedPlan === "pro" alone — many Growth clients still store "pro".
 */
export function resolvePlanPresetId(selectedPlan: string, billingCycle: string): string {
  const plan = (selectedPlan || "free").toLowerCase();
  const cycle = (billingCycle || "monthly").toLowerCase();
  if (plan === "free" || plan === "starter") return "starter";
  if (cycle === "annual") return "pro_annual";
  return "growth_monthly";
}

export function toDateInputValue(value: string | null | undefined): string {
  const date = parseFinderbTimestamp(value);
  if (!date) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function dateInputToIso(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const utcMs = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

export function extendPlanExpiry(
  currentExpiresAt: string | null | undefined,
  unit: "month" | "year",
): string {
  const now = new Date();
  const base = parseFinderbTimestamp(currentExpiresAt);
  const start = base && base > now ? base : now;
  const end = new Date(start);
  if (unit === "month") {
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }
  return end.toISOString();
}

export function collapsePlanExpiry(
  currentExpiresAt: string | null | undefined,
  unit: "month" | "year",
): string {
  const now = new Date();
  const base = parseFinderbTimestamp(currentExpiresAt) ?? now;
  const end = new Date(base);
  if (unit === "month") {
    end.setUTCMonth(end.getUTCMonth() - 1);
  } else {
    end.setUTCFullYear(end.getUTCFullYear() - 1);
  }
  const floor = new Date(now);
  floor.setUTCHours(12, 0, 0, 0);
  if (end < floor) return floor.toISOString();
  return end.toISOString();
}

export function applyPlanPreset(
  preset: MerchantPlanPreset,
  current: {
    planStartedAt: string | null;
    planExpiresAt: string | null;
  },
): {
  selectedPlan: string;
  billingCycle: "monthly" | "annual";
  paymentStatus: string;
  planStartedAt: string;
  planExpiresAt: string | null;
} {
  const now = new Date();
  const started = parseFinderbTimestamp(current.planStartedAt) ?? now;
  const planStartedAt = started.toISOString();

  if (preset.paymentStatus !== "completed") {
    return {
      selectedPlan: preset.selectedPlan,
      billingCycle: preset.billingCycle,
      paymentStatus: preset.paymentStatus,
      planStartedAt,
      planExpiresAt: null,
    };
  }

  const planExpiresAt = extendPlanExpiry(
    current.planExpiresAt ?? now.toISOString(),
    preset.billingCycle === "annual" ? "year" : "month",
  );

  return {
    selectedPlan: preset.selectedPlan,
    billingCycle: preset.billingCycle,
    paymentStatus: "completed",
    planStartedAt,
    planExpiresAt,
  };
}

export function planLabel(plan: string, billingCycle: string) {
  const presetId = resolvePlanPresetId(plan, billingCycle);
  return (
    MERCHANT_PLAN_PRESETS.find((preset) => preset.id === presetId)?.label ??
    "Growth — Monthly"
  );
}
