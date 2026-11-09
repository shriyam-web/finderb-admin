"use client";

import { useCallback, useEffect, useState } from "react";
import AdminContentLoader from "./AdminContentLoader";
import { useAdminToast } from "./AdminToast";
import { ADMIN_PANEL_REFRESH, requestAdminPanelRefresh } from "../lib/adminPanelRefresh";

type AdRequest = {
  id: string;
  business: {
    businessName?: string;
    category?: string;
    city?: string;
    mobile?: string;
  } | null;
  packageName: string;
  amountInr: number;
  area: string;
  pincode: string;
  audience: string;
  content: string;
  review: "pending" | "approved" | "denied" | "none";
  reason: string;
  paymentStatus: string;
  createdAt: string | null;
  videoUrl: string | null;
};

function when(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function inr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function AdsRequestsContent({
  adminId,
  canManage,
  focusId = null,
}: {
  adminId: string;
  canManage: boolean;
  focusId?: string | null;
}) {
  const { toast } = useAdminToast();
  const [status, setStatus] = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [rows, setRows] = useState<AdRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminId) {
      setReady(true);
      return;
    }
    try {
      const response = await fetch(`/api/admin/ad-requests?adminId=${encodeURIComponent(adminId)}&status=${status}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || json.error) {
        toast(json.error || "Could not load ad requests.", "error");
        return;
      }
      setRows((json.rows || []) as AdRequest[]);
    } catch {
      toast("Could not load ad requests.", "error");
    } finally {
      setReady(true);
    }
  }, [adminId, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(ADMIN_PANEL_REFRESH, onRefresh);
    return () => window.removeEventListener(ADMIN_PANEL_REFRESH, onRefresh);
  }, [load]);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`admin-focus-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId, rows]);

  const act = async (row: AdRequest, action: "approve" | "deny" | "delete") => {
    if (!canManage) return;
    const reason = (reasons[row.id] || "").trim();
    if (action === "deny" && reason.length < 3) {
      toast("Write the reason on this ad, then deny it.", "error");
      document.getElementById(`ad-reason-${row.id}`)?.focus();
      return;
    }
    if (action === "delete" && !window.confirm(`Delete ${row.packageName} for ${row.business?.businessName || "this business"}? This unpaid ad is removed.`)) {
      return;
    }
    setBusyId(row.id);
    try {
      const response = await fetch("/api/admin/ad-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, id: row.id, action, reason }),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        toast(json.error || "Could not update this ad.", "error");
        return;
      }
      toast(action === "approve" ? "Ad approved. The business can pay." : action === "deny" ? "Ad denied." : "Ad request deleted.");
      setReasons((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      await load();
      requestAdminPanelRefresh();
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return <AdminContentLoader label="Loading ad requests" />;

  return (
    <div className="space-y-4 font-sans">
      <div className="admin-platform-hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="admin-page-title">Ads Request</h1>
            <p className="admin-page-subtitle">
              Each ad is checked here before the business can pay. Business verification stays on Business Promotions.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="admin-btn-primary self-start shrink-0">Refresh</button>
        </div>
      </div>
      {canManage ? null : (
        <p className="admin-page-subtitle">You can view these ads. Approving, denying, or deleting needs edit access.</p>
      )}
      <div className="admin-segmented flex-wrap">
        {(["pending", "approved", "denied", "all"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={`admin-segmented-btn ${status === item ? "admin-segmented-btn-active" : "admin-segmented-btn-idle"}`}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="admin-page-subtitle">No ads in this list.</p> : null}
      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            id={`admin-focus-${row.id}`}
            className={`admin-card p-4 ${focusId === row.id ? "ring-2 ring-amber-300" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="admin-card-title">{row.business?.businessName || "Business"}</h2>
                <p className="admin-card-description">
                  {[row.business?.category, row.business?.city, row.business?.mobile, when(row.createdAt)].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-sm font-semibold">{row.packageName} · {inr(row.amountInr)} · {row.id}</p>
                <p className="mt-1 text-sm">{[row.area, row.pincode].filter(Boolean).join(", ") || "Area not set"}</p>
                {row.audience ? <p className="mt-2 text-sm"><strong>Target: </strong>{row.audience}</p> : null}
                {row.content ? <p className="mt-1 text-sm"><strong>Ad content: </strong>{row.content}</p> : null}
                {row.reason ? <p className="mt-2 text-sm"><strong>Reason: </strong>{row.reason}</p> : null}
              </div>
              {row.videoUrl ? (
                <video className="w-full max-w-[220px] rounded-lg bg-black" src={row.videoUrl} controls playsInline />
              ) : (
                <p className="text-sm">No video on this ad.</p>
              )}
            </div>
            {canManage && row.paymentStatus !== "paid" && row.review === "pending" ? (
              <div className="mt-4 flex flex-col gap-2">
                <textarea
                  id={`ad-reason-${row.id}`}
                  className="admin-input min-h-20"
                  placeholder="Reason, if you deny this ad"
                  value={reasons[row.id] || ""}
                  onChange={(event) => setReasons((current) => ({ ...current, [row.id]: event.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="admin-btn-primary" disabled={busyId === row.id} onClick={() => void act(row, "approve")}>Approve</button>
                  <button type="button" className="admin-btn-secondary" disabled={busyId === row.id} onClick={() => void act(row, "deny")}>Deny</button>
                  <button type="button" className="admin-btn-danger" disabled={busyId === row.id} onClick={() => void act(row, "delete")}>Delete</button>
                </div>
              </div>
            ) : null}
            {canManage && row.paymentStatus !== "paid" && row.review !== "pending" ? (
              <div className="mt-4">
                <button type="button" className="admin-btn-danger" disabled={busyId === row.id} onClick={() => void act(row, "delete")}>Delete</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
