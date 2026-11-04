import { FINDERB_TIMEZONE, formatDateTimeInr, parseFinderbTimestamp } from "./formatDateTime";

/** A started checkout can still be paid for this long. After that, the same attempt is cancelled. */
export const CHECKOUT_WINDOW_MS = 15 * 60 * 1000;

export function settleCheckoutStatus(input: {
  status: string;
  createdAt?: string | null;
  paymentId?: string | null;
  paymentType?: string | null;
  now?: number;
}): string {
  const status = String(input.status || "").trim().toLowerCase();
  if (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "attempted"
  ) {
    return status;
  }
  if (status !== "pending") return status || "cancelled";
  if (input.paymentId) return "pending";
  if (input.paymentType === "subscription_renewal") return "pending";

  const created = input.createdAt ? Date.parse(input.createdAt) : Number.NaN;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(created) || now - created >= CHECKOUT_WINDOW_MS) return "cancelled";
  return "pending";
}

/** Money already moved and then stuck, or the bank declined it. An unpaid checkout is not this. */
export function isGenuinePaymentIssue(payment: {
  status: string;
  createdAt?: string | null;
  paymentId?: string | null;
  paymentType?: string | null;
}): boolean {
  const status = settleCheckoutStatus(payment);
  if (status === "failed") return true;
  if (status !== "pending") return false;
  if (!payment.paymentId && payment.paymentType !== "subscription_renewal") return false;
  const created = payment.createdAt ? Date.parse(payment.createdAt) : Number.NaN;
  return Number.isFinite(created) && Date.now() - created >= CHECKOUT_WINDOW_MS;
}

