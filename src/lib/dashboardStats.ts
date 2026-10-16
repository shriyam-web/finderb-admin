import { normalizeOnboardSource } from "./onboardSource";
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
  onboarding: {
    self: number;
    admin: number;
    unknown: number;
    weekSelf: number;
    weekAdmin: number;
    weeks: { label: string; self: number; admin: number }[];
  };
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

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekBuckets = lastEightWeekBuckets(new Date());
  let selfOnboarded = 0;
  let adminOnboarded = 0;
  let unknownOnboarded = 0;
  let weekSelf = 0;
  let weekAdmin = 0;
  for (const business of input.allBusinessData as {
    onboardSource?: string | null;
    createdAt?: string | null;
  }[]) {
    const source = normalizeOnboardSource(business.onboardSource);
    const created = parseFinderbTimestamp(business.createdAt);
    const thisWeek = Boolean(created && created >= weekAgo);
    if (source === "self") {
      selfOnboarded += 1;
      if (thisWeek) weekSelf += 1;
    } else if (source === "admin") {
      adminOnboarded += 1;
      if (thisWeek) weekAdmin += 1;
    } else {
      unknownOnboarded += 1;
    }
    if (!created || (source !== "self" && source !== "admin")) continue;
    const bucket = weekBuckets.find(
      (week) => created.getTime() >= week.start && created.getTime() < week.end,
    );
    if (!bucket) continue;
    if (source === "self") bucket.self += 1;
    else bucket.admin += 1;
  }

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
    onboarding: {
      self: selfOnboarded,
      admin: adminOnboarded,
      unknown: unknownOnboarded,
      weekSelf,
      weekAdmin,
      weeks: weekBuckets.map((week) => ({
        label: week.label,
        self: week.self,
        admin: week.admin,
      })),
    },
  };
}

function lastEightWeekBuckets(now: Date) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return Array.from({ length: 8 }, (_, index) => {
    const startDate = new Date(monday);
    startDate.setDate(monday.getDate() - (7 - index) * 7);
    const end = new Date(startDate);
    end.setDate(startDate.getDate() + 7);
    return {
      start: startDate.getTime(),
      end: end.getTime(),
      label: startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      self: 0,
      admin: 0,
    };
  });
}
