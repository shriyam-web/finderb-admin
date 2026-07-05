import { parseFinderbTimestamp } from "./formatDateTime";
import { isCategoryLeadSource, isProfileLeadSource } from "./leadBadges";
import {
  buildSubscriptionFromBusiness,
  computePaymentAnalytics,
  formatAmountInr,
  mergePaymentHistory,
  type PaymentRecord,
} from "./paymentUtils";

type UserRow = { createdAt?: string | null };
type MerchantRow = {
  status?: string;
  isFinderBVerified?: boolean;
  paymentStatus?: string;
  selectedPlan?: string;
  billingCycle?: string;
  createdAt?: string | null;
};
type LeadRow = { created_at?: string; status?: string };
type BusinessRow = Parameters<typeof mergePaymentHistory>[1][number];
type PaymentRow = Parameters<typeof mergePaymentHistory>[0][number];

function countSince<T>(items: T[], getDate: (item: T) => string | null | undefined, days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter((item) => {
    const date = parseFinderbTimestamp(getDate(item));
    return date && date >= cutoff;
  }).length;
}

function countToday<T>(items: T[], getDate: (item: T) => string | null | undefined): number {
  const today = new Date().toDateString();
  return items.filter((item) => {
    const date = parseFinderbTimestamp(getDate(item));
    return date && date.toDateString() === today;
  }).length;
}

export type DashboardStats = {
  users: { total: number; weekNew: number; todayNew: number };
  merchants: {
    total: number;
    activeListings: number;
    verified: number;
    paid: number;
    pendingKyc: number;
    weekNew: number;
  };
  leads: { total: number; weekNew: number; profile: number; category: number };
  payments: ReturnType<typeof computePaymentAnalytics> & {
    totalRevenueDisplay: string;
    mtdRevenueDisplay: string;
    successRate: number;
  };
  plans: { starter: number; growthMonthly: number; proAnnual: number };
  content: { categories: number; blogs: number; jobs: number };
  weekSignups: { users: number; merchants: number; leads: number; total: number };
};

export function computeDashboardStats(input: {
  users: UserRow[];
  activeMerchants: MerchantRow[];
  merchantRequests: unknown[];
  leads: LeadRow[];
  allBusinessData: BusinessRow[];
  merchantPaymentRows: PaymentRow[];
  categoriesCount: number;
  blogsCount: number;
  jobsCount: number;
}): DashboardStats {
  const payments: PaymentRecord[] = mergePaymentHistory(
    input.merchantPaymentRows,
    input.allBusinessData,
  );
  const subscriptions = input.allBusinessData
    .map(buildSubscriptionFromBusiness)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const paymentAnalytics = computePaymentAnalytics(payments, subscriptions);
  const totalAttempts = paymentAnalytics.completedCount + paymentAnalytics.pendingCount + paymentAnalytics.failedCount;

  let starter = 0;
  let growthMonthly = 0;
  let proAnnual = 0;
  for (const m of input.activeMerchants) {
    const plan = (m.selectedPlan || "free").toLowerCase();
    const cycle = (m.billingCycle || "monthly").toLowerCase();
    if (plan === "free" || plan === "starter") starter += 1;
    else if (cycle === "annual") proAnnual += 1;
    else growthMonthly += 1;
  }

  const weekNewUsers = countSince(input.users, (u) => u.createdAt, 7);
  const weekNewMerchants = countSince(input.allBusinessData, (m) => m.createdAt, 7);
  const weekNewLeads = countSince(input.leads, (l) => l.created_at, 7);

  return {
    users: {
      total: input.users.length,
      weekNew: weekNewUsers,
      todayNew: countToday(input.users, (u) => u.createdAt),
    },
    merchants: {
      total: input.activeMerchants.length,
      activeListings: input.activeMerchants.filter((m) => m.status === "Active").length,
      verified: input.activeMerchants.filter((m) => m.isFinderBVerified).length,
      paid: input.activeMerchants.filter((m) => m.paymentStatus === "completed").length,
      pendingKyc: input.merchantRequests.length,
      weekNew: weekNewMerchants,
    },
    leads: {
      total: input.leads.length,
      weekNew: weekNewLeads,
      profile: input.leads.filter((l) => isProfileLeadSource(l.status || "")).length,
      category: input.leads.filter((l) => isCategoryLeadSource(l.status || "")).length,
    },
    payments: {
      ...paymentAnalytics,
      totalRevenueDisplay: formatAmountInr(paymentAnalytics.totalRevenuePaise),
      mtdRevenueDisplay: formatAmountInr(paymentAnalytics.mtdRevenuePaise),
      successRate: totalAttempts ? Math.round((paymentAnalytics.completedCount / totalAttempts) * 100) : 0,
    },
    plans: { starter, growthMonthly, proAnnual },
    content: {
      categories: input.categoriesCount,
      blogs: input.blogsCount,
      jobs: input.jobsCount,
    },
    weekSignups: {
      users: weekNewUsers,
      merchants: weekNewMerchants,
      leads: weekNewLeads,
      total: weekNewUsers + weekNewMerchants,
    },
  };
}
