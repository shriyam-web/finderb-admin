"use client";

import { useState, type ReactNode } from "react";
import AdminOverlay from "./AdminOverlay";
import { buildAccessReport, type AccessReportTab } from "../lib/adminAccessReport";
import type { AdminAccessSession } from "../lib/adminTabAccess";

export default function AdminAccessReportButton({
  session,
  tabs,
  trigger,
}: {
  session: AdminAccessSession & { email?: string | null };
  tabs: AccessReportTab[];
  trigger: (openReport: () => void) => ReactNode;
}) {
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);

  const openReport = () => {
    setCopied(false);
    setReport(
      buildAccessReport({
        email: session.email || "",
        generatedAt: new Date(),
        session,
        tabs,
      }),
    );
  };

  const copyReport = async () => {
    const area = document.getElementById("admin-access-report-text");
    if (area instanceof HTMLTextAreaElement) {
      area.focus();
      area.select();
    }
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      return;
    } catch {
      /* The text stays selected when the clipboard is blocked. */
    }
    try {
      setCopied(document.execCommand("copy"));
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      {trigger(openReport)}
      {report ? (
        <AdminOverlay>
          <div className="admin-card flex max-h-[min(92dvh,760px)] w-full max-w-xl flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Tab and permissions</h2>
                <p className="mt-1 text-xs text-slate-500">Only the tabs this account can open.</p>
              </div>
              <button type="button" className="admin-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setReport("")}>
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <textarea
                readOnly
                value={report}
                id="admin-access-report-text"
                className="admin-input min-h-[16rem] w-full resize-y font-mono text-[12px] leading-5"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button type="button" className="admin-btn-primary w-full" onClick={() => void copyReport()}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </AdminOverlay>
      ) : null}
    </>
  );
}
