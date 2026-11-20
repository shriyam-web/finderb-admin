"use client";

import { useState } from "react";
import { REJECT_REASONS, SNOOZE_REASONS } from "../lib/listingDecision";
import AdminOverlay from "./AdminOverlay";

export default function ListingDecisionDialog({
  mode,
  businessName,
  onClose,
  onConfirm,
}: {
  mode: "snooze" | "reject";
  businessName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const suggestions = mode === "snooze" ? SNOOZE_REASONS : REJECT_REASONS;
  const [preset, setPreset] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "snooze" ? "😴 Put on snooze" : "Reject with reason";
  const ready = reason.trim().length >= 3 && !saving;

  return (
    <AdminOverlay zClassName="z-[240]">
      <div
        className="admin-card w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-decision-title"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="listing-decision-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{businessName}</p>
        </div>
        <form
          className="space-y-3 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            setSaving(true);
            Promise.resolve(onConfirm(reason.trim())).finally(() => setSaving(false));
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-800">Reason</span>
            <select
              className="admin-input"
              value={preset}
              onChange={(event) => {
                const next = event.target.value;
                setPreset(next);
                setReason(next === "custom" ? "" : next);
              }}
            >
              <option value="">Choose a reason</option>
              {suggestions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="custom">Write a custom reason</option>
            </select>
          </label>
          {preset ? (
            <textarea
              className="admin-input min-h-[5.5rem] py-2"
              value={reason}
              maxLength={500}
              placeholder="Write the reason"
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}
          <p className="text-xs text-slate-500">
            {mode === "snooze"
              ? "The registration moves to Ignored. It stays off the to-do list and the sidebar count until you activate it."
              : "The reason stays on this registration."}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={mode === "reject" ? "admin-btn-danger" : "admin-btn-primary"}
              disabled={!ready}
            >
              {saving ? "Saving…" : mode === "snooze" ? "😴 Snooze" : "Reject"}
            </button>
          </div>
        </form>
      </div>
    </AdminOverlay>
  );
}
