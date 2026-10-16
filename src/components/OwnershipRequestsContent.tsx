"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminToast } from "./AdminToast";
import { ADMIN_PANEL_REFRESH, requestAdminPanelRefresh } from "../lib/adminPanelRefresh";

type AdminSession = { id: string; email?: string; role?: string };

type OwnershipRow = {
  id: string;
  business_id: string;
  business_name: string;
  city?: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  status: string;
  admin_note?: string | null;
  owner_note?: string | null;
  owner_opinion?: "waiting" | "approved" | "denied" | "expired" | string;
  owner_deadline_at?: string | null;
  reversible?: boolean;
  reversible_until?: string | null;
  created_at: string;
};

const OPINION_LABEL: Record<string, string> = {
  waiting: "Waiting for the current owner",
  approved: "Current owner approved",
  denied: "Current owner denied",
  expired: "Current business didn't respond",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OwnershipRequestsContent({
  adminSession,
  canManage,
  focusId = null,
}: {
  adminSession: AdminSession | null;
  canManage: boolean;
  focusId?: string | null;
}) {
  const { toast } = useAdminToast();
  const [status, setStatus] = useState<"pending" | "approved" | "denied" | "reversed" | "reversible" | "all">("pending");
  const [rows, setRows] = useState<OwnershipRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminSession?.id) return;
    const params = new URLSearchParams({ adminId: adminSession.id, status });
    const res = await fetch(`/api/admin/ownership-requests?${params.toString()}`);
    const json = await res.json();
    if (!json?.success) {
      toast(json?.error || "Could not load ownership requests.", "error");
      return;
    }
    setRows((json.rows || []) as OwnershipRow[]);
  }, [adminSession?.id, status, toast]);

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
    setStatus("pending");
  }, [focusId]);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`admin-focus-${focusId}`)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [focusId, rows]);

  const act = async (row: OwnershipRow, action: "approve" | "deny" | "reverse") => {
    if (!adminSession?.id || !canManage) return;
    const reason = (notes[row.id] || "").trim();
    if (action === "deny" && reason.length < 3) {
      toast("Write the reason in the box on this request, then deny it.", "error");
      document.getElementById(`deny-reason-${row.id}`)?.focus();
      return;
    }
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/ownership-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: adminSession.id,
          requestId: row.id,
          action,
          adminNote: reason,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not update this request.", "error");
        return;
      }
      toast(
        action === "approve"
          ? "Approved. Login details were sent only to that person. You can reverse this for 15 days."
          : action === "reverse"
            ? "Transfer reversed. The previous login works again."
            : "Request denied.",
      );
      setNotes((current) => {
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ownership requests</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            The current owner is emailed and gets a high-priority notification. They can approve
            or deny in the app for 48 hours, and that answer shows on the card. If they do not
            answer, the card says the business did not respond and you decide. An approved
            transfer can be reversed for 15 days from Can reverse.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "denied", "reversed", "reversible", "all"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                status === item
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {item === "reversible" ? "Can reverse" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {canManage ? null : (
        <p className="text-sm text-slate-500">You can view these requests. Editing needs access from a developer.</p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No requests in this list.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              id={`admin-focus-${row.id}`}
              className={`rounded-xl border bg-white p-4 ${
                focusId === row.id ? "border-amber-300 ring-2 ring-amber-300" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{row.business_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[row.city, formatWhen(row.created_at)].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {row.requester_name} · {row.requester_email} · +91 {row.requester_phone}
                  </p>
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      row.owner_opinion === "approved"
                        ? "text-emerald-700"
                        : row.owner_opinion === "denied"
                          ? "text-rose-700"
                          : row.owner_opinion === "expired"
                            ? "text-amber-700"
                            : "text-slate-600"
                    }`}
                  >
                    {OPINION_LABEL[row.owner_opinion || "waiting"] || "Waiting for the current owner"}
                    {row.owner_opinion === "waiting" && row.owner_deadline_at
                      ? ` · until ${formatWhen(row.owner_deadline_at)}`
                      : ""}
                  </p>
                  {row.owner_opinion === "denied" && row.owner_note ? (
                    <p className="mt-1 text-xs text-slate-500">Owner reason: {row.owner_note}</p>
                  ) : null}
                  {row.admin_note ? (
                    <p className="mt-1 text-xs text-slate-500">Note: {row.admin_note}</p>
                  ) : null}
                  {row.reversible && row.reversible_until ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Reversible until {formatWhen(row.reversible_until)}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700">
                  {row.status}
                </span>
              </div>
              {canManage && row.status === "pending" ? (
                <div className="mt-3 space-y-2">
                  <label className="block" htmlFor={`deny-reason-${row.id}`}>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Reason for denying</span>
                    <textarea
                      id={`deny-reason-${row.id}`}
                      value={notes[row.id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      rows={2}
                      placeholder="Write why this request is denied. Required before Deny."
                      className="admin-input min-h-[72px]"
                    />
                  </label>
                  <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row, "approve")}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Approve and send login
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row, "deny")}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Deny
                  </button>
                  </div>
                </div>
              ) : null}
              {canManage && row.reversible ? (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row, "reverse")}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Reverse transfer
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
