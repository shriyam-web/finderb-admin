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
      <div className="admin-goodbye-card w-full max-w-sm rounded-2xl border border-stone-200 bg-white px-7 py-8 text-left shadow-none">
        <h1>Goodbye</h1>
        <p>This session is closed.</p>
        <dl>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="admin-goodbye-actions">
          <Link href="/" className="admin-btn-primary h-11">
            Log back in
          </Link>
          <button type="button" onClick={() => window.close()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
