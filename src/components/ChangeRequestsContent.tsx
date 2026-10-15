"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminToast } from "./AdminToast";
import { getBusinessProfileUrl } from "../lib/site";

type AdminSession = {
  id: string;
  email?: string;
  role?: string;
};

type ChangeRequestRow = {
  id: string;
  business_id: string;
  business_name: string;
  display_name?: string | null;
  city?: string | null;
  slug?: string | null;
  field: string;
  current_value: string;
  requested_value: string;
  status: string;
  merchant_note?: string | null;
  admin_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

const FIELD_LABEL: Record<string, string> = {
  category: "Category",
  legal_business_name: "Legal business name",
  display_name: "Display name",
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChangeRequestsContent({
  adminSession,
  canManage,
}: {
  adminSession: AdminSession | null;
  canManage: boolean;
}) {
  const { toast } = useAdminToast();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending",
  );
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ChangeRequestRow[]>([]);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        adminId: adminSession.id,
        status,
      });
      const res = await fetch(`/api/admin/change-requests?${params.toString()}`);
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not load change requests.", "error");
        return;
      }
      setRows((json.rows || []) as ChangeRequestRow[]);
    } catch {
      toast("Could not load change requests.", "error");
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === "pending").length,
    [rows],
  );

  const act = async (row: ChangeRequestRow, action: "approve" | "reject") => {
    if (!adminSession?.id || !canManage) return;
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: adminSession.id,
          requestId: row.id,
          action,
          adminNote: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not update this request.", "error");
        return;
      }
      toast(action === "approve" ? "Change applied." : "Request rejected.");
      setNote("");
      await load();
    } catch {
      toast("Could not update this request.", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Change requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Category, legal business name, and display name changes submitted by merchants.
            Approving applies the new value on the listing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((item) => (
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
          placeholder="Optional admin note for the next approve or reject"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
      ) : (
        <p className="text-xs text-amber-800">Read-only access. Ask a developer to grant edit rights.</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading requests…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No {status === "all" ? "" : `${status} `}requests</p>
          <p className="mt-1 text-xs text-slate-500">
            {pendingCount === 0 && status === "pending"
              ? "New merchant requests will appear here."
              : "Try another filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const profileUrl = getBusinessProfileUrl({
              slug: row.slug,
              id: row.business_id,
              name: row.display_name || row.business_name,
              city: row.city,
            });
            const busy = busyId === row.id;
            return (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {row.display_name || row.business_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {FIELD_LABEL[row.field] || row.field}
                      {row.city ? ` · ${row.city}` : ""}
                      {` · ${formatWhen(row.created_at)}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      row.status === "pending"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : row.status === "approved"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current</p>
                    <p className="mt-1 text-sm text-slate-800">{row.current_value || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-sky-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Requested</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{row.requested_value}</p>
                  </div>
                </div>
                {row.merchant_note ? (
                  <p className="mt-3 text-xs text-slate-600">
                    Merchant note: {row.merchant_note}
                  </p>
                ) : null}
                {row.admin_note ? (
                  <p className="mt-1 text-xs text-slate-500">Admin note: {row.admin_note}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {profileUrl ? (
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open listing
                    </a>
                  ) : null}
                  {canManage && row.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(row, "approve")}
                        className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busy ? "Saving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(row, "reject")}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
