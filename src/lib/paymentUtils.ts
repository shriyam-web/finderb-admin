import { formatDateTimeInr, parseFinderbTimestamp } from "./formatDateTime";

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
  const status =
    business.paymentStatus === "completed"
      ? "completed"
      : business.paymentStatus === "failed"
        ? "failed"
        : "pending";

  return {
    id: `legacy-${String(business.id ?? "unknown")}`,
    businessId: String(business.id ?? ""),
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
        (legacy.paymentId && item.paymentId === legacy.paymentId) ||
        (legacy.orderId && item.orderId === legacy.orderId) ||
        (legacy.subscriptionId && item.subscriptionId === legacy.subscriptionId),
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

export type PaymentAnalytics = {
  totalRevenuePaise: number;
  mtdRevenuePaise: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  activeSubscriptions: number;
  autoDebitEnabled: number;
  expiring7d: number;
  expiring30d: number;
  expiredPlans: number;
  monthlyRevenuePaise: number;
  annualRevenuePaise: number;
  avgTransactionPaise: number;
  opensCount: number;
  planBreakdown: { starter: number; growthMonthly: number; proAnnual: number };
};

function daysUntilExpiry(planExpiresAt: string | null): number | null {
  const expiry = parseFinderbTimestamp(planExpiresAt);
  if (!expiry) return null;
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function computePaymentAnalytics(
  payments: PaymentRecord[],
  subscriptions: SubscriptionRecord[],
): PaymentAnalytics {
  const completed = payments.filter((p) => p.status === "completed");
  const pending = payments.filter((p) => p.status === "pending");
  const failed = payments.filter((p) => p.status === "failed");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalRevenuePaise = completed.reduce((sum, p) => sum + p.amountPaise, 0);
  const mtdRevenuePaise = completed
    .filter((p) => {
      const created = parseFinderbTimestamp(p.createdAt);
      return created && created >= monthStart;
    })
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const monthlyRevenuePaise = completed
    .filter((p) => p.billingCycle === "monthly")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const annualRevenuePaise = completed
    .filter((p) => p.billingCycle === "annual")
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const activeSubscriptions = subscriptions.filter(
    (s) => s.paymentStatus === "completed" && s.subscriptionStatus === "active",
  ).length;
  const autoDebitEnabled = subscriptions.filter((s) => s.autoRenewEnabled).length;

  let expiring7d = 0;
  let expiring30d = 0;
  let expiredPlans = 0;
  for (const sub of subscriptions) {
    const days = daysUntilExpiry(sub.planExpiresAt);
    if (days === null) continue;
    if (days < 0) expiredPlans += 1;
    else if (days <= 7) expiring7d += 1;
    else if (days <= 30) expiring30d += 1;
  }

  const mandatePending = subscriptions.filter(
    (s) => s.mandateStatus === "pending" || s.mandateStatus === "created",
  ).length;

  const planBreakdown = { starter: 0, growthMonthly: 0, proAnnual: 0 };
  for (const sub of subscriptions) {
    if (sub.planName === "Starter") planBreakdown.starter += 1;
    else if (sub.billingCycle === "annual") planBreakdown.proAnnual += 1;
    else planBreakdown.growthMonthly += 1;
  }

  const opensCount =
    pending.length + failed.length + expiring7d + mandatePending;

  return {
    totalRevenuePaise,
    mtdRevenuePaise,
    completedCount: completed.length,
    pendingCount: pending.length,
    failedCount: failed.length,
    activeSubscriptions,
    autoDebitEnabled,
    expiring7d,
    expiring30d,
    expiredPlans,
    monthlyRevenuePaise,
    annualRevenuePaise,
    avgTransactionPaise: completed.length ? Math.round(totalRevenuePaise / completed.length) : 0,
    opensCount,
    planBreakdown,
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
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toDateString();
    const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

    const dayPayments = payments.filter((p) => {
      if (p.status !== "completed") return false;
      const created = parseFinderbTimestamp(p.createdAt);
      return created && created.toDateString() === dateKey;
    });

    result.push({
      label,
      amountPaise: dayPayments.reduce((sum, p) => sum + p.amountPaise, 0),
      count: dayPayments.length,
    });
  }

  return result;
}

export function sumCompletedRevenue(payments: PaymentRecord[]): number {
  return payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amountPaise, 0);
}
