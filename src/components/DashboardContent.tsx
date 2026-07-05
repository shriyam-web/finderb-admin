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
  accent: "primary" | "emerald" | "sky" | "amber" | "violet" | "rose" | "slate";
  onClick?: () => void;
}) {
  const styles = {
    primary: { card: "from-primary/10 to-primary/5 border-primary/20", icon: "text-primary" },
    emerald: { card: "from-emerald-500/10 to-emerald-500/5 border-emerald-200/70", icon: "text-emerald-700" },
    sky: { card: "from-sky-500/10 to-sky-500/5 border-sky-200/70", icon: "text-sky-700" },
    amber: { card: "from-amber-500/10 to-amber-500/5 border-amber-200/70", icon: "text-amber-700" },
    violet: { card: "from-violet-500/10 to-violet-500/5 border-violet-200/70", icon: "text-violet-700" },
    rose: { card: "from-rose-500/10 to-rose-500/5 border-rose-200/70", icon: "text-rose-700" },
    slate: { card: "from-slate-500/10 to-slate-500/5 border-slate-200/70", icon: "text-slate-700" },
  }[accent];

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm text-left w-full transition-all ${styles.card} ${onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-white/90 shadow-sm ${styles.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Wrapper>
  );
}

function MiniMetric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
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
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all w-full"
    >
      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold tabular-nums">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0" />
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
}) {
  const [showRevenue, setShowRevenue] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "user" | "merchant" | "lead">("all");

  const maxVal = Math.max(...chartData.map((d) => d.users + d.merchants), 1);
  const chartPeak = chartData.reduce(
    (best, d) => (d.users + d.merchants > best.total ? { label: d.label, total: d.users + d.merchants } : best),
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
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1),_transparent_55%)]" />
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-semibold uppercase tracking-wider">
                <span className={`w-1.5 h-1.5 rounded-full ${maintenanceMode ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
                {maintenanceMode ? "Maintenance" : "Platform live"}
              </span>
              {platformDateLabel && (
                <span className="text-[11px] text-white/50 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {platformDateLabel}
                  {platformTimeLabel && ` · ${platformTimeLabel}`}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mission control</h1>
            <p className="text-sm text-white/70 mt-2 max-w-2xl leading-relaxed">
              Real-time snapshot of users, partners, revenue, leads, and platform health across FinderB.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("Users")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-semibold hover:bg-white/15 transition-colors"
            >
              <Users className="w-4 h-4" />
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("Merchants")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-semibold shadow-lg hover:bg-white/95 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Partner queue
              {stats.merchants.pendingKyc > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-primary text-white text-[10px] font-bold">
                  {stats.merchants.pendingKyc}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          accent="violet"
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniMetric label="Pending KYC" value={stats.merchants.pendingKyc} hint="Awaiting review" />
        <MiniMetric label="Paid partners" value={stats.merchants.paid} hint="Completed payment" />
        <MiniMetric label="Payment success" value={`${stats.payments.successRate}%`} hint="Of all attempts" />
        <MiniMetric label="Active subs" value={stats.payments.activeSubscriptions} hint="Razorpay active" />
        <MiniMetric label="Opens" value={stats.payments.opensCount} hint="Needs attention" />
        <MiniMetric label="Categories" value={stats.content.categories} hint={`${stats.content.blogs} blogs · ${stats.content.jobs} jobs`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Growth chart */}
        <div className="xl:col-span-8 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Growth trajectory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                New registrations over 7 days · peak {chartPeak.label} ({chartPeak.total})
              </p>
            </div>
            <div className="flex gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
                Users ({stats.weekSignups.users})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
                Partners ({stats.weekSignups.merchants})
              </span>
            </div>
          </div>
          <div className="p-6 pt-4">
            <div className="h-56 flex items-end justify-between gap-2 px-1">
              {chartData.map((d, i) => {
                const total = d.users + d.merchants;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end max-w-[56px] group">
                    <span className="text-[10px] font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                      {total}
                    </span>
                    <div className="w-full flex items-end justify-center gap-1 h-full max-h-[180px]">
                      <div
                        className="w-full max-w-[18px] rounded-t-md bg-primary/85 hover:bg-primary transition-colors"
                        style={{ height: `${Math.max((d.users / maxVal) * 100, d.users ? 4 : 0)}%` }}
                        title={`${d.users} users`}
                      />
                      <div
                        className="w-full max-w-[18px] rounded-t-md bg-secondary/85 hover:bg-secondary transition-colors"
                        style={{ height: `${Math.max((d.merchants / maxVal) * 100, d.merchants ? 4 : 0)}%` }}
                        title={`${d.merchants} partners`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 group-hover:text-primary transition-colors">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Leads (7d)</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{stats.leads.weekNew}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Category leads</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{stats.leads.category}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Profile leads</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{stats.leads.profile}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Plan mix */}
        <div className="xl:col-span-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Partner plan mix
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">Active partner subscriptions</p>
          <div className="space-y-4">
            {[
              { label: "Starter", count: stats.plans.starter, color: "bg-slate-400" },
              { label: "Growth — Monthly", count: stats.plans.growthMonthly, color: "bg-primary" },
              { label: "Pro — Annual", count: stats.plans.proAnnual, color: "bg-secondary" },
            ].map((plan) => {
              const pct = stats.merchants.total ? (plan.count / stats.merchants.total) * 100 : 0;
              return (
                <div key={plan.label}>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="font-medium text-slate-700">{plan.label}</span>
                    <span className="text-slate-500 tabular-nums">
                      {plan.count} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${plan.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("Payments & Subscriptions")}
            className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Open payments ledger
          </button>
        </div>
      </div>

      {/* Revenue */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Platform revenue
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Merchant subscription payments · sensitive figures hidden by default</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRevenue((v) => !v)}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {showRevenue ? "Hide revenue" : "Show revenue"}
          </button>
        </div>
        {showRevenue ? (
          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "Total revenue", value: stats.payments.totalRevenueDisplay, tone: "border-slate-200 bg-gradient-to-br from-slate-50 to-white" },
                { label: "MTD revenue", value: stats.payments.mtdRevenueDisplay, tone: "border-primary/20 bg-primary/5" },
                { label: "Completed", value: stats.payments.completedCount, tone: "border-emerald-200 bg-emerald-50/60" },
                { label: "Pending", value: stats.payments.pendingCount, tone: "border-amber-200 bg-amber-50/60" },
                { label: "Failed", value: stats.payments.failedCount, tone: "border-rose-200 bg-rose-50/60" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl border p-4 ${item.tone}`}>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {stats.payments.expiring7d} expiring ≤7d · {stats.payments.autoDebitEnabled} auto-debit enabled
              </p>
              <button type="button" onClick={() => setActiveTab("Payments & Subscriptions")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Full financial ledger <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-400 mb-2">
              <Shield className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-600">Revenue figures are concealed</p>
            <p className="text-xs text-slate-400 mt-1">Click &quot;Show revenue&quot; to view payment totals</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">Quick navigation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink label="Partner management" description="Profiles, KYC, verification badges" icon={Building2} onClick={() => setActiveTab("Merchants")} badge={stats.merchants.pendingKyc || undefined} />
          <QuickLink label="Payments & subscriptions" description="Ledger, filters, opens tracking" icon={CreditCard} onClick={() => setActiveTab("Payments & Subscriptions")} badge={stats.payments.opensCount || undefined} />
          <QuickLink label="Lead inbox" description="Profile and category enquiries" icon={Activity} onClick={() => setActiveTab("Leads")} badge={stats.leads.weekNew ? `+${stats.leads.weekNew}` : undefined} />
          <QuickLink label="Categories" description="Marketplace taxonomy and slots" icon={Layers} onClick={() => setActiveTab("Categories")} />
          <QuickLink label="Blogs" description="Editorial content management" icon={FileText} onClick={() => setActiveTab("Blogs")} badge={stats.content.blogs} />
          <QuickLink label="FinderB Jobs" description="Job listings on platform" icon={Briefcase} onClick={() => setActiveTab("FinderB Jobs")} badge={stats.content.jobs} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Verification queue */}
        <div className="xl:col-span-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col min-h-[380px] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Verification queue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {merchantRequests.length} partner{merchantRequests.length !== 1 ? "s" : ""} awaiting action
              </p>
            </div>
            <button type="button" onClick={() => setActiveTab("Merchants")} className="text-xs font-semibold text-primary hover:underline">
              Open
            </button>
          </div>
          <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[340px] custom-scrollbar">
            {merchantRequests.length > 0 ? (
              merchantRequests.slice(0, 8).map((merchant) => (
                <div key={merchant.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="admin-avatar shrink-0">
                      {merchant.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{merchant.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {merchant.category}
                        {merchant.email ? ` · ${merchant.email}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Requested {merchant.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApprove(merchant)}
                      className="admin-icon-btn !text-emerald-600 hover:!bg-emerald-50"
                      title="Approve"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(merchant)}
                      className="admin-icon-btn-danger"
                      title="Reject"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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
                <p className="text-sm font-medium text-slate-900">Queue clear</p>
                <p className="text-xs text-slate-500 mt-1">No partners awaiting KYC review</p>
              </div>
            )}
          </div>
        </div>

        {/* Admin logins */}
        <div className="xl:col-span-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              Admin access log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Recent controller sign-ins</p>
          </div>
          <div className="divide-y divide-slate-50 max-h-[340px] overflow-y-auto custom-scrollbar">
            {loginLogs.length > 0 ? (
              loginLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="px-5 py-3">
                  <p className="text-[11px] font-medium text-slate-800 truncate">{log.admin_email}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                    {formatActivityDate(log.login_time)} · {formatActivityTime(log.login_time)}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-5 py-10 text-center text-xs text-slate-500">No login records</p>
            )}
          </div>
          <div className="px-5 py-3 border-t border-slate-100">
            <button type="button" onClick={() => setActiveTab("Settings")} className="text-xs font-semibold text-primary hover:underline">
              View in settings →
            </button>
          </div>
        </div>

        {/* Platform health */}
        <div className="xl:col-span-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Platform health
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">Key operational indicators</p>
          <div className="space-y-3">
            {[
              { label: "Listing activation", value: stats.merchants.total ? Math.round((stats.merchants.activeListings / stats.merchants.total) * 100) : 0, hint: `${stats.merchants.activeListings}/${stats.merchants.total} active` },
              { label: "Verification rate", value: stats.merchants.total ? Math.round((stats.merchants.verified / stats.merchants.total) * 100) : 0, hint: `${stats.merchants.verified} FinderB verified` },
              { label: "Paid conversion", value: stats.merchants.total ? Math.round((stats.merchants.paid / stats.merchants.total) * 100) : 0, hint: `${stats.merchants.paid} paid partners` },
              { label: "Payment success", value: stats.payments.successRate, hint: "Completed vs all attempts" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-500 tabular-nums">{row.hint}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${Math.min(row.value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity stream */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Activity stream</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest events across users, partners, and leads</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "user", "merchant", "lead"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActivityFilter(type)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize transition-all ${
                  activityFilter === type
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {type}
                <span className="ml-1 opacity-70 tabular-nums">{activityCounts[type]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {filteredActivities.length > 0 ? (
            filteredActivities.slice(0, 14).map((activity) => (
              <div key={`${activity.type}-${activity.id}`} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                <div
                  className={`admin-avatar shrink-0 !w-9 !h-9 text-[10px] ${
                    activity.type === "user"
                      ? "!bg-sky-50 !text-sky-700 !border-sky-100"
                      : activity.type === "merchant"
                        ? "!bg-emerald-50 !text-emerald-700 !border-emerald-100"
                        : "!bg-amber-50 !text-amber-700 !border-amber-100"
                  }`}
                >
                  {activity.type === "user" ? "U" : activity.type === "merchant" ? "M" : "L"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{activity.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-600 tabular-nums">{formatActivityDate(activity.timestamp)}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">{formatActivityTime(activity.timestamp)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">No activity for this filter</div>
          )}
        </div>
      </div>
    </div>
  );
}
