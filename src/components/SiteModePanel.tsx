"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  effectiveSiteMode,
  siteModeLabel,
  type SiteMode,
  type SiteRuntime,
} from "../lib/siteRuntime";

type Props = {
  adminId: string;
  onModeChange?: (mode: SiteMode) => void;
};

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
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");
  const [code, setCode] = useState("");
  const [codeHint, setCodeHint] = useState("");
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);

  const effective = runtime ? effectiveSiteMode(runtime) : "normal";

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

  const defaultUntil = useMemo(() => {
    const next = new Date();
    next.setHours(next.getHours() + 2);
    return toLocalInput(next);
  }, []);

  const applyMode = async (mode: SiteMode) => {
    if (!password.trim()) {
      setError("Enter your Developer password to change website mode.");
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
      if (code.replace(/\D/g, "").length !== 6) {
        setError("Enter the 6-digit email code first.");
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
          password,
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
      setPassword("");
      setCode("");
      setCodeHint("");
      setShowMaintenanceForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update website mode.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!password.trim()) {
      setError("Enter your Developer password, then send the email code.");
      return;
    }
    setBusy(true);
    setError("");
    setCodeHint("");
    try {
      const res = await fetch("/api/admin/site-mode/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, password }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not send the code.");
      }
      setCodeHint(data.message || "Code sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const modes: { id: SiteMode; title: string; line: string }[] = [
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
      line: "Visitors see a simple under-maintenance page instead of FinderB.",
    },
  ];

  return (
    <div className="admin-card overflow-hidden max-w-3xl">
      <div className="p-5 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Developer only
        </p>
        <h2 className="text-lg font-semibold text-slate-900 mt-1">FinderB website mode</h2>
        <p className="text-xs text-slate-500 mt-1">
          Live, text only, or a full maintenance screen. Maintenance needs your password, an email
          code, a public message, and an end time.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modes.map((item) => {
              const active = effective === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setError("");
                    if (item.id === "maintenance") {
                      setShowMaintenanceForm(true);
                      setMessage((current) => current || runtime?.message || "");
                      setUntil((current) => current || defaultUntil);
                      return;
                    }
                    setShowMaintenanceForm(false);
                    if (effective === item.id) return;
                    void applyMode(item.id);
                  }}
                  disabled={busy}
                  className={`text-left rounded-2xl border p-4 transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                    {item.title}
                  </p>
                  <p className={`text-[11px] mt-1 leading-relaxed ${active ? "text-white/70" : "text-slate-500"}`}>
                    {item.line}
                  </p>
                </button>
              );
            })}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Developer password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
              placeholder="Required for every mode change"
              autoComplete="current-password"
            />
          </label>

          {showMaintenanceForm && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
                  Message visitors will see
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-sm bg-white"
                  placeholder="We are updating FinderB. Please check back after 6 pm."
                />
                <span className="text-[10px] text-slate-500">{message.length}/500</span>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
                  Keep maintenance on until
                </span>
                <input
                  type="datetime-local"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-sm bg-white"
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[140px] space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
                    Email code
                  </span>
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-sm bg-white tracking-[0.3em]"
                    placeholder="000000"
                    maxLength={6}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={busy}
                  className="admin-btn-ghost !border-amber-300"
                >
                  Send code
                </button>
                <button
                  type="button"
                  onClick={() => void applyMode("maintenance")}
                  disabled={busy}
                  className="admin-btn-primary"
                >
                  {busy ? "Saving…" : "Turn on maintenance"}
                </button>
              </div>
              {codeHint ? <p className="text-xs text-emerald-700">{codeHint}</p> : null}
            </div>
          )}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
