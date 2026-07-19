"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Layers,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { formatActivityDate, formatActivityTime } from "../lib/formatDateTime";
import type { DashboardStats } from "../lib/dashboardStats";
import type { MerchantRequest } from "../lib/merchantRequest";
import AdminBarChart from "./AdminBarChart";

type ActivityItem = {
  id: string;
  type: "user" | "merchant" | "lead";
  title: string;
  description: string;
  timestamp: string;
};

type ChartDay = { label: string; users: number; merchants: number };

type LoginLog = {
  id: string;
  admin_email: string;
  login_time: string;
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "emerald" | "sky" | "amber" | "rose" | "slate";
  onClick?: () => void;
}) {
  const styles = {
    primary: { kpi: "admin-kpi-primary", icon: "bg-teal-600 text-white" },
    emerald: { kpi: "admin-kpi-success", icon: "bg-emerald-500 text-white" },
    sky: { kpi: "admin-kpi-neutral", icon: "bg-slate-600 text-white" },
    amber: { kpi: "admin-kpi-secondary", icon: "bg-amber-500 text-white" },
    rose: { kpi: "admin-kpi-secondary", icon: "bg-rose-500 text-white" },
    slate: { kpi: "admin-kpi-neutral", icon: "bg-slate-500 text-white" },
  }[accent];

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`admin-kpi ${styles.kpi} text-left w-full group ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="admin-kpi-label">{label}</p>
          <p className="admin-kpi-value">{value}</p>
          {sub && <p className="admin-kpi-meta">{sub}</p>}
        </div>
        <div className={`p-1.5 rounded-lg ${styles.icon}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
    </Wrapper>
  );
}

function MiniMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 mt-0.5 tabular-nums tracking-tight leading-none">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-slate-500 mt-1 font-normal leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}

function QuickLink({
  label,
  description,
  icon: Icon,
  onClick,
  badge,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-slate-300 hover:bg-slate-50 transition-colors w-full"
    >
      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-950 text-[10px] font-bold tabular-nums">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-zinc-950 shrink-0" />
    </button>
  );
}

