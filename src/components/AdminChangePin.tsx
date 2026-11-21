"use client";

import { useState } from "react";
import OtpCodeBoxes from "./OtpCodeBoxes";

type Step = "password" | "code" | "pin" | "confirm" | "done";

function sessionToken(): string {
  try {
    const raw = localStorage.getItem("admin_session");
    return raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
  } catch {
    return "";
  }
}

export default function AdminChangePin({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pinToken, setPinToken] = useState("");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const post = async (body: Record<string, string>) => {
    const response = await fetch("/api/admin/panel-lock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-session": sessionToken(),
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      message?: string;
      pinToken?: string;
    } | null;
    return json;
  };

  const verifyPassword = async () => {
    setError("");
    setNote("");
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      const json = await post({ action: "change-start", password });
      if (!json?.success) {
        setError(json?.error || "Could not check that password.");
        return;
      }
      setPassword("");
      setStep("code");
      setNote(json.message || "Check your email for the code.");
    } catch {
      setError("Could not reach FinderB. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (value = code) => {
    setError("");
    if (value.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const json = await post({ action: "change-code", code: value });
      if (!json?.success || !json.pinToken) {
        setError(json?.error || "That code is incorrect or has expired.");
        setCode("");
        return;
      }
      setPinToken(json.pinToken);
      setStep("pin");
      setNote("");
    } catch {
      setError("Could not reach FinderB. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const choosePin = (value: string) => {
    setFirstPin(value);
    setPin("");
    setError("");
    setStep("confirm");
  };

  const savePin = async (value: string) => {
    if (value !== firstPin) {
      setFirstPin("");
      setPin("");
      setStep("pin");
      setError("Those PINs do not match. Choose it again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const json = await post({ action: "change", pinToken, pin: firstPin, confirm: value });
      if (!json?.success) {
        setError(json?.error || "Could not save the new PIN.");
        setPin("");
        return;
      }
      setStep("done");
      setNote("Your panel PIN is updated.");
    } catch {
      setError("Could not reach FinderB. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Account security</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Change PIN</h2>
          <p className="mt-1 text-sm text-slate-500">
            {step === "password" && "Confirm your password. FinderB then emails a code."}
            {step === "code" && `Enter the code sent to ${email}.`}
            {step === "pin" && "Choose a new 4-digit PIN."}
            {step === "confirm" && "Enter the same 4 digits again."}
            {step === "done" && "Your panel PIN is updated."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="admin-btn-secondary !px-2.5 !py-1.5 text-xs">
          Close
        </button>
      </div>
      <div className="space-y-4 px-5 py-5">
        <ol className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-400">
          {["Password", "Email code", "New PIN"].map((label, index) => {
            const active =
              (index === 0 && step === "password") ||
              (index === 1 && step === "code") ||
              (index === 2 && (step === "pin" || step === "confirm" || step === "done"));
            return (
              <li key={label} className={`rounded-full px-2.5 py-1 ${active ? "bg-orange-50 text-orange-800" : "bg-slate-50"}`}>
                {index + 1}. {label}
              </li>
            );
          })}
        </ol>
        {step === "password" ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-800">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="admin-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verifyPassword();
              }}
            />
          </label>
        ) : null}
        {step === "code" ? (
          <OtpCodeBoxes
            key="code"
            value={code}
            onChange={setCode}
            onComplete={(value) => void confirmCode(value)}
            disabled={busy}
            autoFocus
            invalid={Boolean(error)}
          />
        ) : null}
        {step === "pin" || step === "confirm" ? (
          <OtpCodeBoxes
            key={step}
            value={pin}
            onChange={setPin}
            onComplete={(value) => {
              if (step === "pin") choosePin(value);
              else void savePin(value);
            }}
            length={4}
            disabled={busy}
            autoFocus
            invalid={Boolean(error)}
            autoComplete="off"
          />
        ) : null}
        {note ? <p className="text-sm text-slate-600">{note}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          {step === "password" ? (
            <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => void verifyPassword()}>
              {busy ? "Checking…" : "Email me a code"}
            </button>
          ) : null}
          {step === "done" ? (
            <button type="button" className="admin-btn-primary" onClick={onClose}>
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
