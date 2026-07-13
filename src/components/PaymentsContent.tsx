"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  Filter,
  LayoutGrid,
  List,
  PieChart,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "../../utils/supabase/client";
import { parseFinderbTimestamp } from "../lib/formatDateTime";
import {
  buildRevenueChart,
  buildSubscriptionFromBusiness,
  computePaymentAnalytics,
  daysUntilExpiry,
  formatAmountInr,
  formatDateTime,
  getExpiryUrgency,
  mergePaymentHistory,
  paymentTypeLabel,
  sumCompletedRevenue,
  type PaymentRecord,
  type SubscriptionRecord,
} from "../lib/paymentUtils";
import AdminBarChart from "./AdminBarChart";

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

type TabId = "overview" | "transactions" | "subscriptions" | "tracking";
type SubViewMode = "grid" | "table";
type TxnSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
type StatusFilter = "all" | "completed" | "pending" | "failed";
type BillingFilter = "all" | "monthly" | "annual";
type PlanFilter = "all" | "starter" | "growth_monthly" | "pro_annual";
type TypeFilter =
  "all" | "one_time" | "subscription_auth" | "subscription_renewal";
type DateFilter = "all" | "7d" | "30d" | "90d" | "mtd";
type ExpiryFilter = "all" | "expiring_7d" | "expiring_30d" | "expired";
type AutoDebitFilter = "all" | "enabled" | "off";
type MandateFilter = "all" | "active" | "pending" | "none";
type SubStatusFilter = "all" | "active" | "cancelled" | "pending" | "none";

const PLAN_OPTIONS: { value: PlanFilter; label: string }[] = [
  { value: "all", label: "All plans" },
  { value: "starter", label: "Starter" },
  { value: "growth_monthly", label: "Growth — Monthly" },
  { value: "pro_annual", label: "Pro — Annual" },
];

function statusBadgeClass(status: string) {
  if (status === "completed")
    return "bg-emerald-500/10 text-emerald-700 border-emerald-200/80";
  if (status === "pending")
    return "bg-amber-500/10 text-amber-800 border-amber-200/80";
  if (status === "failed")
    return "bg-rose-500/10 text-rose-700 border-rose-200/80";
  return "bg-slate-500/10 text-slate-600 border-slate-200/80";
}

function expiryBadgeClass(urgency: ReturnType<typeof getExpiryUrgency>) {
  if (urgency === "expired")
    return "bg-rose-500/10 text-rose-700 border-rose-200/80";
  if (urgency === "critical")
    return "bg-orange-500/10 text-orange-700 border-orange-200/80";
  if (urgency === "warning")
    return "bg-amber-500/10 text-amber-800 border-amber-200/80";
  if (urgency === "ok")
    return "bg-emerald-500/10 text-emerald-700 border-emerald-200/80";
  return "bg-slate-500/10 text-slate-500 border-slate-200/80";
}

function matchesPlanFilter(
  planName: string,
  billingCycle: string,
  filter: PlanFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "starter") return planName === "Starter";
  if (filter === "pro_annual") return billingCycle === "annual";
  return (
    planName === "Growth — Monthly" ||
    (billingCycle === "monthly" && planName !== "Starter")
  );
}

function matchesDateFilter(createdAt: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const created = parseFinderbTimestamp(createdAt);
  if (!created) return false;
  const now = new Date();
  if (filter === "mtd") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return created >= monthStart;
  }
  const days = filter === "7d" ? 7 : filter === "30d" ? 30 : 90;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return created >= cutoff;
}

function matchesExpiryFilter(
  planExpiresAt: string | null,
  filter: ExpiryFilter,
): boolean {
  if (filter === "all") return true;
  const days = daysUntilExpiry(planExpiresAt);
  if (days === null) return filter === "expired" ? false : false;
  if (filter === "expired") return days < 0;
  if (filter === "expiring_7d") return days >= 0 && days <= 7;
  if (filter === "expiring_30d") return days >= 0 && days <= 30;
  return true;
}

