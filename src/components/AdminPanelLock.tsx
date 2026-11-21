"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LockKeyhole } from "lucide-react";
import OtpCodeBoxes from "./OtpCodeBoxes";
import { unlockPanel } from "../lib/adminPanelLock";

type Mode = "create" | "confirm" | "verify";

export function AdminPanelLocking() {
  return (
    <div className="admin-panel-lock" role="status" aria-live="polite" aria-label="Locking your system">
      <div className="admin-panel-lock-stage">
        <p className="admin-panel-lock-status">
          <span className="admin-panel-lock-spinner" aria-hidden />
          Locking your system
        </p>
      </div>
    </div>
  );
}

function sessionToken(): string {
  try {
    const raw = localStorage.getItem("admin_session");
    return raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
  } catch {
    return "";
  }
}

function saveSessionToken(token?: string) {
  if (!token) return;
  try {
    const raw = localStorage.getItem("admin_session");
    if (!raw) return;
    const session = JSON.parse(raw) as { token?: string };
    session.token = token;
    localStorage.setItem("admin_session", JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

async function postLock(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/panel-lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-session": sessionToken(),
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => null)) as {
    hasPin?: boolean;
    success?: boolean;
    error?: string;
    triesLeft?: number;
    logout?: boolean;
    needsSetup?: boolean;
    sessionToken?: string;
    message?: string;
  } | null;
  return { ok: response.ok, result };
}

export default function AdminPanelLock({
  name,
  email,
  avatarUrl,
  onUnlock,
  onLogout,
}: {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  onUnlock: () => void;
  onLogout: () => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recover, setRecover] = useState(false);
  const [code, setCode] = useState("");
  const accountRef = useRef<HTMLDivElement | null>(null);
  const initial = (name.trim() || "A").charAt(0).toUpperCase();

  useEffect(() => {
    let cancelled = false;
    void postLock({ action: "status" }).then(({ result }) => {
      if (cancelled) return;
      if (result?.logout) {
        onLogout();
        return;
      }
      setMode(result?.hasPin ? "verify" : "create");
    });
    return () => {
      cancelled = true;
    };
  }, [onLogout]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && accountRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const finish = (token?: string) => {
    saveSessionToken(token);
    unlockPanel();
    onUnlock();
  };

  const submit = async (value: string) => {
    if (busy || !mode) return;
    setError("");
    if (mode === "create") {
      setFirstPin(value);
      setPin("");
      setMode("confirm");
      return;
    }
    if (mode === "confirm") {
      if (value !== firstPin) {
        setFirstPin("");
        setPin("");
        setMode("create");
        setError("Those PINs do not match. Choose it again.");
        return;
      }
      setBusy(true);
      try {
        const { ok, result } = await postLock({ action: "set", pin: firstPin, confirm: value });
        if (result?.logout) {
          onLogout();
          return;
        }
        if (!ok || !result?.success) {
          setError(result?.error || "Could not save the PIN.");
          setPin("");
          return;
        }
        finish(result.sessionToken);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const { result } = await postLock({ action: "verify", pin: value });
      if (result?.logout) {
        onLogout();
        return;
      }
      if (result?.needsSetup) {
        setMode("create");
        setPin("");
        return;
      }
      if (!result?.success) {
        setError(result?.error || "That PIN is not right.");
        setTriesLeft(typeof result?.triesLeft === "number" ? result.triesLeft : null);
        setPin("");
        return;
      }
      finish(result.sessionToken);
    } finally {
      setBusy(false);
    }
  };

  const sendForgot = async () => {
    setMenuOpen(false);
    setError("");
    setBusy(true);
    try {
      const { ok, result } = await postLock({ action: "forgot" });
      if (result?.logout) {
        onLogout();
        return;
      }
      if (!ok || !result?.success) {
        setError(result?.error || "Could not email the code.");
        return;
      }
      setCode("");
      setRecover(true);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value: string) => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { ok, result } = await postLock({ action: "forgot-code", code: value });
      if (result?.logout) {
        onLogout();
        return;
      }
      if (!ok || !result?.success) {
        setError(result?.error || "That code is incorrect or has expired.");
        setCode("");
        return;
      }
      finish(result.sessionToken);
    } finally {
      setBusy(false);
    }
  };

  const title = recover
    ? "Enter the email code"
    : mode === "confirm"
      ? "Confirm your PIN"
      : mode === "create"
        ? "Choose a PIN"
        : "Enter your PIN";
  const detail =
    mode === "verify"
      ? "The panel is locked. Your sign-in stays saved."
      : mode === "confirm"
        ? "Enter the same 4 digits again."
        : "Pick a 4-digit PIN. You will use it when you come back, or after 15 minutes away.";

  const step = mode === "confirm" ? 2 : 1;

  return (
    <div className="admin-panel-lock" role="dialog" aria-modal="true" aria-labelledby="admin-panel-lock-title">
      <div className="admin-panel-lock-stage">
        <div className="admin-panel-lock-brand">
          <img src="/fb-mark.png" alt="" className="admin-panel-lock-logo" />
          <span>FinderB</span>
        </div>
        <div className="admin-panel-lock-card">
          <div className="admin-panel-lock-body">
            <div className="admin-panel-lock-person" ref={accountRef}>
              <button
                type="button"
                className="admin-panel-lock-account"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <div className="admin-panel-lock-photo-wrap">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="admin-panel-lock-photo" />
                  ) : (
                    <span className="admin-panel-lock-photo admin-panel-lock-initial">{initial}</span>
                  )}
                  <span className="admin-panel-lock-seal" aria-label="Locked">
                    <LockKeyhole aria-hidden />
                  </span>
                </div>
                <div className="admin-panel-lock-id">
                  <p className="admin-panel-lock-name">
                    <span>{name}</span>
                    <ChevronDown className="admin-panel-lock-caret" aria-hidden />
                  </p>
                  {email ? <p className="admin-panel-lock-email">{email}</p> : null}
                </div>
              </button>
              {menuOpen ? (
                <div className="admin-panel-lock-menu" role="menu">
                  <button type="button" role="menuitem" onClick={onLogout}>
                    Sign out and sign in as a different user
                  </button>
                  {mode === "verify" ? (
                    <button type="button" role="menuitem" disabled={busy} onClick={() => void sendForgot()}>
                      Forgot my PIN
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <h1 id="admin-panel-lock-title" className="admin-panel-lock-title">{title}</h1>
            {recover ? (
              <p className="admin-panel-lock-detail">Enter the 6-digit code sent to {email}.</p>
            ) : mode === "verify" ? null : (
              <p className="admin-panel-lock-detail">{mode ? detail : "Checking your PIN…"}</p>
            )}
            {mode === "create" || mode === "confirm" ? (
              <div className="admin-panel-lock-steps" aria-hidden>
                <span className={step === 1 ? "is-on" : "is-done"} />
                <span className={step === 2 ? "is-on" : ""} />
              </div>
            ) : null}
            {recover ? (
              <OtpCodeBoxes
                key="recover"
                value={code}
                onChange={setCode}
                onComplete={(value) => void submitCode(value)}
                disabled={busy}
                autoFocus
                invalid={Boolean(error)}
              />
            ) : mode ? (
              <OtpCodeBoxes
                key={mode}
                value={pin}
                onChange={setPin}
                onComplete={(value) => void submit(value)}
                length={4}
                disabled={busy}
                autoFocus
                invalid={Boolean(error)}
                autoComplete="off"
                variant="pin"
              />
            ) : (
              <div className="admin-panel-lock-wait" aria-hidden />
            )}
            {error ? <p className="admin-panel-lock-error">{error}</p> : null}
            {mode === "verify" && triesLeft != null ? (
              <p className="admin-panel-lock-tries">
                {triesLeft} {triesLeft === 1 ? "try" : "tries"} left before sign-out.
              </p>
            ) : null}
          </div>
        </div>
        <p className="admin-panel-lock-foot">Your authenticated session stays saved for 30 days.</p>
      </div>
    </div>
  );
}
