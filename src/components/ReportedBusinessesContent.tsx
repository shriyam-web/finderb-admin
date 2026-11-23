"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminToast } from "./AdminToast";
import AdminContentLoader from "./AdminContentLoader";
import { getBusinessProfileUrl } from "../lib/site";

type AdminSession = { id: string; email?: string; role?: string };

type BusinessReportRow = {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug?: string | null;
  businessCity?: string | null;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  createdAt: string;
  reportCount: number;
};

function formatWhen(value: string) {
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

export default function ReportedBusinessesContent({
  adminSession,
  canManage,
}: {
  adminSession: AdminSession | null;
  canManage: boolean;
}) {
  const { toast } = useAdminToast();
  const [rows, setRows] = useState<BusinessReportRow[]>([]);
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminSession?.id) {
      setReady(true);
      return;
    }
    try {
      const params = new URLSearchParams({ adminId: adminSession.id });
      const res = await fetch(`/api/admin/business-reports?${params.toString()}`);
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not load reported businesses.", "error");
        return;
      }
      setRows((json.rows || []) as BusinessReportRow[]);
    } catch {
      toast("Could not load reported businesses.", "error");
    } finally {
      setReady(true);
    }
  }, [adminSession?.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const markFalse = async (row: BusinessReportRow) => {
    if (!adminSession?.id || !canManage) return;
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/business-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: adminSession.id, reportId: row.id }),
      });
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not remove this report.", "error");
        return;
      }
      toast("Report removed.");
      setRows((current) => {
        const next = current.filter((item) => item.id !== row.id);
        const remaining = next.filter((item) => item.businessId === row.businessId).length;
        return next.map((item) =>
          item.businessId === row.businessId ? { ...item, reportCount: remaining } : item
        );
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return <AdminContentLoader label="Loading reported businesses" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reported businesses</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Reports sent from a business profile. Mark a report as false when it should not stay on the business.
        </p>
      </div>
      {!canManage ? (
        <p className="text-sm text-slate-500">You can view these reports. Removing one needs edit access.</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No reports yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const profileUrl = getBusinessProfileUrl({
              id: row.businessId,
              slug: row.businessSlug,
              businessName: row.businessName,
              city: row.businessCity,
            });
            return (
              <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {row.businessName}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.reportCount} report{row.reportCount === 1 ? "" : "s"} on this business
                    </p>
                    <p className="mt-3 text-sm text-slate-800">{row.reason}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {row.reporterName}
                      {row.reporterEmail ? ` · ${row.reporterEmail}` : ""}
                      {" · "}
                      {formatWhen(row.createdAt)}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void markFalse(row)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-50"
                    >
                      {busyId === row.id ? "Removing…" : "Mark report as false"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