function CopyableId({
  value,
  label,
}: {
  value: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-slate-400">—</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group inline-flex items-center gap-1 font-mono text-[10px] text-slate-700 hover:text-primary transition-colors max-w-full"
      title={`Copy ${label || "ID"}`}
    >
      <span className="truncate">{value}</span>
      <Copy className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100" />
      {copied && (
        <span className="text-[9px] text-emerald-600 font-sans">Copied</span>
      )}
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${active ? "bg-white/20" : "bg-slate-100"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "slate",
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "emerald" | "amber" | "rose" | "sky" | "slate";
  onClick?: () => void;
}) {
  const styles = {
    primary: {
      card: "from-primary/10 to-primary/5 border-primary/20",
      icon: "text-primary",
    },
    emerald: {
      card: "from-emerald-500/10 to-emerald-500/5 border-emerald-200/60",
      icon: "text-emerald-700",
    },
    amber: {
      card: "from-amber-500/10 to-amber-500/5 border-amber-200/60",
      icon: "text-amber-700",
    },
    rose: {
      card: "from-rose-500/10 to-rose-500/5 border-rose-200/60",
      icon: "text-rose-700",
    },
    sky: {
      card: "from-sky-500/10 to-sky-500/5 border-sky-200/60",
      icon: "text-sky-700",
    },
    slate: {
      card: "from-slate-500/10 to-slate-500/5 border-slate-200/60",
      icon: "text-slate-700",
    },
  }[accent];

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left w-full transition-all ${styles.card} ${onClick ? "hover:border-slate-300 hover:-translate-y-0.5 cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight tabular-nums">
            {value}
          </p>
          {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-white/80 ${styles.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Wrapper>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <SkeletonBlock className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="h-2 w-1/2" />
          </div>
          <SkeletonBlock className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function planAccent(planName: string, billingCycle: string) {
  if (planName === "Starter") return "border-l-slate-400";
  if (billingCycle === "annual") return "border-l-secondary";
  return "border-l-primary";
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PaymentsContent({
  businesses = [],
}: {
  businesses?: BusinessPaymentRow[];
}) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showFilters, setShowFilters] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [subViewMode, setSubViewMode] = useState<SubViewMode>("grid");
  const [txnSort, setTxnSort] = useState<TxnSort>("date_desc");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [billingFilter, setBillingFilter] = useState<BillingFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [autoDebitFilter, setAutoDebitFilter] =
    useState<AutoDebitFilter>("all");
  const [mandateFilter, setMandateFilter] = useState<MandateFilter>("all");
  const [subStatusFilter, setSubStatusFilter] =
    useState<SubStatusFilter>("all");

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count += 1;
    if (billingFilter !== "all") count += 1;
    if (planFilter !== "all") count += 1;
    if (typeFilter !== "all") count += 1;
    if (dateFilter !== "all") count += 1;
    if (expiryFilter !== "all") count += 1;
    if (autoDebitFilter !== "all") count += 1;
    if (mandateFilter !== "all") count += 1;
    if (subStatusFilter !== "all") count += 1;
    if (search.trim()) count += 1;
    return count;
  }, [
    statusFilter,
    billingFilter,
    planFilter,
    typeFilter,
    dateFilter,
    expiryFilter,
    autoDebitFilter,
    mandateFilter,
    subStatusFilter,
    search,
  ]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setBillingFilter("all");
    setPlanFilter("all");
    setTypeFilter("all");
    setDateFilter("all");
    setExpiryFilter("all");
    setAutoDebitFilter("all");
    setMandateFilter("all");
    setSubStatusFilter("all");
  };

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: paymentRows, error: paymentError } = await supabase
        .from("merchant_payments")
        .select(
          `
 id,
 business_id,
 plan,
 billing_cycle,
 amount_paise,
 currency,
 status,
 payment_type,
 order_id,
 payment_id,
 razorpay_subscription_id,
 source,
 plan_started_at,
 plan_expires_at,
 created_at,
 updated_at,
 Business:business_id (
 businessName,
 workEmail,
 email,
 mobile,
 registrationNumber
 )
 `,
        )
        .order("created_at", { ascending: false });

      if (paymentError) throw new Error(paymentError.message);

      let businessRows = businesses;
      if (businessRows.length === 0) {
        const { data: fetchedBusinesses, error: businessError } = await supabase
          .from("Business")
          .select(
            `id, businessName, workEmail, email, mobile, registrationNumber,
 paymentStatus, paymentId, orderId, selectedPlan, billingCycle,
 planStartedAt, planExpiresAt, razorpaySubscriptionId, subscriptionStatus,
 autoRenewEnabled, mandateStatus, updatedAt, createdAt`,
          )
          .or(
            "paymentStatus.eq.completed,paymentStatus.eq.pending,paymentStatus.eq.failed,paymentId.not.is.null,orderId.not.is.null,razorpaySubscriptionId.not.is.null",
          );

        if (businessError) throw new Error(businessError.message);
        businessRows = fetchedBusinesses ?? [];
      }

      const merged = mergePaymentHistory(paymentRows ?? [], businessRows);
      const subscriptionRows = businessRows
        .map(buildSubscriptionFromBusiness)
        .filter((item): item is SubscriptionRecord => Boolean(item))
        .sort((a, b) => {
          const aTime =
            parseFinderbTimestamp(a.planExpiresAt || a.updatedAt)?.getTime() ??
            0;
          const bTime =
            parseFinderbTimestamp(b.planExpiresAt || b.updatedAt)?.getTime() ??
            0;
          return aTime - bTime;
        });

      setPayments(merged);
      setSubscriptions(subscriptionRows);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payment data",
      );
    } finally {
      setLoading(false);
    }
  }, [businesses]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const analytics = useMemo(
    () => computePaymentAnalytics(payments, subscriptions),
    [payments, subscriptions],
  );

  const revenueChart = useMemo(
    () => buildRevenueChart(payments, 7),
    [payments],
  );

  const statusTotal =
    analytics.completedCount + analytics.pendingCount + analytics.failedCount;

  const matchesSearch = useCallback(
    (...fields: (string | null | undefined)[]) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return fields.some((f) => f && String(f).toLowerCase().includes(query));
    },
    [search],
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (statusFilter !== "all" && payment.status !== statusFilter)
        return false;
      if (billingFilter !== "all" && payment.billingCycle !== billingFilter)
        return false;
      if (
        !matchesPlanFilter(payment.planName, payment.billingCycle, planFilter)
      )
        return false;
      if (typeFilter !== "all" && payment.paymentType !== typeFilter)
        return false;
      if (!matchesDateFilter(payment.createdAt, dateFilter)) return false;
      if (
        !matchesSearch(
          payment.businessName,
          payment.merchantEmail,
          payment.merchantMobile,
          payment.registrationNumber,
          payment.orderId,
          payment.paymentId,
          payment.subscriptionId,
          payment.businessId,
        )
      )
        return false;
      return true;
    });
  }, [
    payments,
    statusFilter,
    billingFilter,
    planFilter,
    typeFilter,
    dateFilter,
    matchesSearch,
  ]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      if (statusFilter !== "all" && sub.paymentStatus !== statusFilter)
        return false;
      if (billingFilter !== "all" && sub.billingCycle !== billingFilter)
        return false;
      if (!matchesPlanFilter(sub.planName, sub.billingCycle, planFilter))
        return false;
      if (!matchesExpiryFilter(sub.planExpiresAt, expiryFilter)) return false;
      if (autoDebitFilter === "enabled" && !sub.autoRenewEnabled) return false;
      if (autoDebitFilter === "off" && sub.autoRenewEnabled) return false;
      if (mandateFilter === "active" && sub.mandateStatus !== "active")
        return false;
      if (
        mandateFilter === "pending" &&
        !["pending", "created"].includes(sub.mandateStatus)
      )
        return false;
      if (
        mandateFilter === "none" &&
        sub.mandateStatus !== "none" &&
        sub.mandateStatus
      )
        return false;
      if (subStatusFilter !== "all") {
        const status = sub.subscriptionStatus || "none";
        if (subStatusFilter !== status) return false;
      }
      if (
        !matchesSearch(
          sub.businessName,
          sub.merchantEmail,
          sub.merchantMobile,
          sub.registrationNumber,
          sub.orderId,
          sub.paymentId,
          sub.subscriptionId,
          sub.businessId,
        )
      )
        return false;
      return true;
    });
  }, [
    subscriptions,
    statusFilter,
    billingFilter,
    planFilter,
    expiryFilter,
    autoDebitFilter,
    mandateFilter,
    subStatusFilter,
    matchesSearch,
  ]);

  const filteredRevenuePaise = useMemo(
    () => sumCompletedRevenue(filteredPayments),
    [filteredPayments],
  );

  const sortedPayments = useMemo(() => {
    const list = [...filteredPayments];
    list.sort((a, b) => {
      if (txnSort === "amount_desc") return b.amountPaise - a.amountPaise;
      if (txnSort === "amount_asc") return a.amountPaise - b.amountPaise;
      const aTime = parseFinderbTimestamp(a.createdAt)?.getTime() ?? 0;
      const bTime = parseFinderbTimestamp(b.createdAt)?.getTime() ?? 0;
      return txnSort === "date_asc" ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [filteredPayments, txnSort]);

  const opens = useMemo(() => {
    const items: {
      id: string;
      type: "pending" | "failed" | "expiring" | "mandate";
      title: string;
      detail: string;
      severity: "high" | "medium";
    }[] = [];

    payments
      .filter((p) => p.status === "pending")
      .slice(0, 10)
      .forEach((p) => {
        items.push({
          id: `pending-${p.id}`,
          type: "pending",
          title: `Pending payment — ${p.businessName}`,
          detail: `${p.amountDisplay} · ${p.planName}`,
          severity: "medium",
        });
      });

    payments
      .filter((p) => p.status === "failed")
      .slice(0, 10)
      .forEach((p) => {
        items.push({
          id: `failed-${p.id}`,
          type: "failed",
          title: `Failed payment — ${p.businessName}`,
          detail: `${p.amountDisplay} · ${formatDateTime(p.createdAt)}`,
          severity: "high",
        });
      });

    subscriptions
      .filter((s) => {
        const days = daysUntilExpiry(s.planExpiresAt);
        return days !== null && days >= 0 && days <= 7;
      })
      .forEach((s) => {
        const days = daysUntilExpiry(s.planExpiresAt);
        items.push({
          id: `expiring-${s.businessId}`,
          type: "expiring",
          title: `Expiring soon — ${s.businessName}`,
          detail: `${s.planName} · ${days} day${days === 1 ? "" : "s"} left`,
          severity: "high",
        });
      });

    subscriptions
      .filter((s) => ["pending", "created"].includes(s.mandateStatus))
      .slice(0, 5)
      .forEach((s) => {
        items.push({
          id: `mandate-${s.businessId}`,
          type: "mandate",
          title: `Mandate pending — ${s.businessName}`,
          detail: `${s.planName} · Auto-debit setup incomplete`,
          severity: "medium",
        });
      });

    return items;
  }, [payments, subscriptions]);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    {
      id: "transactions",
      label: "Transactions",
      count: filteredPayments.length,
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      count: filteredSubscriptions.length,
    },
    { id: "tracking", label: "Opens & tracking", count: opens.length },
  ];

  const filterPanel = (
    <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showFilters ? "" : "-rotate-90"}`}
            />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search merchant, email, mobile, order ID, payment ID, subscription ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            <FilterChip
              label="Completed"
              active={statusFilter === "completed"}
              onClick={() => setStatusFilter("completed")}
              count={analytics.completedCount}
            />
            <FilterChip
              label="Pending"
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
              count={analytics.pendingCount}
            />
            <FilterChip
              label="Failed"
              active={statusFilter === "failed"}
              onClick={() => setStatusFilter("failed")}
              count={analytics.failedCount}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SelectFilter
              label="Billing"
              value={billingFilter}
              onChange={(v) => setBillingFilter(v as BillingFilter)}
              options={[
                { value: "all", label: "All cycles" },
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
            <SelectFilter
              label="Plan"
              value={planFilter}
              onChange={(v) => setPlanFilter(v as PlanFilter)}
              options={PLAN_OPTIONS}
            />
            <SelectFilter
              label="Payment type"
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
              options={[
                { value: "all", label: "All types" },
                { value: "one_time", label: "One-time" },
                { value: "subscription_auth", label: "Auto-debit auth" },
                { value: "subscription_renewal", label: "Renewal" },
              ]}
            />
            <SelectFilter
              label="Date range"
              value={dateFilter}
              onChange={(v) => setDateFilter(v as DateFilter)}
              options={[
                { value: "all", label: "All time" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
                { value: "mtd", label: "Month to date" },
              ]}
            />
            <SelectFilter
              label="Expiry"
              value={expiryFilter}
              onChange={(v) => setExpiryFilter(v as ExpiryFilter)}
              options={[
                { value: "all", label: "Any expiry" },
                { value: "expiring_7d", label: "Expiring ≤ 7 days" },
                { value: "expiring_30d", label: "Expiring ≤ 30 days" },
                { value: "expired", label: "Expired" },
              ]}
            />
            <SelectFilter
              label="Auto-debit"
              value={autoDebitFilter}
              onChange={(v) => setAutoDebitFilter(v as AutoDebitFilter)}
              options={[
                { value: "all", label: "Any" },
                { value: "enabled", label: "Enabled" },
                { value: "off", label: "Off" },
              ]}
            />
            <SelectFilter
              label="Mandate"
              value={mandateFilter}
              onChange={(v) => setMandateFilter(v as MandateFilter)}
              options={[
                { value: "all", label: "Any" },
                { value: "active", label: "Active" },
                { value: "pending", label: "Pending" },
                { value: "none", label: "None" },
              ]}
            />
            <SelectFilter
              label="Subscription"
              value={subStatusFilter}
              onChange={(v) => setSubStatusFilter(v as SubStatusFilter)}
              options={[
                { value: "all", label: "Any status" },
                { value: "active", label: "Active" },
                { value: "cancelled", label: "Cancelled" },
                { value: "pending", label: "Pending" },
                { value: "none", label: "Not set" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="admin-platform-hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="admin-badge bg-teal-50 text-teal-800 border-teal-100">
                Razorpay · Ledger
              </span>
              {opens.length > 0 && (
                <span className="admin-badge bg-amber-50 text-amber-800 border-amber-200">
                  {opens.length} open
                </span>
              )}
            </div>
            <h1 className="admin-page-title">Payments & Subscriptions</h1>
            <p className="admin-page-subtitle">
              Revenue, mandates, subscriptions, and Razorpay audit trail.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="admin-metric-chip">
                Success rate{" "}
                <strong>
                  {statusTotal
                    ? `${Math.round((analytics.completedCount / statusTotal) * 100)}%`
                    : "—"}
                </strong>
              </span>
              <span className="admin-metric-chip">
                Records <strong>{payments.length}</strong>
              </span>
              <span className="admin-metric-chip">
                Merchants <strong>{subscriptions.length}</strong>
              </span>
              {lastRefreshed && (
                <span className="admin-metric-chip">
                  Synced{" "}
                  <strong>
                    {lastRefreshed.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="admin-btn-primary self-start shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing…" : "Refresh data"}
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert-error flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Opens alert strip */}
      {opens.length > 0 && (
        <div className="admin-card px-5 py-4 border-amber-200/80 bg-amber-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/15">
                <Zap className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {opens.length} open item{opens.length !== 1 ? "s" : ""} need
                  attention
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {analytics.pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("pending");
                        setActiveTab("transactions");
                      }}
                      className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-semibold hover:bg-amber-200 transition-colors"
                    >
                      {analytics.pendingCount} pending
                    </button>
                  )}
                  {analytics.failedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("failed");
                        setActiveTab("transactions");
                      }}
                      className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-semibold hover:bg-rose-200 transition-colors"
                    >
                      {analytics.failedCount} failed
                    </button>
                  )}
                  {analytics.expiring7d > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpiryFilter("expiring_7d");
                        setActiveTab("subscriptions");
                      }}
                      className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] font-semibold hover:bg-orange-200 transition-colors"
                    >
                      {analytics.expiring7d} expiring
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("tracking")}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              View tracking
            </button>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total revenue"
          value={formatAmountInr(analytics.totalRevenuePaise)}
          sub={`MTD ${formatAmountInr(analytics.mtdRevenuePaise)}`}
          icon={Wallet}
          accent="primary"
          onClick={() => setActiveTab("overview")}
        />
        <StatCard
          label="Completed"
          value={analytics.completedCount}
          sub={`Avg ${formatAmountInr(analytics.avgTransactionPaise)} / txn`}
          icon={TrendingUp}
          accent="emerald"
          onClick={() => {
            setStatusFilter("completed");
            setActiveTab("transactions");
          }}
        />
        <StatCard
          label="Active subscriptions"
          value={analytics.activeSubscriptions}
          sub={`${analytics.autoDebitEnabled} with auto-debit`}
          icon={CreditCard}
          accent="sky"
          onClick={() => setActiveTab("subscriptions")}
        />
        <StatCard
          label="Opens"
          value={analytics.opensCount}
          sub={`${analytics.expiring7d} expiring ≤7d · ${analytics.failedCount} failed`}
          icon={AlertCircle}
          accent={analytics.opensCount > 0 ? "amber" : "slate"}
          onClick={() => setActiveTab("tracking")}
        />
      </div>

      {/* Financial pulse — revenue chart + status mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 admin-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                7-day revenue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Completed payments per day (IST)
              </p>
            </div>
            <span className="text-base font-bold text-slate-900 tabular-nums">
              {formatAmountInr(
                revenueChart.reduce((s, d) => s + d.amountPaise, 0),
              )}
              <span className="text-[10px] font-normal text-slate-400 ml-1">
                week
              </span>
            </span>
          </div>
          <AdminBarChart
            height={180}
            mode="single"
            series={[{ key: "amount", label: "Revenue", color: "#0d9488" }]}
            data={revenueChart.map((day) => ({
              label: day.label,
              values: { amount: day.amountPaise },
            }))}
            formatValue={(n) => {
              const rupees = n / 100;
              if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
              if (rupees >= 1000) return `₹${Math.round(rupees / 1000)}k`;
              return `₹${Math.round(rupees)}`;
            }}
            formatTooltip={(point) => formatAmountInr(point.values.amount ?? 0)}
          />
        </div>

        <div className="lg:col-span-4 admin-card p-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-teal-600" />
            Payment status mix
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            {statusTotal} total attempts
          </p>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
            {statusTotal > 0 && (
              <>
                <div
                  className="bg-emerald-500 transition-all"
                  style={{
                    width: `${(analytics.completedCount / statusTotal) * 100}%`,
                  }}
                  title="Completed"
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{
                    width: `${(analytics.pendingCount / statusTotal) * 100}%`,
                  }}
                  title="Pending"
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{
                    width: `${(analytics.failedCount / statusTotal) * 100}%`,
                  }}
                  title="Failed"
                />
              </>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {[
              {
                label: "Completed",
                count: analytics.completedCount,
                color: "bg-emerald-500",
                filter: "completed" as StatusFilter,
              },
              {
                label: "Pending",
                count: analytics.pendingCount,
                color: "bg-amber-400",
                filter: "pending" as StatusFilter,
              },
              {
                label: "Failed",
                count: analytics.failedCount,
                color: "bg-rose-500",
                filter: "failed" as StatusFilter,
              },
            ].map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => {
                  setStatusFilter(row.filter);
                  setActiveTab("transactions");
                }}
                className="w-full flex items-center justify-between text-[11px] hover:bg-slate-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${row.color}`} />
                  {row.label}
                </span>
                <span className="font-bold tabular-nums text-slate-900">
                  {row.count}
                  <span className="text-slate-400 font-normal ml-1">
                    (
                    {statusTotal
                      ? Math.round((row.count / statusTotal) * 100)
                      : 0}
                    %)
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Pending",
            value: analytics.pendingCount,
            tone: "text-amber-700 bg-amber-50 border-amber-100",
          },
          {
            label: "Failed",
            value: analytics.failedCount,
            tone: "text-rose-700 bg-rose-50 border-rose-100",
          },
          {
            label: "Expiring 7d",
            value: analytics.expiring7d,
            tone: "text-orange-700 bg-orange-50 border-orange-100",
          },
          {
            label: "Expiring 30d",
            value: analytics.expiring30d,
            tone: "text-amber-700 bg-amber-50 border-amber-100",
          },
          {
            label: "Expired",
            value: analytics.expiredPlans,
            tone: "text-rose-700 bg-rose-50 border-rose-100",
          },
          {
            label: "Merchants",
            value: subscriptions.length,
            tone: "text-slate-700 bg-slate-50 border-slate-100",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border px-4 py-3 text-center ${item.tone}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
              {item.label}
            </p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Plan & billing split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Revenue by billing
          </h3>
          <div className="mt-4 space-y-3">
            {[
              {
                label: "Monthly",
                amount: analytics.monthlyRevenuePaise,
                pct: analytics.totalRevenuePaise
                  ? (analytics.monthlyRevenuePaise /
                      analytics.totalRevenuePaise) *
                    100
                  : 0,
              },
              {
                label: "Annual",
                amount: analytics.annualRevenuePaise,
                pct: analytics.totalRevenuePaise
                  ? (analytics.annualRevenuePaise /
                      analytics.totalRevenuePaise) *
                    100
                  : 0,
              },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-slate-700">
                    {row.label}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {formatAmountInr(row.amount)} · {row.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-all"
                    style={{ width: `${Math.min(row.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active plans
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Starter", count: analytics.planBreakdown.starter },
              { label: "Growth", count: analytics.planBreakdown.growthMonthly },
              { label: "Pro Annual", count: analytics.planBreakdown.proAnnual },
            ].map((plan) => (
              <div
                key={plan.label}
                className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center"
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  {plan.label}
                </p>
                <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {plan.count}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-slate-100/80 border border-slate-200/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-900"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${activeTab === tab.id ? "bg-slate-100" : "bg-slate-200/60"}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filterPanel}

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Recent transactions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest {Math.min(8, filteredPayments.length)} payments
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                <LoadingSkeleton />
              ) : filteredPayments.length === 0 ? (
                <p className="px-5 py-10 text-center text-slate-500 text-sm">
                  No transactions match filters.
                </p>
              ) : (
                filteredPayments.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {p.businessName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatDateTime(p.createdAt)} · {p.planName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {p.amountDisplay}
                      </p>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md border text-[9px] font-semibold capitalize ${statusBadgeClass(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredPayments.length > 8 && (
              <div className="px-5 py-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab("transactions")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all {filteredPayments.length} transactions →
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Subscription health
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sorted by nearest expiry
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                <LoadingSkeleton />
              ) : filteredSubscriptions.length === 0 ? (
                <p className="px-5 py-10 text-center text-slate-500 text-sm">
                  No subscriptions match filters.
                </p>
              ) : (
                filteredSubscriptions.slice(0, 8).map((s) => {
                  const urgency = getExpiryUrgency(s.planExpiresAt);
                  const days = daysUntilExpiry(s.planExpiresAt);
                  return (
                    <div
                      key={s.businessId}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {s.businessName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {s.planName} ·{" "}
                          {s.autoRenewEnabled ? "Auto-debit on" : "Manual"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-slate-600">
                          {formatDateTime(s.planExpiresAt)}
                        </p>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md border text-[9px] font-semibold ${expiryBadgeClass(urgency)}`}
                        >
                          {days === null
                            ? "No expiry"
                            : days < 0
                              ? "Expired"
                              : `${days}d left`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {filteredSubscriptions.length > 8 && (
              <div className="px-5 py-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab("subscriptions")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all {filteredSubscriptions.length} subscriptions →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Transaction ledger
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {sortedPayments.length} of {payments.length} records · click row
                to expand
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px]">
                <span className="text-emerald-700/70">Filtered revenue </span>
                <span className="font-bold text-emerald-800 tabular-nums">
                  {formatAmountInr(filteredRevenuePaise)}
                </span>
              </div>
              <select
                value={txnSort}
                onChange={(e) => setTxnSort(e.target.value as TxnSort)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-800"
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50/80 text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Merchant</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Order ID</th>
                  <th className="px-4 py-3 font-semibold">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      Loading transactions…
                    </td>
                  </tr>
                ) : sortedPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No transactions match your filters.
                    </td>
                  </tr>
                ) : (
                  sortedPayments.map((payment) => {
                    const isExpanded = expandedId === payment.id;
                    return (
                      <Fragment key={payment.id}>
                        <tr
                          className="hover:bg-slate-50/60 align-top cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : payment.id)
                          }
                        >
                          <td className="px-4 py-3.5 text-slate-400">
                            <ChevronRight
                              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                            {formatDateTime(payment.createdAt)}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-900">
                              {payment.businessName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {payment.merchantEmail}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-800">
                              {payment.planName}
                            </p>
                            <p className="text-[10px] capitalize text-slate-500">
                              {payment.billingCycle}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 font-bold tabular-nums text-slate-900">
                            {payment.amountDisplay}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${statusBadgeClass(payment.status)}`}
                            >
                              {payment.status}
                            </span>
                            {payment.source && (
                              <p className="mt-1 text-[9px] capitalize text-slate-400">
                                {payment.source}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {paymentTypeLabel(payment.paymentType)}
                          </td>
                          <td className="px-4 py-3.5 max-w-[130px]">
                            <CopyableId
                              value={payment.orderId}
                              label="order ID"
                            />
                          </td>
                          <td className="px-4 py-3.5 max-w-[130px]">
                            <CopyableId
                              value={payment.paymentId}
                              label="payment ID"
                            />
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/40">
                            <td colSpan={9} className="px-5 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                  {
                                    label: "Business ID",
                                    value: payment.businessId,
                                  },
                                  {
                                    label: "Mobile",
                                    value: payment.merchantMobile,
                                  },
                                  {
                                    label: "Registration #",
                                    value: payment.registrationNumber,
                                  },
                                  {
                                    label: "Subscription ID",
                                    value: payment.subscriptionId,
                                  },
                                  {
                                    label: "Plan started",
                                    value: formatDateTime(
                                      payment.planStartedAt,
                                    ),
                                  },
                                  {
                                    label: "Plan expires",
                                    value: formatDateTime(
                                      payment.planExpiresAt,
                                    ),
                                  },
                                  {
                                    label: "Updated",
                                    value: formatDateTime(payment.updatedAt),
                                  },
                                  { label: "Record ID", value: payment.id },
                                ].map((field) => (
                                  <div
                                    key={field.label}
                                    className="rounded-xl bg-white border border-slate-100 px-3 py-2.5"
                                  >
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                      {field.label}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-800 break-all mt-1">
                                      {field.value || "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <strong className="text-slate-800">
                {filteredSubscriptions.length}
              </strong>{" "}
              subscription{filteredSubscriptions.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setSubViewMode("grid")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${subViewMode === "grid" ? "bg-white text-slate-900" : "text-slate-500"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setSubViewMode("table")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${subViewMode === "table" ? "bg-white text-slate-900" : "text-slate-500"}`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
            </div>
          </div>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <LoadingSkeleton />
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">
                No subscriptions match your filters
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Try clearing filters or refreshing data
              </p>
            </div>
          ) : subViewMode === "table" ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50/80 text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Merchant</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Payment</th>
                      <th className="px-4 py-3 font-semibold">Subscription</th>
                      <th className="px-4 py-3 font-semibold">Auto-debit</th>
                      <th className="px-4 py-3 font-semibold">Expires</th>
                      <th className="px-4 py-3 font-semibold">Mandate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredSubscriptions.map((sub) => {
                      const urgency = getExpiryUrgency(sub.planExpiresAt);
                      const days = daysUntilExpiry(sub.planExpiresAt);
                      return (
                        <tr
                          key={sub.businessId}
                          className="hover:bg-slate-50/60 align-top"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {sub.businessName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {sub.merchantEmail}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{sub.planName}</p>
                            <p className="text-[10px] capitalize text-slate-500">
                              {sub.billingCycle}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${statusBadgeClass(sub.paymentStatus)}`}
                            >
                              {sub.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-700">
                            {sub.subscriptionStatus || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                sub.autoRenewEnabled
                                  ? "text-emerald-700 font-medium"
                                  : "text-slate-400"
                              }
                            >
                              {sub.autoRenewEnabled ? "On" : "Off"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-700 whitespace-nowrap">
                              {formatDateTime(sub.planExpiresAt)}
                            </p>
                            <span
                              className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${expiryBadgeClass(urgency)}`}
                            >
                              {days === null
                                ? "—"
                                : days < 0
                                  ? "Expired"
                                  : `${days}d`}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-600">
                            {sub.mandateStatus}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSubscriptions.map((sub) => {
                const urgency = getExpiryUrgency(sub.planExpiresAt);
                const days = daysUntilExpiry(sub.planExpiresAt);
                const isExpanded = expandedSubId === sub.businessId;
                return (
                  <div
                    key={sub.businessId}
                    className={`rounded-2xl border border-slate-200/80 border-l-4 ${planAccent(sub.planName, sub.billingCycle)} bg-white overflow-hidden hover:border-slate-300 transition-shadow`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {sub.businessName}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {sub.merchantEmail}
                          </p>
                          {sub.registrationNumber && (
                            <p className="font-mono text-[10px] text-slate-400 mt-1">
                              {sub.registrationNumber}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-semibold capitalize ${statusBadgeClass(sub.paymentStatus)}`}
                        >
                          {sub.paymentStatus}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[9px] text-slate-400 uppercase">
                            Plan
                          </p>
                          <p className="text-[11px] font-semibold text-slate-800 mt-0.5">
                            {sub.planName}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[9px] text-slate-400 uppercase">
                            Valid until
                          </p>
                          <p className="text-[11px] font-semibold text-slate-800 mt-0.5">
                            {formatDateTime(sub.planExpiresAt)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[9px] text-slate-400 uppercase">
                            Subscription
                          </p>
                          <p className="text-[11px] font-semibold capitalize text-slate-800 mt-0.5">
                            {sub.subscriptionStatus || "—"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-[9px] text-slate-400 uppercase">
                            Auto-debit
                          </p>
                          <p
                            className={`text-[11px] font-semibold mt-0.5 ${sub.autoRenewEnabled ? "text-emerald-700" : "text-slate-500"}`}
                          >
                            {sub.autoRenewEnabled ? "Enabled" : "Off"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${expiryBadgeClass(urgency)}`}
                        >
                          <Calendar className="w-3 h-3" />
                          {days === null
                            ? "No expiry"
                            : days < 0
                              ? "Expired"
                              : `${days} days remaining`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSubId(isExpanded ? null : sub.businessId)
                          }
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          {isExpanded ? "Hide IDs" : "Razorpay IDs"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                          <div className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-400">Payment ID</span>
                            <CopyableId value={sub.paymentId} />
                          </div>
                          <div className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-400">Order ID</span>
                            <CopyableId value={sub.orderId} />
                          </div>
                          <div className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-400">
                              Subscription ID
                            </span>
                            <CopyableId value={sub.subscriptionId} />
                          </div>
                          <div className="flex justify-between gap-2 text-[11px]">
                            <span className="text-slate-400">Mandate</span>
                            <span className="capitalize text-slate-700">
                              {sub.mandateStatus}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "tracking" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Action queue — Opens
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Items requiring review or follow-up
              </p>
            </div>
            {opens.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-900">All clear</p>
                <p className="text-xs text-slate-500 mt-1">
                  No pending opens at the moment.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {opens.map((item) => (
                  <div
                    key={item.id}
                    className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${item.severity === "high" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}
                    >
                      {item.type === "expiring" ? (
                        <Calendar className="w-4 h-4" />
                      ) : item.type === "failed" ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.detail}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${item.severity === "high" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Payment activity timeline
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological audit trail
              </p>
            </div>
            <div className="p-5 space-y-0">
              {loading ? (
                <LoadingSkeleton />
              ) : filteredPayments.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">
                  No activity to show.
                </p>
              ) : (
                filteredPayments.slice(0, 20).map((p, i) => (
                  <div key={p.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${p.status === "completed" ? "bg-emerald-500" : p.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`}
                      />
                      {i < Math.min(19, filteredPayments.length - 1) && (
                        <div className="w-px flex-1 bg-slate-200 my-1" />
                      )}
                    </div>
                    <div className="pb-6 min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {p.businessName}
                        </p>
                        <span className="text-sm font-bold tabular-nums text-slate-900">
                          {p.amountDisplay}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDateTime(p.createdAt)} · {p.planName} ·{" "}
                        {paymentTypeLabel(p.paymentType)}
                      </p>
                      <span
                        className={`inline-flex mt-2 px-2 py-0.5 rounded-md border text-[9px] font-semibold capitalize ${statusBadgeClass(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
