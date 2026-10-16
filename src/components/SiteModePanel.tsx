"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  effectiveSiteMode,
  siteModeLabel,
  type SiteMode,
  type SiteRuntime,
} from "../lib/siteRuntime";
import AdminOverlay from "./AdminOverlay";
import { useAdminPanelRefresh } from "../lib/adminPanelRefresh";

type Props = {
  adminId: string;
  onModeChange?: (mode: SiteMode) => void;
};

const MODES: { id: SiteMode; title: string; line: string }[] = [
  {
    id: "normal",
    title: "Live",
    line: "The full FinderB website, with images and the usual layout.",
  },
  {
    id: "text_only",
    title: "Text only",
    line: "The website stays up, but images and media are hidden.",
  },
  {
    id: "maintenance",
    title: "Maintenance",
    line: "Visitors see a simple maintenance page instead of FinderB.",
  },
];

function formatWindow(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default function SiteModePanel({ adminId, onModeChange }: Props) {
  const [runtime, setRuntime] = useState<SiteRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");
  const [code, setCode] = useState("");
  const [codeHint, setCodeHint] = useState("");
  const [pendingMode, setPendingMode] = useState<SiteMode | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const sentKeyRef = useRef("");

  const effective = runtime ? effectiveSiteMode(runtime) : "normal";
  const selected = pendingMode ?? effective;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/site-mode", { cache: "no-store" });
      const data = (await res.json()) as {
        success?: boolean;
        runtime?: SiteRuntime;
        error?: string;
      };
      if (!res.ok || !data.success || !data.runtime) {
        throw new Error(data.error || "Could not load website mode.");
      }
      setRuntime(data.runtime);
      onModeChange?.(effectiveSiteMode(data.runtime));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load website mode.");
    } finally {
      setLoading(false);
    }
  }, [onModeChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useAdminPanelRefresh(load);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const defaultUntil = useMemo(() => {
    const next = new Date();
    next.setHours(next.getHours() + 2);
    return toLocalInput(next);
  }, []);

  const closeModal = () => {
    setPendingMode(null);
    setCode("");
    setCodeHint("");
    setError("");
    sentKeyRef.current = "";
  };

  const sendCode = async () => {
    setBusy(true);
    setError("");
    setCodeHint("");
    try {
      const res = await fetch("/api/admin/site-mode/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not send the code.");
      }
      setCodeHint(data.message || "Code sent.");
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pendingMode) return;
    const key = pendingMode;
    if (sentKeyRef.current === key) return;
    sentKeyRef.current = key;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMode]);

  const applyMode = async (mode: SiteMode) => {
    if (code.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit email code first.");
      return;
    }
    if (mode === "maintenance") {
      if (!message.trim()) {
        setError("Enter the message users should see.");
        return;
      }
      if (!until) {
        setError("Choose when maintenance should end.");
        return;
      }
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/site-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId,
          mode,
          message,
          until: until ? new Date(until).toISOString() : undefined,
          code,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        runtime?: SiteRuntime;
        error?: string;
      };
      if (!res.ok || !data.success || !data.runtime) {
        throw new Error(data.error || "Could not update website mode.");
      }
      setRuntime(data.runtime);
      onModeChange?.(effectiveSiteMode(data.runtime));
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update website mode.");
    } finally {
      setBusy(false);
    }
  };

  const openChange = (mode: SiteMode) => {
    setError("");
    setCode("");
    setCodeHint("");
    if (mode === "maintenance") {
      setMessage((current) => current || runtime?.message || "");
      setUntil((current) => current || defaultUntil);
    }
    setPendingMode(mode);
  };

  return (
    <div className="admin-card overflow-hidden max-w-3xl">
      <div className="p-5 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Developer only
        </p>
        <h2 className="text-lg font-semibold text-slate-900 mt-1">FinderB website mode</h2>
        <p className="text-xs text-slate-500 mt-1">
          Switch between live, text only, and maintenance. Every change is confirmed with a
          6-digit email code — no password.
        </p>
        {runtime && (
          <p className="text-xs text-slate-600 mt-3">
            Current: <span className="font-semibold">{siteModeLabel(effective)}</span>
            {effective === "maintenance" && runtime.until ? (
              <> until {formatWindow(runtime.until)} IST</>
            ) : null}
          </p>
        )}
      </div>

      {loading ? (
        <p className="p-5 text-sm text-slate-500">Loading website mode…</p>
      ) : (
        <div className="p-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Website mode
            </span>
            <select
              value={selected}
              disabled={busy}
              onChange={(e) => {
                const mode = e.target.value as SiteMode;
                if (mode === effective && mode !== "maintenance") return;
                openChange(mode);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {MODES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              {MODES.find((item) => item.id === selected)?.line}
            </p>
          </label>

          {effective === "maintenance" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => openChange("maintenance")}
              className="admin-btn-ghost"
            >
              Update maintenance details
            </button>
          ) : null}

          {error && !pendingMode ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      )}

      {pendingMode ? (
        <AdminOverlay className="flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-md rounded-t-xl border border-slate-200 bg-white p-5 sm:rounded-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Email confirmation
            </p>
            <h3 className="text-base font-semibold text-slate-900 mt-1">
              Switch to {siteModeLabel(pendingMode)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              We emailed a 6-digit code to the Developer inbox. Enter it to apply this mode.
            </p>

            {pendingMode === "maintenance" ? (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Message visitors will see
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                    placeholder="We are updating FinderB. Please check back after 6 pm."
                  />
                  <span className="text-[10px] text-slate-500">{message.length}/500</span>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Keep maintenance on until
                  </span>
                  <input
                    type="datetime-local"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </label>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[140px] space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Email code
                </span>
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm tracking-[0.3em]"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </label>
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={busy || resendIn > 0}
                className="admin-btn-ghost"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
            {codeHint ? <p className="text-xs text-emerald-700 mt-2">{codeHint}</p> : null}
            {error ? <p className="text-sm text-rose-600 mt-2">{error}</p> : null}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={closeModal} className="admin-btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyMode(pendingMode)}
                className="admin-btn-primary flex-1"
              >
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </AdminOverlay>
      ) : null}
    </div>
  );
}
