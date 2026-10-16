"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminToast } from "./AdminToast";

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
  created_at: string;
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
  const [status, setStatus] = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [rows, setRows] = useState<OwnershipRow[]>([]);
  const [note, setNote] = useState("");
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

  const act = async (row: OwnershipRow, action: "approve" | "deny") => {
    if (!adminSession?.id || !canManage) return;
    if (action === "deny" && note.trim().length < 3) {
      toast("Add a reason before denying.", "error");
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
          adminNote: note.trim(),
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not update this request.", "error");
        return;
      }
      toast(
        action === "approve"
          ? "Approved. Login details were sent only to that person."
          : "Request denied.",
      );
      setNote("");
      await load();
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
            People who asked to manage a listing. Approving replaces that business login and
            sends the new credentials only to the requester, by email and in their own FinderB
            notifications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "denied", "all"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                status === item
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {canManage ? (
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Reason, required when you deny"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
      ) : (
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
                  {row.admin_note ? (
                    <p className="mt-1 text-xs text-slate-500">Note: {row.admin_note}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700">
                  {row.status}
                </span>
              </div>
              {canManage && row.status === "pending" ? (
                <div className="mt-3 flex gap-2">
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
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
