"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  document_urls?: string[];
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

export default function BusinessPromotionsContent({ adminId, canManage }: Props) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Overview");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      return;
    }
    setData(body);
    setError(body.errors?.[0] || "");
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

  return (
    <div className="bp-root">
      <style>{`
        .bp-root { color: #0f172a; }
        .bp-root h2 { margin: 0; font-size: 22px; font-weight: 650; }
        .bp-root p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
        .bp-tabs, .bp-stats, .bp-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .bp-tabs { margin: 16px 0; }
        .bp-tabs button, .bp-btn { border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
        .bp-tabs button[data-on="true"] { background: #153551; color: #fff; border-color: #153551; }
        .bp-stats { margin-bottom: 16px; }
        .bp-stat { min-width: 140px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
        .bp-stat b { display: block; font-size: 20px; }
        .bp-stat span { color: #64748b; font-size: 12px; }
        .bp-card, .bp-table { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }
        .bp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .bp-table th, .bp-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .bp-table th { color: #64748b; font-weight: 600; font-size: 12px; }
        .bp-filters { margin-bottom: 12px; }
        .bp-filters input, .bp-filters select, .bp-field { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
        .bp-split { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .8fr); gap: 12px; }
        .bp-card { padding: 14px; }
        .bp-error { color: #b91c1c; font-size: 13px; margin-bottom: 10px; }
        .bp-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .bp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        @media (max-width: 900px) { .bp-split { grid-template-columns: 1fr; } }
      `}</style>
      <h2>Business Promotions</h2>
      <p>Verification, orders and campaign results. This does not change Live Leads subscriptions.</p>
      {error ? <p className="bp-error">{error}</p> : null}
      <div className="bp-tabs">
        {SECTIONS.map((item) => (
          <button key={item} type="button" data-on={section === item} onClick={() => setSection(item)}>{item}</button>
        ))}
      </div>

      {section === "Overview" ? (
        <div className="bp-stats">
          {[
            ["Orders", data?.stats.orders],
            ["Revenue", inr(data?.stats.revenue || 0)],
            ["Pending pay", data?.stats.pendingPayments],
            ["Paid", data?.stats.paid],
            ["In review", data?.stats.review],
            ["Active", data?.stats.active],
            ["Completed", data?.stats.completed],
            ["Rejected", data?.stats.rejected],
            ["Videos", data?.stats.videos],
            ["Custom open", data?.stats.custom],
          ].map(([label, value]) => (
            <div className="bp-stat" key={String(label)}><b>{value ?? "—"}</b><span>{label}</span></div>
          ))}
        </div>
      ) : null}

      {section === "Verification" ? (
        <table className="bp-table">
          <thead>
            <tr><th>Business</th><th>Owner</th><th>Status</th><th>Shop</th><th>Documents</th><th>Action</th></tr>
          </thead>
          <tbody>
            {(data?.verifications || []).map((item) => (
              <tr key={item.id}>
                <td>{item.business?.businessName || item.business_id}<br />{item.business?.category}</td>
                <td>{item.business?.fullName}<br />{item.business?.mobile}</td>
                <td>{item.status.replaceAll("_", " ")}<br />{when(item.submitted_at)}{item.rejection_reason ? <><br />{item.rejection_reason}</> : null}</td>
                <td>
                  {item.shop_photo_url ? <a href={item.shop_photo_url} target="_blank" rel="noreferrer">Photograph</a> : "—"}
                  <br />{item.latitude}, {item.longitude}
                </td>
                <td>
                  {(item.document_urls || []).map((url) => (
                    <div key={url}><a href={url} target="_blank" rel="noreferrer">{item.document_type}</a></div>
                  ))}
                </td>
                <td>
                  <div className="bp-actions">
                    <button className="bp-btn" type="button" disabled={!canManage || busy} onClick={() => void act({ action: "verification", id: item.id, status: "approved" })}>Approve</button>
                    <button className="bp-btn" type="button" disabled={!canManage || busy} onClick={() => {
                      const reason = window.prompt("Rejection reason");
                      if (reason) void act({ action: "verification", id: item.id, status: "rejected", reason });
                    }}>Reject</button>
                    <button className="bp-btn" type="button" disabled={!canManage || busy} onClick={() => {
                      const reason = window.prompt("What should the merchant send again?");
                      if (reason) void act({ action: "verification", id: item.id, status: "resubmission_required", reason });
                    }}>Resubmit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {section === "Orders" ? (
        <div className="bp-split">
          <div>
            <div className="bp-filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, order or pincode" />
              <select value={packageId} onChange={(event) => setPackageId(event.target.value)}>
                <option value="all">All packages</option>
                {(data?.packages || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                {["pending", "paid", "payment_successful", "under_review", "editing", "video_ready", "ad_active", "completed", "rejected", "refund_pending", "refunded"].map((item) => (
                  <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <table className="bp-table">
              <thead>
                <tr><th>Order</th><th>Business</th><th>Package</th><th>Amount</th><th>Payment</th><th>Campaign</th><th>Area</th></tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} onClick={() => setSelected(order.id)} style={{ cursor: "pointer", background: selected === order.id ? "#f8fafc" : undefined }}>
                    <td>{order.id}<br />{when(order.created_at)}</td>
                    <td>{order.business?.businessName}<br />{order.business?.category}</td>
                    <td>{order.package_snapshot?.name || order.package_id}</td>
                    <td>{inr(order.amount_inr)}</td>
                    <td>{order.payment_status}</td>
                    <td>{order.campaign_status.replaceAll("_", " ")}</td>
                    <td>{order.target_area} {order.target_pincode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="bp-card">
            {open ? (
              <>
                <strong>{open.package_snapshot?.name || open.package_id}</strong>
                <p>{open.id} · {inr(open.amount_inr)} · {open.payment_status}</p>
                <p>{open.business?.businessName} · {open.business?.fullName} · {open.business?.mobile}</p>
                <p>{open.target_area}, {open.target_pincode} · {open.target_coverage}</p>
                <p>Start {when(open.campaign_started_at)} · End {when(open.campaign_ended_at)}</p>
                {open.video_url ? <p><a href={open.video_url} target="_blank" rel="noreferrer">Download uploaded video</a></p> : <p>No video yet.</p>}
                <p>Gateway {open.razorpay_order_id || "—"} · {open.razorpay_payment_id || "unpaid"}</p>
                {open.rejection_reason ? <p className="bp-error">{open.rejection_reason}</p> : null}
                <div className="bp-actions">
                  {(NEXT_STATUS[open.campaign_status] || []).map((item) => (
                    <button key={item} className="bp-btn" type="button" disabled={!canManage || busy} onClick={() => void act({ action: "status", id: open.id, status: item, note })}>
                      {item.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
                <input className="bp-field" style={{ width: "100%", marginTop: 8 }} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason or note" />
                {open.campaign_status === "completed" || open.campaign_status === "ad_active" ? (
                  <div className="bp-actions">
                    <input className="bp-field" value={metrics.reach} onChange={(event) => setMetrics({ ...metrics, reach: event.target.value })} placeholder="Reach" />
                    <input className="bp-field" value={metrics.views} onChange={(event) => setMetrics({ ...metrics, views: event.target.value })} placeholder="Views" />
                    <input className="bp-field" value={metrics.visits} onChange={(event) => setMetrics({ ...metrics, visits: event.target.value })} placeholder="Visits" />
                    <button className="bp-btn" type="button" disabled={!canManage || busy} onClick={() => void act({ action: "metrics", id: open.id, ...metrics })}>Save results</button>
                  </div>
                ) : null}
                <p>History</p>
                {history.map((row) => (
                  <p key={row.id}>{when(row.created_at)} · {row.action} {row.from_status || ""} {row.to_status || ""} {row.note || ""}</p>
                ))}
              </>
            ) : <p>Select an order to review the video, move the campaign and record results.</p>}
          </aside>
        </div>
      ) : null}

      {section === "Custom" ? (
        <table className="bp-table">
          <thead>
            <tr><th>Request</th><th>Business</th><th>Plan</th><th>What to promote</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(data?.customRequests || []).map((item) => (
              <tr key={item.id}>
                <td>{item.id}<br />{when(item.created_at)}</td>
                <td>{item.business?.businessName || item.business_id}<br />{item.business?.fullName}<br />{item.phone}</td>
                <td>{inr(item.budget_inr)} · {item.duration_days} days<br />{item.coverage}<br />{item.area} {item.pincode}</td>
                <td>{item.goal}{item.note ? <><br />{item.note}</> : null}</td>
                <td>
                  {item.status.replaceAll("_", " ")}
                  {item.admin_note ? <><br />{item.admin_note}</> : null}
                  <div className="bp-actions">
                    {["in_review", "quoted", "closed"].map((status) => (
                      <button key={status} className="bp-btn" type="button" disabled={!canManage || busy} onClick={() => {
                        const note = window.prompt("Note for this custom plan", item.admin_note || "") || "";
                        void act({ action: "custom", id: item.id, status, note });
                      }}>{status.replaceAll("_", " ")}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {section === "Packages" ? (
        <div className="bp-grid">
          {(data?.packages || []).map((item) => (
            <form key={item.id} className="bp-card" onSubmit={(event) => {
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
            }}>
              <strong>{item.name}</strong>
              <input className="bp-field" name="name" defaultValue={item.name} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="price_inr" defaultValue={item.price_inr} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="reference_inr" defaultValue={item.reference_inr} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="duration_days" defaultValue={item.duration_days} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="coverage_label" defaultValue={item.coverage_label} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="reach_label" defaultValue={item.reach_label} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="views_label" defaultValue={item.views_label} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="visits_label" defaultValue={item.visits_label} style={{ width: "100%", marginTop: 8 }} />
              <input className="bp-field" name="sort_order" defaultValue={item.sort_order} style={{ width: "100%", marginTop: 8 }} />
              <label><input name="active" type="checkbox" defaultChecked={item.active} /> Active</label>
              <label><input name="popular" type="checkbox" defaultChecked={item.popular} /> Popular</label>
              <button className="bp-btn" type="submit" disabled={!canManage || busy}>Save package</button>
              <p>Past orders keep the price the merchant paid.</p>
            </form>
          ))}
        </div>
      ) : null}

      {section === "Payments" ? (
        <table className="bp-table">
          <thead>
            <tr><th>Order</th><th>Merchant</th><th>Amount</th><th>Status</th><th>Razorpay order</th><th>Payment</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {(data?.payments || []).map((row) => {
              const business = row.business as Business;
              return (
                <tr key={String(row.id)}>
                  <td>{String(row.id)}</td>
                  <td>{business?.businessName || "—"}</td>
                  <td>{inr(Number(row.amount_inr || 0))}</td>
                  <td>{String(row.payment_status)} · {String(row.campaign_status || "").replaceAll("_", " ")}</td>
                  <td>{String(row.razorpay_order_id || "—")}</td>
                  <td>{String(row.razorpay_payment_id || "—")}</td>
                  <td>{when(String(row.updated_at || ""))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
