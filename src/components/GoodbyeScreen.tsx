"use client";

import Link from "next/link";
import { formatSessionLength } from "../lib/formatDateTime";

function formatStamp(ms: number) {
  return new Date(ms).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function GoodbyeScreen({
  startedAt,
  endedAt,
}: {
  startedAt: number;
  endedAt: number;
}) {
  const rows = [
    { label: "Session started", value: formatStamp(startedAt) },
    { label: "Session ended", value: formatStamp(endedAt) },
    { label: "Total session time", value: formatSessionLength(endedAt - startedAt) },
  ];

  return (
    <div className="admin-goodbye fixed inset-0 z-[10000] flex items-center justify-center bg-[#f5f5f4] px-6 text-[#1c1917]">
      <div className="admin-goodbye-card w-full max-w-md rounded-2xl border border-stone-200 bg-white px-8 py-10 text-center shadow-none">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-400">FinderB Admin</p>
        <h1 className="mt-3 text-4xl font-light tracking-tight">Goodbye</h1>
        <p className="mt-2 text-sm text-stone-500">This session is closed.</p>
        <dl className="mt-8 space-y-3 text-left">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-3">
              <dt className="text-xs text-stone-500">{row.label}</dt>
              <dd className="text-sm font-medium tabular-nums text-stone-900">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/" className="admin-btn-primary h-11 text-[15px]">
            Log back in
          </Link>
          <button
            type="button"
            onClick={() => window.close()}
            className="h-11 rounded-lg border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
