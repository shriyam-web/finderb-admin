"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import OtpCodeBoxes from "./OtpCodeBoxes";
import {
  adminPasswordChecks,
  validateAdminPasswordChange,
} from "../lib/adminPasswordPolicy";

type Step = "current" | "code" | "next" | "done";

export default function AdminChangePassword({
  adminId,
  email,
  onClose,
}: {
  adminId: string;
  email: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("current");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [changeToken, setChangeToken] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const checks = adminPasswordChecks(nextPassword, email);

  const post = async (body: Record<string, string>) => {
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, ...body }),
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      message?: string;
      changeToken?: string;
    } | null;
    return { response, json };
  };

  const verifyCurrent = async () => {
    setError("");
    setNote("");
    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    setBusy(true);
    try {
      const { json } = await post({ action: "verify", currentPassword });
      if (!json?.success) {
        setError(json?.error || "Could not verify that password.");
        return;
      }
      setCurrentPassword("");
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
      const { json } = await post({ action: "confirm", code: value });
      if (!json?.success || !json.changeToken) {
        setError(json?.error || "That code is incorrect or has expired.");
        return;
      }
      setChangeToken(json.changeToken);
      setStep("next");
      setNote("");
    } catch {
      setError("Could not reach FinderB. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveNext = async () => {
    setError("");
    const policy = validateAdminPasswordChange({
      newPassword: nextPassword.trim(),
      confirmPassword: confirmPassword.trim(),
      email,
    });
    if (policy) {
      setError(policy);
      return;
    }
    setBusy(true);
    try {
      const { json } = await post({
        action: "change",
        changeToken,
        newPassword: nextPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });
      if (!json?.success) {
        setError(json?.error || "Could not change the password.");
        return;
      }
      setNextPassword("");
      setConfirmPassword("");
      setChangeToken("");
      setNote(json.message || "Password updated.");
      setStep("done");
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
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Account security
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Change password</h2>
          <p className="mt-1 text-sm text-slate-500">
            {step === "current" && "Confirm the password you use today."}
            {step === "code" && `Enter the code sent to ${email}.`}
            {step === "next" && "Choose a new password and type it once more."}
            {step === "done" && "Your admin password is updated."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="admin-btn-secondary !px-2.5 !py-1.5 text-xs">
          Close
        </button>
      </div>

      <div className="space-y-4 px-5 py-5">
        <ol className="flex gap-2 text-[11px] font-medium text-slate-400">
          {["Current", "Email code", "New password"].map((label, index) => {
            const active =
              (index === 0 && step === "current") ||
              (index === 1 && step === "code") ||
              (index === 2 && (step === "next" || step === "done"));
            const done =
              (index === 0 && step !== "current") ||
              (index === 1 && (step === "next" || step === "done")) ||
              (index === 2 && step === "done");
            return (
              <li
                key={label}
                className={`rounded-full px-2.5 py-1 ${
                  active || done ? "bg-orange-50 text-orange-800" : "bg-slate-50"
                }`}
              >
                {index + 1}. {label}
              </li>
            );
          })}
        </ol>

        {step === "current" ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-800">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="admin-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verifyCurrent();
              }}
            />
          </label>
        ) : null}

        {step === "code" ? (
          <div className="space-y-3">
            <OtpCodeBoxes
              value={code}
              onChange={setCode}
              onComplete={(value) => void confirmCode(value)}
              disabled={busy}
              autoFocus
            />
            <button
              type="button"
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
              disabled={busy}
              onClick={() => {
                setStep("current");
                setCode("");
                setError("");
                setNote("Enter your current password again to send a new code.");
              }}
            >
              Send a new code
            </button>
          </div>
        ) : null}

        {step === "next" ? (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-800">New password</span>
              <div className="relative">
                <input
                  type={showNext ? "text" : "password"}
                  autoComplete="new-password"
                  className="admin-input !pr-10"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNext((value) => !value)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showNext ? "Hide password" : "Show password"}
                >
                  {showNext ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-800">Confirm new password</span>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="admin-input !pr-10"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </label>
            <ul className="space-y-1.5">
              {checks.map((item) => (
                <li key={item.id} className={`text-xs ${item.met ? "text-emerald-700" : "text-slate-500"}`}>
                  {item.met ? "Ready" : "Needs"} — {item.label}
                </li>
              ))}
              <li
                className={`text-xs ${
                  confirmPassword && confirmPassword === nextPassword ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {confirmPassword && confirmPassword === nextPassword ? "Ready" : "Needs"} — Both passwords match
              </li>
            </ul>
          </div>
        ) : null}

        {step === "done" ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{note}</p>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {note && step !== "done" ? <p className="text-sm text-slate-600">{note}</p> : null}

        <div className="flex gap-2 pt-1">
          {step !== "done" ? (
            <button type="button" onClick={onClose} className="admin-btn-secondary flex-1">
              Cancel
            </button>
          ) : null}
          {step === "current" ? (
            <button type="button" onClick={() => void verifyCurrent()} disabled={busy} className="admin-btn-primary flex-1">
              {busy ? "Checking…" : "Continue"}
            </button>
          ) : null}
          {step === "code" ? (
            <button type="button" onClick={() => void confirmCode()} disabled={busy} className="admin-btn-primary flex-1">
              {busy ? "Checking…" : "Verify code"}
            </button>
          ) : null}
          {step === "next" ? (
            <button type="button" onClick={() => void saveNext()} disabled={busy} className="admin-btn-primary flex-1">
              {busy ? "Saving…" : "Update password"}
            </button>
          ) : null}
          {step === "done" ? (
            <button type="button" onClick={onClose} className="admin-btn-primary w-full">
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
