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
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}) {
  const className =
    "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left w-full hover:border-slate-300 hover:bg-slate-50 transition-colors";
  const body = (
    <>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 mt-0.5 tabular-nums tracking-tight leading-none">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-slate-500 mt-1 font-normal leading-snug">
          {hint}
        </p>
      )}
    </>
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
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
  canAccessTab,
  canEditListings,
  canViewListingsQueue,
  canViewLoginLogs,
  queueCounts,
  todos,
  todosReady,
  onOpenTodo,
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
  canAccessTab: (tab: string) => boolean;
  canEditListings: boolean;
  canViewListingsQueue: boolean;
  canViewLoginLogs: boolean;
  queueCounts: {
    reviews: number;
    changeRequests: number;
    ownershipRequests: number;
    jobReports: number;
  };
  todos: {
    id: string;
    tab: string;
    title: string;
    detail: string;
    targetId: string | null;
    waitingSince: string | null;
    kind: string;
  }[];
  todosReady: boolean;
  onOpenTodo: (item: {
    tab: string;
    targetId: string | null;
    kind: string;
  }) => void;
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
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
            {canAccessTab("Business Onboarding") && (
              <button
                type="button"
                onClick={() => setActiveTab("Business Onboarding")}
                className="admin-btn-secondary"
              >
                Onboard business
              </button>
            )}
            {canAccessTab("Merchants") && (
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
            )}
          </div>
        </div>
      </div>

      <section className="admin-card overflow-hidden">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">To-do</h2>
            <p className="admin-card-description">
              {todosReady
                ? todos.length
                  ? `${todos.length} item${todos.length === 1 ? "" : "s"} waiting for review`
                  : "Nothing is waiting"
                : "Checking what needs a review"}
            </p>
          </div>
        </div>
        {!todosReady ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading the queue…</p>
        ) : todos.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-2xl" aria-hidden>
              🎉
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Kudos</h3>
            <p className="mt-1 text-sm text-slate-500">
              Every review queue is clear. Nice work.
            </p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {todos.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenTodo(item)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {item.tab}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {item.detail}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </section>

      {(canAccessTab("Reviews") ||
        canAccessTab("Change Requests") ||
        canAccessTab("Ownership Requests") ||
        canAccessTab("Job Reports")) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {canAccessTab("Reviews") && (
            <StatCard
              label="Reviews"
              value={queueCounts.reviews}
              sub="Anonymous reviews and open reports"
              icon={Shield}
              accent={queueCounts.reviews ? "amber" : "slate"}
              onClick={() => setActiveTab("Reviews")}
            />
          )}
          {canAccessTab("Change Requests") && (
            <StatCard
              label="Change requests"
              value={queueCounts.changeRequests}
              sub="Name and category edits"
              icon={FileText}
              accent={queueCounts.changeRequests ? "amber" : "slate"}
              onClick={() => setActiveTab("Change Requests")}
            />
          )}
          {canAccessTab("Ownership Requests") && (
            <StatCard
              label="Ownership requests"
              value={queueCounts.ownershipRequests}
              sub="Claims on existing listings"
              icon={Building2}
              accent={queueCounts.ownershipRequests ? "amber" : "slate"}
              onClick={() => setActiveTab("Ownership Requests")}
            />
          )}
          {canAccessTab("Job Reports") && (
            <StatCard
              label="Job reports"
              value={queueCounts.jobReports}
              sub="Reported job posts"
              icon={Briefcase}
              accent={queueCounts.jobReports ? "amber" : "slate"}
              onClick={() => setActiveTab("Job Reports")}
            />
          )}
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {canAccessTab("Users") && (
          <StatCard
            label="Registered users"
            value={stats.users.total.toLocaleString()}
            sub={`+${stats.users.weekNew} this week · ${stats.users.todayNew} today`}
            icon={Users}
            accent="sky"
            onClick={() => setActiveTab("Users")}
          />
        )}
        {canAccessTab("Merchants") && (
          <StatCard
            label="Active partners"
            value={stats.merchants.total.toLocaleString()}
            sub={`${stats.merchants.activeListings} live listings · ${stats.merchants.verified} verified`}
            icon={Building2}
            accent="emerald"
            onClick={() => setActiveTab("Merchants")}
          />
        )}
        {canAccessTab("Leads") && (
          <StatCard
            label="Total leads"
            value={stats.leads.total.toLocaleString()}
            sub={`+${stats.leads.weekNew} this week · ${stats.leads.profile} profile`}
            icon={Zap}
            accent="amber"
            onClick={() => setActiveTab("Leads")}
          />
        )}
        {(canAccessTab("Users") || canAccessTab("Merchants")) && (
          <StatCard
            label="Weekly sign-ups"
            value={stats.weekSignups.total.toLocaleString()}
            sub={`${stats.weekSignups.users} users · ${stats.weekSignups.merchants} partners`}
            icon={UserPlus}
            accent="primary"
            onClick={() =>
              setActiveTab(canAccessTab("Users") ? "Users" : "Merchants")
            }
          />
        )}
      </div>

      {canAccessTab("Merchants") && (
        <section className="admin-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <div>
              <h2 className="admin-card-title">How businesses joined</h2>
              <p className="admin-card-description">
                Self registration versus profiles created in this panel
                {stats.onboarding.weekSelf + stats.onboarding.weekAdmin > 0
                  ? ` · ${stats.onboarding.weekSelf} self and ${stats.onboarding.weekAdmin} by admin this week`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("Merchants")}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Open merchants
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("Merchants")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
            >
              <p className="text-[11px] font-medium text-slate-500">Self registered</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {stats.onboarding.self.toLocaleString()}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("Merchants")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
            >
              <p className="text-[11px] font-medium text-slate-500">Added by admin</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {stats.onboarding.admin.toLocaleString()}
              </p>
            </button>
          </div>
          {stats.onboarding.self + stats.onboarding.admin > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 flex">
              <div
                className="h-full bg-teal-600"
                style={{
                  width: `${(stats.onboarding.self / (stats.onboarding.self + stats.onboarding.admin)) * 100}%`,
                }}
              />
              <div className="h-full flex-1 bg-amber-400" />
            </div>
          )}
          {stats.onboarding.unknown > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">
              {stats.onboarding.unknown.toLocaleString()} older listings have no origin saved.
              New signups are tagged after the onboard-source column is added.
            </p>
          )}
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-slate-500">
              Last 8 weeks · teal is self registered, amber is added by admin
            </p>
            <AdminBarChart
              height={180}
              data={stats.onboarding.weeks.map((week) => ({
                label: week.label,
                values: { self: week.self, admin: week.admin },
              }))}
              series={[
                { key: "self", label: "Self registered", color: "#0d9488" },
                { key: "admin", label: "Added by admin", color: "#f59e0b" },
              ]}
            />
          </div>
        </section>
      )}

      {/* Secondary stats row */}
      <div
        className={`grid grid-cols-2 gap-3 ${
          canViewFinancialData ? "sm:grid-cols-3 lg:grid-cols-6" : ""
        }`}
      >
        {canViewListingsQueue && (
          <MiniMetric
            label="Awaiting listing review"
            value={stats.merchants.pendingKyc}
            hint="Pending admin approval"
            onClick={() => setActiveTab("Merchants")}
          />
        )}
        {canViewFinancialData && (
          <>
            <MiniMetric
              label="Paid partners"
              value={stats.merchants.paid}
              hint="Completed payment"
              onClick={() => setActiveTab("Payments & Subscriptions")}
            />
            <MiniMetric
              label="Payment success"
              value={`${stats.payments.successRate}%`}
              hint="Of all attempts"
              onClick={() => setActiveTab("Payments & Subscriptions")}
            />
            <MiniMetric
              label="Active subs"
              value={stats.payments.activeSubscriptions}
              hint="Razorpay active"
              onClick={() => setActiveTab("Payments & Subscriptions")}
            />
            <MiniMetric
              label="Opens"
              value={stats.payments.opensCount}
              hint="Needs attention"
              onClick={() => setActiveTab("Payments & Subscriptions")}
            />
          </>
        )}
        {canAccessTab("Categories") && (
          <MiniMetric
            label="Categories"
            value={stats.content.categories}
            hint={`${stats.content.blogs} blogs · ${stats.content.jobs} jobs`}
            onClick={() => setActiveTab("Categories")}
          />
        )}
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
              {[
                { label: "Leads (7d)", value: stats.leads.weekNew },
                { label: "Category leads", value: stats.leads.category },
                { label: "Profile leads", value: stats.leads.profile },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => canAccessTab("Leads") && setActiveTab("Leads")}
                  className="text-left rounded-md hover:bg-slate-50 px-1 py-0.5"
                >
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    {item.label}
                  </p>
                  <p className="text-base font-bold text-slate-900 tabular-nums">
                    {item.value}
                  </p>
                </button>
              ))}
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
                  <button
                    key={plan.label}
                    type="button"
                    onClick={() => setActiveTab("Payments & Subscriptions")}
                    className="block w-full text-left"
                  >
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
                  </button>
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
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab("Payments & Subscriptions")}
                    className={`rounded-lg border px-3 py-2.5 text-left hover:brightness-[0.98] ${item.tone}`}
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums leading-none">
                      {item.value}
                    </p>
                  </button>
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
          {canAccessTab("Merchants") && (
            <QuickLink
              label="Partner management"
              description="Profiles, listing approval, verification badges"
              icon={Building2}
              onClick={() => setActiveTab("Merchants")}
              badge={stats.merchants.pendingKyc || undefined}
            />
          )}
          {canViewFinancialData && (
            <QuickLink
              label="Payments & subscriptions"
              description="Ledger, filters, opens tracking"
              icon={CreditCard}
              onClick={() => setActiveTab("Payments & Subscriptions")}
              badge={stats.payments.opensCount || undefined}
            />
          )}
          {canAccessTab("Leads") && (
            <QuickLink
              label="Lead inbox"
              description="Profile and category enquiries"
              icon={Activity}
              onClick={() => setActiveTab("Leads")}
              badge={stats.leads.weekNew ? `+${stats.leads.weekNew}` : undefined}
            />
          )}
          {canAccessTab("Categories") && (
            <QuickLink
              label="Categories"
              description="Marketplace taxonomy and slots"
              icon={Layers}
              onClick={() => setActiveTab("Categories")}
            />
          )}
          {canAccessTab("Blogs") && (
            <QuickLink
              label="Blogs"
              description="Editorial content management"
              icon={FileText}
              onClick={() => setActiveTab("Blogs")}
              badge={stats.content.blogs}
            />
          )}
          {canAccessTab("FinderB Jobs") && (
            <QuickLink
              label="FinderB Jobs"
              description="Job listings on platform"
              icon={Briefcase}
              onClick={() => setActiveTab("FinderB Jobs")}
              badge={stats.content.jobs}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Verification queue */}
        {canViewListingsQueue && (
        <div className={`${canViewLoginLogs ? "xl:col-span-5" : "xl:col-span-8"} admin-card flex flex-col overflow-hidden`}>
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
            {canAccessTab("Merchants") && (
              <button
                type="button"
                onClick={() => setActiveTab("Merchants")}
                className="admin-link"
              >
                Open
              </button>
            )}
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
                    {canEditListings ? (
                      <>
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
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 px-1">
                        Read only
                      </span>
                    )}
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
        )}

        {canViewLoginLogs && (
        <div
          className={`${canViewListingsQueue ? "xl:col-span-3" : "xl:col-span-4"} admin-card overflow-hidden`}
        >
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
            {canAccessTab("Settings") ? (
              <button
                type="button"
                onClick={() => setActiveTab("Settings")}
                className="admin-link"
              >
                View in settings →
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                Settings access required
              </span>
            )}
          </div>
        </div>
        )}

        {/* Platform health */}
        <div className={`${canViewLoginLogs || canViewListingsQueue ? "xl:col-span-4" : "xl:col-span-12"} admin-card p-4`}>
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