export type PaymentRecord = {
  id: string;
  businessId: string;
  businessName: string;
  merchantEmail: string;
  merchantMobile: string;
  registrationNumber: string | null;
  plan: string;
  planName: string;
  billingCycle: string;
  amountPaise: number;
  amountDisplay: string;
  status: string;
  paymentType: string;
  orderId: string | null;
  paymentId: string | null;
  subscriptionId: string | null;
  source: string | null;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type SubscriptionRecord = {
  businessId: string;
  businessName: string;
  merchantEmail: string;
  merchantMobile: string;
  registrationNumber: string | null;
  plan: string;
  planName: string;
  billingCycle: string;
  paymentStatus: string;
  paymentId: string | null;
  orderId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  autoRenewEnabled: boolean;
  mandateStatus: string;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  updatedAt: string | null;
};

export function getPlanDisplayName(planId?: string | null, billingCycle?: string | null): string {
  const normalized = String(planId || "free").toLowerCase();
  const cycle = billingCycle?.toLowerCase();

  if (normalized === "free" || normalized === "starter") return "Starter";
  if (cycle === "annual") return "Pro — Annual";
  return "Growth — Monthly";
}

export function formatAmountInr(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

function planAmountPaise(plan: string, billingCycle: string): number {
  if (billingCycle === "annual") return 358800;
  return 49900;
}

export function paymentTypeLabel(type: string): string {
  if (type === "subscription_auth") return "Monthly auto-debit";
  if (type === "subscription_renewal") return "Monthly renewal";
  return "One-time";
}

type BusinessPaymentRow = {
  id?: string;
  businessName?: string | null;
  workEmail?: string | null;
  email?: string | null;
  mobile?: string | null;
  registrationNumber?: string | null;
  paymentStatus?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  selectedPlan?: string | null;
  billingCycle?: string | null;
  planStartedAt?: string | null;
  planExpiresAt?: string | null;
  razorpaySubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  autoRenewEnabled?: boolean | null;
  mandateStatus?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  slug?: string | null;
  city?: string | null;
};

type MerchantPaymentRow = {
  id: string;
  business_id: string;
  plan: string;
  billing_cycle: string;
  amount_paise: number;
  currency?: string | null;
  status: string;
  payment_type?: string | null;
  order_id?: string | null;
  payment_id?: string | null;
  razorpay_subscription_id?: string | null;
  source?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  Business?: BusinessPaymentRow | BusinessPaymentRow[] | null;
};

function resolveBusiness(row: MerchantPaymentRow): BusinessPaymentRow | null {
  if (!row.Business) return null;
  return Array.isArray(row.Business) ? row.Business[0] ?? null : row.Business;
}

export function mapMerchantPaymentRow(row: MerchantPaymentRow): PaymentRecord {
  const business = resolveBusiness(row);
  const plan = String(row.plan);
  const billingCycle = String(row.billing_cycle);

  return {
    id: String(row.id),
    businessId: String(row.business_id),
    businessName: String(business?.businessName ?? "—"),
    merchantEmail: String(business?.email || business?.workEmail || "—"),
    merchantMobile: String(business?.mobile ?? "—"),
    registrationNumber: business?.registrationNumber ? String(business.registrationNumber) : null,
    plan,
    planName: getPlanDisplayName(plan, billingCycle),
    billingCycle,
    amountPaise: Number(row.amount_paise),
    amountDisplay: formatAmountInr(Number(row.amount_paise)),
    status: String(row.status),
    paymentType: String(row.payment_type || "one_time"),
    orderId: row.order_id ? String(row.order_id) : null,
    paymentId: row.payment_id ? String(row.payment_id) : null,
    subscriptionId: row.razorpay_subscription_id ? String(row.razorpay_subscription_id) : null,
    source: row.source ? String(row.source) : null,
    planStartedAt: row.plan_started_at ? String(row.plan_started_at) : null,
    planExpiresAt: row.plan_expires_at ? String(row.plan_expires_at) : null,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export function buildLegacyPaymentFromBusiness(business: BusinessPaymentRow): PaymentRecord | null {
  if (!business.id) return null;

  const paymentId = business.paymentId ? String(business.paymentId) : null;
  const orderId = business.orderId ? String(business.orderId) : null;
  const subscriptionId = business.razorpaySubscriptionId
    ? String(business.razorpaySubscriptionId)
    : null;

  if (business.paymentStatus !== "completed" && !paymentId && !orderId && !subscriptionId) {
    return null;
  }

  const plan = String(business.selectedPlan || "pro");
  const billingCycle = String(business.billingCycle || "monthly");
  const amountPaise = planAmountPaise(plan, billingCycle);
  const createdAt = String(business.updatedAt || business.createdAt || new Date().toISOString());
  const rawStatus =
    business.paymentStatus === "completed"
      ? "completed"
      : business.paymentStatus === "failed"
        ? "failed"
        : "pending";
  const status = settleCheckoutStatus({
    status: rawStatus,
    createdAt,
    paymentId,
    paymentType: subscriptionId ? "subscription_auth" : "one_time",
  });

  return {
    id: `legacy-${business.id}`,
    businessId: String(business.id),
    businessName: String(business.businessName ?? "—"),
    merchantEmail: String(business.email || business.workEmail || "—"),
    merchantMobile: String(business.mobile ?? "—"),
    registrationNumber: business.registrationNumber ? String(business.registrationNumber) : null,
    plan,
    planName: getPlanDisplayName(plan, billingCycle),
    billingCycle,
    amountPaise,
    amountDisplay: formatAmountInr(amountPaise),
    status,
    paymentType: subscriptionId ? "subscription_auth" : "one_time",
    orderId,
    paymentId,
    subscriptionId,
    source: "legacy",
    planStartedAt: business.planStartedAt ? String(business.planStartedAt) : null,
    planExpiresAt: business.planExpiresAt ? String(business.planExpiresAt) : null,
    createdAt,
    updatedAt: business.updatedAt ? String(business.updatedAt) : null,
  };
}

export function buildSubscriptionFromBusiness(business: BusinessPaymentRow): SubscriptionRecord | null {
  if (!business.id) return null;

  const hasPaymentActivity =
    business.paymentStatus === "completed" ||
    business.paymentStatus === "pending" ||
    Boolean(business.paymentId) ||
    Boolean(business.orderId) ||
    Boolean(business.razorpaySubscriptionId);

  if (!hasPaymentActivity) return null;

  const plan = String(business.selectedPlan || "free");
  const billingCycle = String(business.billingCycle || "monthly");

  return {
    businessId: String(business.id ?? ""),
    businessName: String(business.businessName ?? "—"),
    merchantEmail: String(business.email || business.workEmail || "—"),
    merchantMobile: String(business.mobile ?? "—"),
    registrationNumber: business.registrationNumber ? String(business.registrationNumber) : null,
    plan,
    planName: getPlanDisplayName(plan, billingCycle),
    billingCycle,
    paymentStatus: String(business.paymentStatus || "pending"),
    paymentId: business.paymentId ? String(business.paymentId) : null,
    orderId: business.orderId ? String(business.orderId) : null,
    subscriptionId: business.razorpaySubscriptionId ? String(business.razorpaySubscriptionId) : null,
    subscriptionStatus: business.subscriptionStatus ? String(business.subscriptionStatus) : null,
    autoRenewEnabled: Boolean(business.autoRenewEnabled),
    mandateStatus: business.mandateStatus ? String(business.mandateStatus) : "none",
    planStartedAt: business.planStartedAt ? String(business.planStartedAt) : null,
    planExpiresAt: business.planExpiresAt ? String(business.planExpiresAt) : null,
    updatedAt: business.updatedAt ? String(business.updatedAt) : null,
  };
}

export function mergePaymentHistory(
  rows: MerchantPaymentRow[],
  businesses: BusinessPaymentRow[],
): PaymentRecord[] {
  const history = rows.map(mapMerchantPaymentRow);
  const legacyItems = businesses
    .map(buildLegacyPaymentFromBusiness)
    .filter((item): item is PaymentRecord => Boolean(item));

  const merged = [...history];

  for (const legacy of legacyItems) {
    const alreadyRecorded = merged.some(
      (item) =>
        Boolean(legacy.paymentId && item.paymentId === legacy.paymentId) ||
        Boolean(legacy.orderId && item.orderId === legacy.orderId),
    );
    if (!alreadyRecorded) merged.push(legacy);
  }

  return merged.sort(
    (a, b) => {
      const aTime = parseFinderbTimestamp(a.createdAt)?.getTime() ?? 0;
      const bTime = parseFinderbTimestamp(b.createdAt)?.getTime() ?? 0;
      return bTime - aTime;
    },
  );
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return formatDateTimeInr(value);
}

export type SubscriptionLifecycle = "active" | "expired" | "pending";

export type RevenueBucket = {
  key: string;
  label: string;
  amountPaise: number;
  count: number;
};

export type PaymentAnalytics = {
  totalRevenuePaise: number;
  todayRevenuePaise: number;
  todayCount: number;
  weekRevenuePaise: number;
  weekCount: number;
  mtdRevenuePaise: number;
  mtdCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  pendingSubscriptions: number;
  autoDebitEnabled: number;
  autoDebitActive: number;
  cancelledCount: number;
  expiring7d: number;
  expiring30d: number;
  expiredPlans: number;
  monthlyRevenuePaise: number;
  annualRevenuePaise: number;
  avgTransactionPaise: number;
  opensCount: number;
  planBreakdown: { starter: number; growthMonthly: number; proAnnual: number };
  activePlanBreakdown: { starter: number; growthMonthly: number; proAnnual: number };
};

function daysUntilExpiry(planExpiresAt: string | null, now = Date.now()): number | null {
  const expiry = parseFinderbTimestamp(planExpiresAt);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - now) / (1000 * 60 * 60 * 24));
}

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FINDERB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
}

export function istDayKey(date: Date): string {
  const { year, month, day } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function istMonthKey(date: Date): string {
  const { year, month } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function istMidnightUtc(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`);
}

export function istRangeStart(kind: "today" | "week" | "month", now = new Date()): Date {
  const dayKey = istDayKey(now);
  if (kind === "today") return istMidnightUtc(dayKey);
  if (kind === "month") {
    const { year, month } = istParts(now);
    return istMidnightUtc(`${year}-${String(month).padStart(2, "0")}-01`);
  }
  const weekdayOffset: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayOffset[istParts(now).weekday] ?? 0;
  return new Date(istMidnightUtc(dayKey).getTime() - offset * 86_400_000);
}

export function paymentInRange(
  createdAt: string,
  start: Date,
  end?: Date,
): boolean {
  const created = parseFinderbTimestamp(createdAt);
  if (!created) return false;
  if (created < start) return false;
  if (end && created >= end) return false;
  return true;
}

export function subscriptionLifecycle(
  sub: Pick<SubscriptionRecord, "paymentStatus" | "planExpiresAt">,
  now = Date.now(),
): SubscriptionLifecycle {
  const days = daysUntilExpiry(sub.planExpiresAt, now);
  const paid = sub.paymentStatus === "completed";
  if (paid) {
    if (days === null || days >= 0) return "active";
    return "expired";
  }
  if (days !== null && days < 0) return "expired";
  return "pending";
}

export function lifecycleLabel(lifecycle: SubscriptionLifecycle): string {
  if (lifecycle === "active") return "Active";
  if (lifecycle === "expired") return "Expired";
  return "Pending";
}

function sumRange(payments: PaymentRecord[], start: Date) {
  const rows = payments.filter(
    (payment) => payment.status === "completed" && paymentInRange(payment.createdAt, start),
  );
  return {
    amountPaise: rows.reduce((sum, payment) => sum + payment.amountPaise, 0),
    count: rows.length,
  };
}

export function computePaymentAnalytics(
  payments: PaymentRecord[],
  subscriptions: SubscriptionRecord[],
): PaymentAnalytics {
  const completed = payments.filter((p) => p.status === "completed");
  const pending = payments.filter((p) => p.status === "pending");
  const failed = payments.filter((p) => p.status === "failed");

  const now = new Date();
  const today = sumRange(completed, istRangeStart("today", now));
  const week = sumRange(completed, istRangeStart("week", now));
  const month = sumRange(completed, istRangeStart("month", now));
  const cancelled = payments.filter((p) => p.status === "cancelled");
  const genuineOpens = payments.filter((p) => isGenuinePaymentIssue(p)).length;

  const totalRevenuePaise = completed.reduce((sum, p) => sum + p.amountPaise, 0);
  const monthlyRevenuePaise = completed
    .filter((p) => p.billingCycle === "monthly")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const annualRevenuePaise = completed
    .filter((p) => p.billingCycle === "annual")
    .reduce((sum, p) => sum + p.amountPaise, 0);

  let activeSubscriptions = 0;
  let expiredSubscriptions = 0;
  let pendingSubscriptions = 0;
  let autoDebitEnabled = 0;
  let autoDebitActive = 0;
  let expiring7d = 0;
  let expiring30d = 0;
  const planBreakdown = { starter: 0, growthMonthly: 0, proAnnual: 0 };
  const activePlanBreakdown = { starter: 0, growthMonthly: 0, proAnnual: 0 };

  for (const sub of subscriptions) {
    const lifecycle = subscriptionLifecycle(sub, now.getTime());
    if (lifecycle === "active") activeSubscriptions += 1;
    else if (lifecycle === "expired") expiredSubscriptions += 1;
    else pendingSubscriptions += 1;
    if (sub.autoRenewEnabled) {
      autoDebitEnabled += 1;
      if (lifecycle === "active") autoDebitActive += 1;
    }
    const days = daysUntilExpiry(sub.planExpiresAt, now.getTime());
    if (days !== null) {
      if (days < 0) {
        /* counted via expiredSubscriptions */
      } else if (days <= 7) expiring7d += 1;
      else if (days <= 30) expiring30d += 1;
    }
    const bucket =
      sub.planName === "Starter"
        ? "starter"
        : sub.billingCycle === "annual"
          ? "proAnnual"
          : "growthMonthly";
    planBreakdown[bucket] += 1;
    if (lifecycle === "active") activePlanBreakdown[bucket] += 1;
  }

  return {
    totalRevenuePaise,
    todayRevenuePaise: today.amountPaise,
    todayCount: today.count,
    weekRevenuePaise: week.amountPaise,
    weekCount: week.count,
    mtdRevenuePaise: month.amountPaise,
    mtdCount: month.count,
    completedCount: completed.length,
    pendingCount: pending.length,
    failedCount: failed.length,
    activeSubscriptions,
    expiredSubscriptions,
    pendingSubscriptions,
    autoDebitEnabled,
    autoDebitActive,
    cancelledCount: cancelled.length,
    expiring7d,
    expiring30d,
    expiredPlans: expiredSubscriptions,
    monthlyRevenuePaise,
    annualRevenuePaise,
    avgTransactionPaise: completed.length ? Math.round(totalRevenuePaise / completed.length) : 0,
    opensCount: genuineOpens,
    planBreakdown,
    activePlanBreakdown,
  };
}

export function getExpiryUrgency(planExpiresAt: string | null): "expired" | "critical" | "warning" | "ok" | "none" {
  const days = daysUntilExpiry(planExpiresAt);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  return "ok";
}

export { daysUntilExpiry };

export type RevenueChartDay = {
  label: string;
  amountPaise: number;
  count: number;
};

export function buildRevenueChart(payments: PaymentRecord[], days = 7): RevenueChartDay[] {
  const now = new Date();
  const result: RevenueChartDay[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const cursor = new Date(now.getTime() - i * 86_400_000);
    const dateKey = istDayKey(cursor);
    const label = cursor.toLocaleDateString("en-IN", {
      timeZone: FINDERB_TIMEZONE,
      weekday: "short",
      day: "numeric",
    });
    const dayPayments = payments.filter((p) => {
      if (p.status !== "completed") return false;
      const created = parseFinderbTimestamp(p.createdAt);
      return created ? istDayKey(created) === dateKey : false;
    });
    result.push({
      label,
      amountPaise: dayPayments.reduce((sum, p) => sum + p.amountPaise, 0),
      count: dayPayments.length,
    });
  }

  return result;
}

export function buildWeekWiseRevenue(payments: PaymentRecord[], weeks = 8): RevenueBucket[] {
  const now = new Date();
  const thisWeekStart = istRangeStart("week", now);
  const result: RevenueBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeekStart.getTime() - i * 7 * 86_400_000);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const rows = payments.filter(
      (p) => p.status === "completed" && paymentInRange(p.createdAt, start, end),
    );
    result.push({
      key: istDayKey(start),
      label: start.toLocaleDateString("en-IN", {
        timeZone: FINDERB_TIMEZONE,
        day: "numeric",
        month: "short",
      }),
      amountPaise: rows.reduce((sum, p) => sum + p.amountPaise, 0),
      count: rows.length,
    });
  }

  return result;
}

export function buildMonthWiseRevenue(payments: PaymentRecord[], months = 12): RevenueBucket[] {
  const now = new Date();
  const { year, month } = istParts(now);
  const result: RevenueBucket[] = [];

  for (let i = months - 1; i >= 0; i--) {
    let monthNumber = month - i;
    let yearNumber = year;
    while (monthNumber <= 0) {
      monthNumber += 12;
      yearNumber -= 1;
    }
    const key = `${yearNumber}-${String(monthNumber).padStart(2, "0")}`;
    const start = istMidnightUtc(`${key}-01`);
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const nextYear = monthNumber === 12 ? yearNumber + 1 : yearNumber;
    const end = istMidnightUtc(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
    const rows = payments.filter(
      (p) => p.status === "completed" && paymentInRange(p.createdAt, start, end),
    );
    result.push({
      key,
      label: start.toLocaleDateString("en-IN", {
        timeZone: FINDERB_TIMEZONE,
        month: "short",
        year: "2-digit",
      }),
      amountPaise: rows.reduce((sum, p) => sum + p.amountPaise, 0),
      count: rows.length,
    });
  }

  return result;
}

export function paymentsForBusiness(
  payments: PaymentRecord[],
  businessId: string,
): PaymentRecord[] {
  return payments
    .filter((payment) => payment.businessId === businessId)
    .sort((a, b) => {
      const aTime = parseFinderbTimestamp(a.createdAt)?.getTime() ?? 0;
      const bTime = parseFinderbTimestamp(b.createdAt)?.getTime() ?? 0;
      return bTime - aTime;
    });
}

export function sumCompletedRevenue(payments: PaymentRecord[]): number {
  return payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amountPaise, 0);
}
