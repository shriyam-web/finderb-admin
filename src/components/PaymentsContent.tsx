"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import {
  buildSubscriptionFromBusiness,
  formatAmountInr,
  formatDateTime,
  mergePaymentHistory,
  paymentTypeLabel,
  type PaymentRecord,
  type SubscriptionRecord,
} from "../lib/paymentUtils";

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

const STATUS_OPTIONS = ["all", "completed", "pending", "failed"] as const;
const BILLING_OPTIONS = ["all", "monthly", "annual"] as const;

function statusBadgeClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "pending") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function subscriptionStatusClass(status: string | null) {
  if (status === "active") return "text-emerald-700";
  if (status === "cancelled") return "text-rose-700";
  if (status === "pending") return "text-amber-700";
  return "text-slate-600";
}

function SensitiveValue({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-medium text-slate-400 tracking-wide uppercase">{label}</p>
      <p className="text-[10px] font-mono text-slate-800 break-all">{value}</p>
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
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [billingFilter, setBillingFilter] = useState<(typeof BILLING_OPTIONS)[number]>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      let businessRows = businesses;
      if (businessRows.length === 0) {
        const { data: fetchedBusinesses, error: businessError } = await supabase
          .from("Business")
          .select(
            `
            id,
            businessName,
            workEmail,
            email,
            mobile,
            registrationNumber,
            paymentStatus,
            paymentId,
            orderId,
            selectedPlan,
            billingCycle,
            planStartedAt,
            planExpiresAt,
            razorpaySubscriptionId,
            subscriptionStatus,
            autoRenewEnabled,
            mandateStatus,
            updatedAt,
            createdAt
          `,
          )
          .or(
            "paymentStatus.eq.completed,paymentStatus.eq.pending,paymentStatus.eq.failed,paymentId.not.is.null,orderId.not.is.null,razorpaySubscriptionId.not.is.null",
          );

        if (businessError) {
          throw new Error(businessError.message);
        }
        businessRows = fetchedBusinesses ?? [];
      }

      const merged = mergePaymentHistory(paymentRows ?? [], businessRows);
      const subscriptionRows = businessRows
        .map(buildSubscriptionFromBusiness)
        .filter((item): item is SubscriptionRecord => Boolean(item))
        .sort((a, b) => {
          const aTime = new Date(a.planExpiresAt || a.updatedAt || 0).getTime();
          const bTime = new Date(b.planExpiresAt || b.updatedAt || 0).getTime();
          return bTime - aTime;
        });

      setPayments(merged);
      setSubscriptions(subscriptionRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment data");
    } finally {
      setLoading(false);
    }
  }, [businesses]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const stats = useMemo(() => {
    const completed = payments.filter((p) => p.status === "completed");
    const pending = payments.filter((p) => p.status === "pending");
    const failed = payments.filter((p) => p.status === "failed");
    const totalRevenuePaise = completed.reduce((sum, p) => sum + p.amountPaise, 0);
    const activeSubscriptions = subscriptions.filter(
      (s) => s.paymentStatus === "completed" && s.subscriptionStatus === "active",
    ).length;

    return {
      completed: completed.length,
      pending: pending.length,
      failed: failed.length,
      totalRevenueDisplay: formatAmountInr(totalRevenuePaise),
      activeSubscriptions,
      totalMerchants: subscriptions.length,
    };
  }, [payments, subscriptions]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
      const matchesBilling = billingFilter === "all" || payment.billingCycle === billingFilter;
      const matchesSearch =
        !query ||
        payment.businessName.toLowerCase().includes(query) ||
        payment.merchantEmail.toLowerCase().includes(query) ||
        payment.merchantMobile.toLowerCase().includes(query) ||
        (payment.registrationNumber?.toLowerCase().includes(query) ?? false) ||
        (payment.orderId?.toLowerCase().includes(query) ?? false) ||
        (payment.paymentId?.toLowerCase().includes(query) ?? false) ||
        (payment.subscriptionId?.toLowerCase().includes(query) ?? false) ||
        payment.businessId.toLowerCase().includes(query);

      return matchesStatus && matchesBilling && matchesSearch;
    });
  }, [payments, statusFilter, billingFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">Financial Ledger</h1>
          <p className="admin-page-subtitle">
            Merchant subscription payments, Razorpay references, and billing status.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="admin-kpi-grid">
        {[
          { label: "Completed payments", value: stats.completed, meta: "Successful transactions", tone: "admin-kpi-success" },
          { label: "Pending payments", value: stats.pending, meta: "Awaiting confirmation", tone: "admin-kpi-neutral" },
          { label: "Failed payments", value: stats.failed, meta: "Declined or errored", tone: "admin-kpi-neutral" },
          { label: "Total revenue", value: stats.totalRevenueDisplay, meta: "From completed payments", tone: "admin-kpi-primary" },
        ].map((card) => (
          <div key={card.label} className={`admin-kpi ${card.tone}`}>
            <p className="admin-kpi-label">{card.label}</p>
            <p className="admin-kpi-value">{card.value}</p>
            <p className="admin-kpi-meta">{card.meta}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="admin-card p-4 border-rose-200 bg-rose-50 text-rose-800 text-sm">{error}</div>
      )}

      <div className="admin-card overflow-hidden">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Active subscriptions</h3>
            <p className="admin-card-description">
              {stats.activeSubscriptions} active mandate{stats.activeSubscriptions !== 1 ? "s" : ""} ·{" "}
              {stats.totalMerchants} merchant{stats.totalMerchants !== 1 ? "s" : ""} with payment activity
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Payment status</th>
                <th className="px-4 py-3 font-semibold">Subscription</th>
                <th className="px-4 py-3 font-semibold">Auto-debit</th>
                <th className="px-4 py-3 font-semibold">Valid until</th>
                <th className="px-4 py-3 font-semibold">Razorpay IDs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Loading subscriptions…
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No merchant subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.businessId} className="hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{sub.businessName}</p>
                      <p className="text-[10px] text-slate-500">{sub.merchantEmail}</p>
                      <p className="text-[10px] text-slate-500">{sub.merchantMobile}</p>
                      {sub.registrationNumber && (
                        <p className="font-mono text-[9px] text-slate-400 mt-1">{sub.registrationNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{sub.planName}</p>
                      <p className="text-[10px] capitalize text-slate-500">{sub.billingCycle}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${statusBadgeClass(sub.paymentStatus)}`}
                      >
                        {sub.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-medium capitalize ${subscriptionStatusClass(sub.subscriptionStatus)}`}>
                        {sub.subscriptionStatus || "—"}
                      </p>
                      <p className="text-[10px] text-slate-500 capitalize">Mandate: {sub.mandateStatus}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={sub.autoRenewEnabled ? "text-emerald-700 font-medium" : "text-slate-500"}>
                        {sub.autoRenewEnabled ? "Enabled" : "Off"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateTime(sub.planExpiresAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[9px] text-slate-600 space-y-1 max-w-[200px]">
                      {sub.paymentId && <p className="break-all">Pay: {sub.paymentId}</p>}
                      {sub.orderId && <p className="break-all">Order: {sub.orderId}</p>}
                      {sub.subscriptionId && <p className="break-all">Sub: {sub.subscriptionId}</p>}
                      {!sub.paymentId && !sub.orderId && !sub.subscriptionId && "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Payment transactions</h3>
            <p className="admin-card-description">
              Full audit trail including Razorpay order, payment, and subscription IDs.
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder="Search merchant, email, order ID, payment ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={billingFilter}
            onChange={(e) => setBillingFilter(e.target.value as (typeof BILLING_OPTIONS)[number])}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All billing</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        <p className="px-4 py-2 text-[10px] text-slate-500 border-b border-slate-50">
          Showing {filteredPayments.length} of {payments.length} payment record
          {payments.length === 1 ? "" : "s"}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold w-8" />
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
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Loading payments…
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No payment records match your filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const isExpanded = expandedId === payment.id;
                  return (
                    <Fragment key={payment.id}>
                      <tr
                        className="hover:bg-slate-50/80 align-top cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {formatDateTime(payment.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{payment.businessName}</p>
                          <p className="text-[10px] text-slate-500">{payment.merchantEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{payment.planName}</p>
                          <p className="text-[10px] capitalize text-slate-500">{payment.billingCycle}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                          {payment.amountDisplay}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${statusBadgeClass(payment.status)}`}
                          >
                            {payment.status}
                          </span>
                          {payment.source && (
                            <p className="mt-1 text-[9px] capitalize text-slate-400">{payment.source}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{paymentTypeLabel(payment.paymentType)}</td>
                        <td className="px-4 py-3 font-mono text-[9px] text-slate-600 max-w-[140px] break-all">
                          {payment.orderId || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[9px] text-slate-600 max-w-[140px] break-all">
                          {payment.paymentId || "—"}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <SensitiveValue label="Business ID" value={payment.businessId} />
                              <SensitiveValue label="Merchant mobile" value={payment.merchantMobile} />
                              <SensitiveValue label="Registration #" value={payment.registrationNumber} />
                              <SensitiveValue label="Subscription ID" value={payment.subscriptionId} />
                              <SensitiveValue label="Plan started" value={formatDateTime(payment.planStartedAt)} />
                              <SensitiveValue label="Plan expires" value={formatDateTime(payment.planExpiresAt)} />
                              <SensitiveValue label="Updated at" value={formatDateTime(payment.updatedAt)} />
                              <SensitiveValue label="Record ID" value={payment.id} />
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
    </div>
  );
}
