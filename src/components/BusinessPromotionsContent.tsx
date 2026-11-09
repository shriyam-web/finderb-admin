"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminContentLoader from "./AdminContentLoader";
import { inr } from "../lib/promotionOps";

type Props = { adminId: string; canManage: boolean };

type Business = {
  businessName?: string;
  category?: string;
  fullName?: string;
  mobile?: string;
  email?: string;
  city?: string;
  businessAddress?: string;
} | null;

type Order = {
  id: string;
  business_id: string;
  package_id: string;
  package_snapshot: { name?: string; durationDays?: number; coverage?: string; referenceInr?: number };
  video_url?: string | null;
  target_pincode?: string | null;
  target_area?: string | null;
  target_coverage?: string | null;
  amount_inr: number;
  payment_status: string;
  campaign_status: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  campaign_started_at?: string | null;
  campaign_ended_at?: string | null;
  actual_reach?: number | null;
  actual_views?: number | null;
  actual_visits?: number | null;
  rejection_reason?: string | null;
  admin_note?: string | null;
  created_at: string;
  business: Business;
};

type Verification = {
  id: string;
  business_id: string;
  status: string;
  shop_photo_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  document_type?: string | null;
  document_urls?: Array<string | null>;
  submitted_at?: string | null;
  rejection_reason?: string | null;
  business: Business;
};

type PackageRow = {
  id: string;
  name: string;
  duration_days: number;
  coverage_label: string;
  price_inr: number;
  reference_inr: number;
  reach_label: string;
  views_label: string;
  visits_label: string;
  popular: boolean;
  active: boolean;
  sort_order: number;
};

type AuditRow = {
  id: number;
  order_id?: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  created_at: string;
};

type CustomRequest = {
  id: string;
  business_id: string;
  budget_inr: number;
  duration_days: number;
  coverage: string;
  pincode: string;
  area: string;
  goal: string;
  phone: string;
  note?: string | null;
  status: string;
  admin_note?: string | null;
  created_at: string;
  business: Business;
};

type Payload = {
  stats: Record<string, number>;
  orders: Order[];
  verifications: Verification[];
  packages: PackageRow[];
  customRequests?: CustomRequest[];
  payments: Array<Record<string, unknown>>;
  audit: AuditRow[];
  errors?: string[];
  error?: string;
};

const SECTIONS = ["Overview", "Verification", "Orders", "Custom", "Packages", "Payments"] as const;
const NEXT_STATUS: Record<string, string[]> = {
  payment_successful: ["under_review", "rejected", "cancelled", "refund_pending"],
  under_review: ["editing", "video_ready", "rejected", "cancelled", "refund_pending"],
  editing: ["video_ready", "under_review", "rejected"],
  video_ready: ["ad_active", "editing", "rejected"],
  ad_active: ["completed"],
  refund_pending: ["refunded", "cancelled"],
};