export default function DashboardContent({
  setActiveTab,
  merchantRequests,
  handleApprove,
  handleReject,
  chartData,
  recentActivities,
  stats,
  platformDateLabel,
  platformTimeLabel,
  loginLogs,
  maintenanceMode,
  canViewFinancialData,
}: {
  setActiveTab: (tab: string) => void;
  merchantRequests: MerchantRequest[];
  handleApprove: (req: MerchantRequest) => void | Promise<void>;
  handleReject: (req: MerchantRequest) => void | Promise<void>;
  chartData: ChartDay[];
  recentActivities: ActivityItem[];
  stats: DashboardStats;
  platformDateLabel: string;
  platformTimeLabel: string;
  loginLogs: LoginLog[];
  maintenanceMode: boolean;
  canViewFinancialData: boolean;
}) {
  const [showRevenue, setShowRevenue] = useState(false);
  const [activityFilter, setActivityFilter] = useState<
    "all" | "user" | "merchant" | "lead"
  >("all");

  const chartPeak = chartData.reduce(
    (best, d) =>
      d.users + d.merchants > best.total
        ? { label: d.label, total: d.users + d.merchants }
        : best,
    { label: "—", total: 0 },
  );

  const filteredActivities = useMemo(() => {
    if (activityFilter === "all") return recentActivities;
    return recentActivities.filter((a) => a.type === activityFilter);
  }, [recentActivities, activityFilter]);

  const activityCounts = useMemo(
    () => ({
      all: recentActivities.length,
      user: recentActivities.filter((a) => a.type === "user").length,
      merchant: recentActivities.filter((a) => a.type === "merchant").length,
      lead: recentActivities.filter((a) => a.type === "lead").length,
    }),
    [recentActivities],
  );

  return (
    <div className="space-y-4">
      <div className="admin-platform-hero">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {maintenanceMode ? (
                <span className="admin-status-pill admin-status-warn">
                  Maintenance
                </span>
              ) : (
                <span className="admin-status-pill admin-status-live">
                  <span className="admin-status-dot" />
                  Platform live
                </span>
              )}
              {platformDateLabel && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1 tabular-nums font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  {platformDateLabel}
                  {platformTimeLabel && ` · ${platformTimeLabel}`}
                </span>
              )}
            </div>
            <h1 className="admin-page-title !mb-0">Dashboard</h1>
            <p className="admin-page-subtitle !mt-1">
              {canViewFinancialData
                ? "Partners, listing approvals, leads, and revenue at a glance."
                : "Partners, listing approvals, leads, and platform activity at a glance."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("Business Onboarding")}
              className="admin-btn-secondary"
            >
              Onboard business
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("Merchants")}
              className="admin-btn-primary"
            >
              <Building2 className="w-4 h-4" />
              Partner queue
              {stats.merchants.pendingKyc > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/25 text-[10px] font-bold">
                  {stats.merchants.pendingKyc}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Registered users"
          value={stats.users.total.toLocaleString()}
          sub={`+${stats.users.weekNew} this week · ${stats.users.todayNew} today`}
          icon={Users}
          accent="sky"
          onClick={() => setActiveTab("Users")}
        />
        <StatCard
          label="Active partners"
          value={stats.merchants.total.toLocaleString()}
          sub={`${stats.merchants.activeListings} live listings · ${stats.merchants.verified} verified`}
          icon={Building2}
          accent="emerald"
          onClick={() => setActiveTab("Merchants")}
        />
        <StatCard
          label="Total leads"
          value={stats.leads.total.toLocaleString()}
          sub={`+${stats.leads.weekNew} this week · ${stats.leads.profile} profile`}
          icon={Zap}
          accent="amber"
          onClick={() => setActiveTab("Leads")}
        />
        <StatCard
          label="Weekly sign-ups"
          value={stats.weekSignups.total.toLocaleString()}
          sub={`${stats.weekSignups.users} users · ${stats.weekSignups.merchants} partners`}
          icon={UserPlus}
          accent="primary"
        />
      </div>

      {/* Secondary stats row */}
      <div
        className={`grid grid-cols-2 gap-3 ${
          canViewFinancialData ? "sm:grid-cols-3 lg:grid-cols-6" : ""
        }`}
      >
        <MiniMetric
          label="Awaiting listing review"
          value={stats.merchants.pendingKyc}
          hint="Pending admin approval"
        />
        {canViewFinancialData && (
          <>
            <MiniMetric
              label="Paid partners"
              value={stats.merchants.paid}
              hint="Completed payment"
            />
            <MiniMetric
              label="Payment success"
              value={`${stats.payments.successRate}%`}
              hint="Of all attempts"
            />
            <MiniMetric
              label="Active subs"
              value={stats.payments.activeSubscriptions}
              hint="Razorpay active"
            />
            <MiniMetric
              label="Opens"
              value={stats.payments.opensCount}
              hint="Needs attention"
            />
          </>
        )}
        <MiniMetric
          label="Categories"
          value={stats.content.categories}
          hint={`${stats.content.blogs} blogs · ${stats.content.jobs} jobs`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Growth chart */}
        <div
          className={`admin-card overflow-hidden ${
            canViewFinancialData ? "xl:col-span-8" : "xl:col-span-12"
          }`}
        >
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                Growth trajectory
              </h3>
              <p className="admin-card-description">
                New registrations · 7 days · peak {chartPeak.label} (
                {chartPeak.total})
              </p>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-700" />
                Users ({stats.weekSignups.users})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" />
                Partners ({stats.weekSignups.merchants})
              </span>
            </div>
          </div>
          <div className="px-3 pt-2 pb-3">
            <AdminBarChart
              height={200}
              series={[
                { key: "users", label: "Users", color: "#334155" },
                { key: "merchants", label: "Partners", color: "#0d9488" },
              ]}
              data={chartData.map((d) => ({
                label: d.label,
                values: { users: d.users, merchants: d.merchants },
              }))}
            />
            <div className="mt-2 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 px-1">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Leads (7d)
                </p>
                <p className="text-base font-bold text-slate-900 tabular-nums">
                  {stats.leads.weekNew}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Category leads
                </p>
                <p className="text-base font-bold text-slate-900 tabular-nums">
                  {stats.leads.category}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Profile leads
                </p>
                <p className="text-base font-bold text-slate-900 tabular-nums">
                  {stats.leads.profile}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plan mix is financial/subscription data. */}
        {canViewFinancialData && (
          <div className="xl:col-span-4 admin-card p-4">
            <h3 className="admin-card-title flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              Partner plan mix
            </h3>
            <p className="admin-card-description mb-3">
              Active partner subscriptions
            </p>
            <div className="space-y-3">
              {[
                {
                  label: "Starter",
                  count: stats.plans.starter,
                  color: "bg-slate-400",
                },
                {
                  label: "Growth — Monthly",
                  count: stats.plans.growthMonthly,
                  color: "bg-teal-600",
                },
                {
                  label: "Pro — Annual",
                  count: stats.plans.proAnnual,
                  color: "bg-slate-600",
                },
              ].map((plan) => {
                const pct = stats.merchants.total
                  ? (plan.count / stats.merchants.total) * 100
                  : 0;
                return (
                  <div key={plan.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-700">
                        {plan.label}
                      </span>
                      <span className="text-slate-500 tabular-nums font-semibold">
                        {plan.count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${plan.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("Payments & Subscriptions")}
              className="mt-4 w-full admin-btn-secondary"
            >
              <CreditCard className="w-4 h-4" />
              Open payments ledger
            </button>
          </div>
        )}
      </div>

      {/* Revenue */}
      {canViewFinancialData && (
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-teal-700" />
                Platform revenue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Subscription payments · hidden by default
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRevenue((v) => !v)}
              className="admin-btn-secondary !py-1.5 !text-xs"
            >
              {showRevenue ? "Hide revenue" : "Show revenue"}
            </button>
          </div>
          {showRevenue ? (
            <div className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                {[
                  {
                    label: "Total revenue",
                    value: stats.payments.totalRevenueDisplay,
                    tone: "border-slate-200 bg-slate-50",
                  },
                  {
                    label: "MTD revenue",
                    value: stats.payments.mtdRevenueDisplay,
                    tone: "border-slate-200 bg-white",
                  },
                  {
                    label: "Completed",
                    value: stats.payments.completedCount,
                    tone: "border-emerald-200 bg-emerald-50/50",
                  },
                  {
                    label: "Pending",
                    value: stats.payments.pendingCount,
                    tone: "border-amber-200 bg-amber-50/50",
                  },
                  {
                    label: "Failed",
                    value: stats.payments.failedCount,
                    tone: "border-rose-200 bg-rose-50/50",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-lg border px-3 py-2.5 ${item.tone}`}
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums leading-none">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {stats.payments.expiring7d} expiring ≤7d ·{" "}
                  {stats.payments.autoDebitEnabled} auto-debit enabled
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("Payments & Subscriptions")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                >
                  Full financial ledger <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-5 text-center">
              <div className="inline-flex p-2 rounded-lg bg-slate-100 text-slate-400 mb-1.5">
                <Shield className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-600">
                Revenue figures are concealed
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click &quot;Show revenue&quot; to view payment totals
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">
          Quick navigation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink
            label="Partner management"
            description="Profiles, listing approval, verification badges"
            icon={Building2}
            onClick={() => setActiveTab("Merchants")}
            badge={stats.merchants.pendingKyc || undefined}
          />
          {canViewFinancialData && (
            <QuickLink
              label="Payments & subscriptions"
              description="Ledger, filters, opens tracking"
              icon={CreditCard}
              onClick={() => setActiveTab("Payments & Subscriptions")}
              badge={stats.payments.opensCount || undefined}
            />
          )}
          <QuickLink
            label="Lead inbox"
            description="Profile and category enquiries"
            icon={Activity}
            onClick={() => setActiveTab("Leads")}
            badge={stats.leads.weekNew ? `+${stats.leads.weekNew}` : undefined}
          />
          <QuickLink
            label="Categories"
            description="Marketplace taxonomy and slots"
            icon={Layers}
            onClick={() => setActiveTab("Categories")}
          />
          <QuickLink
            label="Blogs"
            description="Editorial content management"
            icon={FileText}
            onClick={() => setActiveTab("Blogs")}
            badge={stats.content.blogs}
          />
          <QuickLink
            label="FinderB Jobs"
            description="Job listings on platform"
            icon={Briefcase}
            onClick={() => setActiveTab("FinderB Jobs")}
            badge={stats.content.jobs}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Verification queue */}
        <div className="xl:col-span-5 admin-card flex flex-col overflow-hidden">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Listing approval queue
              </h3>
              <p className="admin-card-description">
                {merchantRequests.length} partner
                {merchantRequests.length !== 1 ? "s" : ""} awaiting listing
                approval
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("Merchants")}
              className="admin-link"
            >
              Open
            </button>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[280px] custom-scrollbar">
            {merchantRequests.length > 0 ? (
              merchantRequests.slice(0, 8).map((merchant) => (
                <div
                  key={merchant.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="admin-avatar shrink-0">
                      {merchant.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {merchant.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {merchant.category}
                        {merchant.email ? ` · ${merchant.email}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Requested {merchant.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApprove(merchant)}
                      className="admin-icon-btn !text-emerald-600 hover:!bg-emerald-50"
                      title="Approve"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(merchant)}
                      className="admin-icon-btn-danger"
                      title="Reject"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  Queue clear
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  No partners awaiting listing approval
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Admin logins */}
        <div className="xl:col-span-3 admin-card overflow-hidden">
          <div className="admin-card-header !flex-col !items-start">
            <h3 className="admin-card-title flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              Admin access log
            </h3>
            <p className="admin-card-description">Recent controller sign-ins</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[240px] overflow-y-auto custom-scrollbar">
            {loginLogs.length > 0 ? (
              loginLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="px-4 py-2.5">
                  <p className="text-[11px] font-medium text-slate-800 truncate">
                    {log.admin_email}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                    {formatActivityDate(log.login_time)} ·{" "}
                    {formatActivityTime(log.login_time)}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-xs text-slate-500">
                No login records
              </p>
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab("Settings")}
              className="admin-link"
            >
              View in settings →
            </button>
          </div>
        </div>

        {/* Platform health */}
        <div className="xl:col-span-4 admin-card p-4">
          <h3 className="admin-card-title flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-700" />
            Platform health
          </h3>
          <p className="admin-card-description mb-3">
            Key operational indicators
          </p>
          <div className="space-y-2.5">
            {[
              {
                label: "Listing activation",
                value: stats.merchants.total
                  ? Math.round(
                      (stats.merchants.activeListings / stats.merchants.total) *
                        100,
                    )
                  : 0,
                hint: `${stats.merchants.activeListings}/${stats.merchants.total} active`,
              },
              {
                label: "Verification rate",
                value: stats.merchants.total
                  ? Math.round(
                      (stats.merchants.verified / stats.merchants.total) * 100,
                    )
                  : 0,
                hint: `${stats.merchants.verified} FinderB verified`,
              },
              ...(canViewFinancialData
                ? [
                    {
                      label: "Paid conversion",
                      value: stats.merchants.total
                        ? Math.round(
                            (stats.merchants.paid / stats.merchants.total) *
                              100,
                          )
                        : 0,
                      hint: `${stats.merchants.paid} paid partners`,
                    },
                    {
                      label: "Payment success",
                      value: stats.payments.successRate,
                      hint: "Completed vs all attempts",
                    },
                  ]
                : []),
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-slate-700">
                    {row.label}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {row.hint}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{ width: `${Math.min(row.value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity stream */}
      <div className="admin-card overflow-hidden">
        <div className="admin-card-header flex-col sm:flex-row !items-start sm:!items-center gap-3">
          <div>
            <h3 className="admin-card-title">Activity stream</h3>
            <p className="admin-card-description">
              Latest events across users, partners, and leads
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "user", "merchant", "lead"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActivityFilter(type)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                  activityFilter === type
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {type}
                <span className="ml-1 opacity-70 tabular-nums">
                  {activityCounts[type]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredActivities.length > 0 ? (
            filteredActivities.slice(0, 14).map((activity) => (
              <div
                key={`${activity.type}-${activity.id}`}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`admin-avatar shrink-0 !w-8 !h-8 text-[10px] ${
                    activity.type === "user"
                      ? "!bg-sky-50 !text-sky-700 !border-sky-100"
                      : activity.type === "merchant"
                        ? "!bg-emerald-50 !text-emerald-700 !border-emerald-100"
                        : "!bg-amber-50 !text-amber-700 !border-amber-100"
                  }`}
                >
                  {activity.type === "user"
                    ? "U"
                    : activity.type === "merchant"
                      ? "M"
                      : "L"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {activity.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {activity.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-600 tabular-nums">
                    {formatActivityDate(activity.timestamp)}
                  </p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {formatActivityTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              No activity for this filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