function when(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function words(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function StatusPill({ value }: { value?: string | null }) {
  const text = words(value);
  const token = String(value || "");
  const good = /paid|approved|active|completed|video_ready|quoted/.test(token);
  const bad = /reject|fail|cancel|refund/.test(token);
  return (
    <span className={`admin-status-pill ${good ? "admin-status-live" : bad ? "admin-status-warn" : ""}`}>
      {text}
    </span>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <tr>
      <td colSpan={8} className="admin-empty">
        {children}
      </td>
    </tr>
  );
}

export default function BusinessPromotionsContent({ adminId, canManage }: Props) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Overview");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [packageId, setPackageId] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [metrics, setMetrics] = useState({ reach: "", views: "", visits: "" });

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/promotions?adminId=${encodeURIComponent(adminId)}`);
    const body = (await response.json()) as Payload;
    if (!response.ok) {
      setError(body.error || "Promotions could not be loaded.");
      setReady(true);
      return;
    }
    setData(body);
    setError((body.errors || []).find((item) => item && !item.includes("CLOUDINARY_API_KEY")) || "");
    setReady(true);
  }, [adminId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, ...body }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "That change was not saved.");
      return;
    }
    setNote("");
    await load();
  };

  const orders = data?.orders || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.campaign_status !== status && order.payment_status !== status) return false;
      if (packageId !== "all" && order.package_id !== packageId) return false;
      const created = order.created_at.slice(0, 10);
      if (fromDate && created < fromDate) return false;
      if (toDate && created > toDate) return false;
      if (!q) return true;
      const name = String(order.business?.businessName || "").toLowerCase();
      return name.includes(q) || order.id.toLowerCase().includes(q) || String(order.target_pincode || "").includes(q);
    });
  }, [orders, query, status, packageId, fromDate, toDate]);
  const open = orders.find((order) => order.id === selected) || null;
  const history = (data?.audit || []).filter((row) => row.order_id === open?.id);
  const stats = data?.stats || {};

  if (!ready) return <AdminContentLoader label="Loading promotions" />;

  return (
    <div className="space-y-4 font-sans">
      <div className="admin-platform-hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="admin-page-title">Business Promotions</h1>
            <p className="admin-page-subtitle">
              Shop checks, promotion orders, and the money collected for ads. This does not change Live Leads plans.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="admin-metric-chip">
                Orders <strong>{stats.orders ?? 0}</strong>
              </span>
              <span className="admin-metric-chip">
                Collected <strong>{inr(stats.revenue || 0)}</strong>
              </span>
              <span className="admin-metric-chip">
                Awaiting check <strong>{(data?.verifications || []).filter((item) => item.status === "submitted" || item.status === "under_review").length}</strong>
              </span>
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={busy} className="admin-btn-primary self-start shrink-0">
            {busy ? "Saving…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="admin-alert-error">{error}</div> : null}

      <div className="admin-segmented flex-wrap">
        {SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSection(item)}
            className={`admin-segmented-btn ${section === item ? "admin-segmented-btn-active" : "admin-segmented-btn-idle"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {section === "Overview" ? (
        <div className="admin-kpi-grid">
          {[
            ["Orders", stats.orders, "admin-kpi-primary"],
            ["Collected", inr(stats.revenue || 0), "admin-kpi-success"],
            ["Pending pay", stats.pendingPayments, "admin-kpi-neutral"],
            ["Paid", stats.paid, "admin-kpi-success"],
            ["In review", stats.review, "admin-kpi-secondary"],
            ["Ads live", stats.active, "admin-kpi-primary"],
            ["Completed", stats.completed, "admin-kpi-success"],
            ["Rejected", stats.rejected, "admin-kpi-neutral"],
            ["Videos in", stats.videos, "admin-kpi-secondary"],
            ["Custom open", stats.custom, "admin-kpi-primary"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`admin-kpi ${tone}`}>
              <p className="admin-kpi-label">{label}</p>
              <p className="admin-kpi-value">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      ) : null}

      {section === "Verification" ? (
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Shop</th>
                  <th>Proof</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.verifications || []).length === 0 ? <Empty>No shop checks yet.</Empty> : null}
                {(data?.verifications || []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium">{item.business?.businessName || item.business_id}</p>
                      <p className="admin-card-description">{item.business?.category || item.business?.city || "—"}</p>
                    </td>
                    <td>
                      <p>{item.business?.fullName || "—"}</p>
                      <p className="admin-card-description">{item.business?.mobile || item.business?.email || "—"}</p>
                    </td>
                    <td>
                      <StatusPill value={item.status} />
                      <p className="admin-card-description mt-1">{when(item.submitted_at)}</p>
                      {item.rejection_reason ? <p className="admin-card-description">{item.rejection_reason}</p> : null}
                    </td>
                    <td>
                      {item.shop_photo_url ? (
                        <a href={item.shop_photo_url} target="_blank" rel="noreferrer" className="font-medium underline">
                          Photograph
                        </a>
                      ) : (
                        "—"
                      )}
                      <p className="admin-card-description">
                        {item.latitude ?? "—"}, {item.longitude ?? "—"}
                      </p>
                    </td>
                    <td>
                      {(item.document_urls || []).filter((url): url is string => Boolean(url)).map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block font-medium underline">
                          {words(item.document_type)}
                        </a>
                      ))}
                      {(item.document_urls || []).filter(Boolean).length === 0 ? "—" : null}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="admin-btn-primary !text-xs !py-1.5" disabled={!canManage || busy} onClick={() => void act({ action: "verification", id: item.id, status: "approved" })}>
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-btn-secondary !text-xs !py-1.5"
                          disabled={!canManage || busy}
                          onClick={() => {
                            const reason = window.prompt("Rejection reason");
                            if (reason) void act({ action: "verification", id: item.id, status: "rejected", reason });
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="admin-btn-secondary !text-xs !py-1.5"
                          disabled={!canManage || busy}
                          onClick={() => {
                            const reason = window.prompt("What should the merchant send again?");
                            if (reason) void act({ action: "verification", id: item.id, status: "resubmission_required", reason });
                          }}
                        >
                          Ask again
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === "Orders" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)] gap-4">
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title">Orders</h2>
                <p className="admin-card-description">{filtered.length} shown</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 p-3">
              <input className="admin-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, order or pincode" />
              <select className="admin-input" value={packageId} onChange={(event) => setPackageId(event.target.value)}>
                <option value="all">All packages</option>
                {(data?.packages || []).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <input className="admin-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From" />
              <input className="admin-input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To" />
              <select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                {["pending", "paid", "payment_successful", "under_review", "editing", "video_ready", "ad_active", "completed", "rejected", "refund_pending", "refunded"].map((item) => (
                  <option key={item} value={item}>{words(item)}</option>
                ))}
              </select>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-compact">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Business</th>
                    <th>Package</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Campaign</th>
                    <th>Area</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? <Empty>No orders match these filters.</Empty> : null}
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order.id)}
                      className={`cursor-pointer ${selected === order.id ? "admin-row-selected" : ""}`}
                    >
                      <td>
                        <p className="font-medium">{order.id}</p>
                        <p className="admin-card-description">{when(order.created_at)}</p>
                      </td>
                      <td>
                        <p>{order.business?.businessName || "—"}</p>
                        <p className="admin-card-description">{order.business?.category || "—"}</p>
                      </td>
                      <td>{order.package_snapshot?.name || order.package_id}</td>
                      <td className="tabular-nums">{inr(order.amount_inr)}</td>
                      <td><StatusPill value={order.payment_status} /></td>
                      <td><StatusPill value={order.campaign_status} /></td>
                      <td>
                        {order.target_area || "—"}
                        <p className="admin-card-description">{order.target_pincode}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="admin-card h-fit">
            <div className="admin-card-header">
              <h2 className="admin-card-title">{open ? open.package_snapshot?.name || open.package_id : "Order"}</h2>
            </div>
            <div className="p-4 space-y-3">
              {open ? (
                <>
                  <p className="admin-card-description">
                    {open.id} · {inr(open.amount_inr)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill value={open.payment_status} />
                    <StatusPill value={open.campaign_status} />
                  </div>
                  <p className="text-sm">
                    {open.business?.businessName || "—"}
                    <span className="admin-card-description block">
                      {open.business?.fullName || "—"} · {open.business?.mobile || "—"}
                    </span>
                  </p>
                  <p className="text-sm">
                    {open.target_area || "—"}, {open.target_pincode || "—"}
                    <span className="admin-card-description block">{open.target_coverage || "—"}</span>
                  </p>
                  <p className="admin-card-description">
                    Start {when(open.campaign_started_at)} · End {when(open.campaign_ended_at)}
                  </p>
                  {open.video_url ? (
                    <a href={open.video_url} target="_blank" rel="noreferrer" className="text-sm font-medium underline">
                      Download uploaded video
                    </a>
                  ) : (
                    <p className="admin-card-description">No video yet.</p>
                  )}
                  <p className="admin-card-description">
                    Gateway {open.razorpay_order_id || "—"} · {open.razorpay_payment_id || "unpaid"}
                  </p>
                  {open.rejection_reason ? <div className="admin-alert-error">{open.rejection_reason}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    {(NEXT_STATUS[open.campaign_status] || []).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="admin-btn-secondary !text-xs !py-1.5"
                        disabled={!canManage || busy}
                        onClick={() => void act({ action: "status", id: open.id, status: item, note })}
                      >
                        {words(item)}
                      </button>
                    ))}
                  </div>
                  <input className="admin-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or note" />
                  {open.campaign_status === "completed" || open.campaign_status === "ad_active" ? (
                    <div className="grid grid-cols-1 gap-2">
                      <input className="admin-input" value={metrics.reach} onChange={(event) => setMetrics({ ...metrics, reach: event.target.value })} placeholder="Reach" />
                      <input className="admin-input" value={metrics.views} onChange={(event) => setMetrics({ ...metrics, views: event.target.value })} placeholder="Views" />
                      <input className="admin-input" value={metrics.visits} onChange={(event) => setMetrics({ ...metrics, visits: event.target.value })} placeholder="Visits" />
                      <button type="button" className="admin-btn-primary" disabled={!canManage || busy} onClick={() => void act({ action: "metrics", id: open.id, ...metrics })}>
                        Save results
                      </button>
                    </div>
                  ) : null}
                  <div>
                    <p className="admin-card-title">History</p>
                    {history.length === 0 ? <p className="admin-card-description mt-1">No notes yet.</p> : null}
                    {history.map((row) => (
                      <p key={row.id} className="admin-card-description mt-1">
                        {when(row.created_at)} · {words(row.action)} {words(row.from_status)} → {words(row.to_status)} {row.note || ""}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <p className="admin-card-description">Select an order to review the video, move the campaign, and record results.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {section === "Custom" ? (
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Business</th>
                  <th>Plan</th>
                  <th>What to promote</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.customRequests || []).length === 0 ? <Empty>No custom plans yet.</Empty> : null}
                {(data?.customRequests || []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium">{item.id}</p>
                      <p className="admin-card-description">{when(item.created_at)}</p>
                    </td>
                    <td>
                      <p>{item.business?.businessName || item.business_id}</p>
                      <p className="admin-card-description">{item.business?.fullName || "—"}</p>
                      <p className="admin-card-description">{item.phone}</p>
                    </td>
                    <td>
                      <p className="tabular-nums">{inr(item.budget_inr)} · {item.duration_days} days</p>
                      <p className="admin-card-description">{item.coverage}</p>
                      <p className="admin-card-description">{item.area} {item.pincode}</p>
                    </td>
                    <td>
                      {item.goal}
                      {item.note ? <p className="admin-card-description">{item.note}</p> : null}
                    </td>
                    <td>
                      <StatusPill value={item.status} />
                      {item.admin_note ? <p className="admin-card-description mt-1">{item.admin_note}</p> : null}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {["in_review", "quoted", "closed"].map((next) => (
                          <button
                            key={next}
                            type="button"
                            className="admin-btn-secondary !text-xs !py-1.5"
                            disabled={!canManage || busy}
                            onClick={() => {
                              const reply = window.prompt("Note for this custom plan", item.admin_note || "") || "";
                              void act({ action: "custom", id: item.id, status: next, note: reply });
                            }}
                          >
                            {words(next)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === "Packages" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(data?.packages || []).map((item) => (
            <form
              key={item.id}
              className="admin-card p-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act({
                  action: "package",
                  id: item.id,
                  name: form.get("name"),
                  price_inr: form.get("price_inr"),
                  reference_inr: form.get("reference_inr"),
                  duration_days: form.get("duration_days"),
                  coverage_label: form.get("coverage_label"),
                  reach_label: form.get("reach_label"),
                  views_label: form.get("views_label"),
                  visits_label: form.get("visits_label"),
                  sort_order: form.get("sort_order"),
                  active: form.get("active") === "on",
                  popular: form.get("popular") === "on",
                });
              }}
            >
              <h2 className="admin-card-title">{item.name}</h2>
              <p className="admin-card-description">Past orders keep the price the merchant paid.</p>
              <label className="admin-card-description block">Name<input className="admin-input mt-1" name="name" defaultValue={item.name} /></label>
              <label className="admin-card-description block">Price (₹)<input className="admin-input mt-1" name="price_inr" defaultValue={item.price_inr} /></label>
              <label className="admin-card-description block">MRP (₹)<input className="admin-input mt-1" name="reference_inr" defaultValue={item.reference_inr} /></label>
              <label className="admin-card-description block">Days<input className="admin-input mt-1" name="duration_days" defaultValue={item.duration_days} /></label>
              <label className="admin-card-description block">Coverage<input className="admin-input mt-1" name="coverage_label" defaultValue={item.coverage_label} /></label>
              <label className="admin-card-description block">Reach<input className="admin-input mt-1" name="reach_label" defaultValue={item.reach_label} /></label>
              <label className="admin-card-description block">Views<input className="admin-input mt-1" name="views_label" defaultValue={item.views_label} /></label>
              <label className="admin-card-description block">Visits<input className="admin-input mt-1" name="visits_label" defaultValue={item.visits_label} /></label>
              <label className="admin-card-description block">Sort<input className="admin-input mt-1" name="sort_order" defaultValue={item.sort_order} /></label>
              <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={item.active} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><input name="popular" type="checkbox" defaultChecked={item.popular} /> Popular</label>
              <button className="admin-btn-primary" type="submit" disabled={!canManage || busy}>Save package</button>
            </form>
          ))}
        </div>
      ) : null}

      {section === "Payments" ? (
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Razorpay order</th>
                  <th>Payment</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments || []).length === 0 ? <Empty>No promotion payments yet.</Empty> : null}
                {(data?.payments || []).map((row) => {
                  const business = row.business as Business;
                  return (
                    <tr key={String(row.id)}>
                      <td className="font-medium">{String(row.id)}</td>
                      <td>{business?.businessName || "—"}</td>
                      <td className="tabular-nums">{inr(Number(row.amount_inr || 0))}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <StatusPill value={String(row.payment_status || "")} />
                          <StatusPill value={String(row.campaign_status || "")} />
                        </div>
                      </td>
                      <td>{String(row.razorpay_order_id || "—")}</td>
                      <td>{String(row.razorpay_payment_id || "—")}</td>
                      <td>{when(String(row.updated_at || ""))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
