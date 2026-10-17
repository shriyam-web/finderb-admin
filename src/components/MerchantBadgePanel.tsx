"use client";

import { useEffect, useState } from "react";
import { BADGE_COPY, BADGE_HINT, type BadgeId, type BadgeReport } from "../lib/businessBadges";
import { loadMerchantBadgeReports, saveBadgeOverride } from "../lib/loadMerchantBadges";
import { logMerchantAudit } from "../lib/merchantAudit";

function adminActor() {
  try {
    const raw = localStorage.getItem("admin_session");
    if (!raw) return null;
    const session = JSON.parse(raw) as { id?: string; email?: string; role?: string };
    return { id: session.id, email: session.email, role: session.role };
  } catch {
    return null;
  }
}

function eligibilityLabel(badge: BadgeReport): string {
  if (badge.id === "trusted") return badge.active ? "Awarded by admin" : "Admin award only";
  if (badge.earned && badge.override === "off") return "Self eligible · hidden";
  if (badge.earned) return "Self eligible · on automatically";
  if (badge.active) return "Not self eligible · forced on";
  return "Not self eligible";
}

export default function MerchantBadgePanel({
  businessId,
  canManage,
  mode = "full",
}: {
  businessId: string;
  canManage: boolean;
  mode?: "summary" | "full";
}) {
  const [reports, setReports] = useState<BadgeReport[] | null>(null);
  const [overridesReady, setOverridesReady] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<BadgeId | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError("");
    void loadMerchantBadgeReports(businessId)
      .then((result) => {
        if (cancelled) return;
        setReports(result.reports);
        setOverridesReady(result.overridesReady);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setReports([]);
        setError(loadError instanceof Error ? loadError.message : "Could not load badges");
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const setMode = async (badge: BadgeReport, mode: "auto" | "on" | "off") => {
    if (!canManage || !reports || mode === badge.override) return;
    setSaving(badge.id);
    setError("");
    try {
      await saveBadgeOverride(businessId, badge.id, mode, reports);
      const next = await loadMerchantBadgeReports(businessId, true);
      setReports(next.reports);
      setOverridesReady(next.overridesReady);
      const summary =
        mode === "auto"
          ? `Set ${badge.label} back to automatic`
          : mode === "on"
            ? `Forced ${badge.label} on`
            : `Forced ${badge.label} off`;
      await logMerchantAudit({
        merchantId: businessId,
        actor: adminActor(),
        action: "badge.override",
        summary,
        changes: { [badge.id]: { from: badge.override, to: mode } },
      });
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Could not save badge");
    } finally {
      setSaving(null);
    }
  };

  const showing = (reports || []).filter((badge) => badge.active);

  if (mode === "summary") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-900">Public badges</p>
        {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
        {!reports && !error ? <p className="mt-1 text-[11px] text-slate-500">Checking…</p> : null}
        {reports && !error ? (
          <p className="mt-1 text-[11px] leading-4 text-slate-600">
            {showing.length ? showing.map((badge) => badge.label).join(" · ") : "None showing on the profile."}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-500">Eligibility and switches are on the Badges tab.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-900">Public badges</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          A badge that already qualifies turns on by itself. Auto keeps that. On forces it on. Off hides it. FinderB Trusted stays off until an admin turns it on.
        </p>
      </div>
      {!overridesReady ? (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          Badge switches need the badgeOverrides column. Run supabase/business_badges.sql, then reload.
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
      {!reports ? (
        <p className="text-[11px] text-slate-500">Checking…</p>
      ) : (
        reports.map((badge) => (
          <div key={badge.id} className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {badge.id === "trusted" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#12263A] py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-white">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#C6A15B] text-[8px] font-bold text-[#12263A]">
                    ✓
                  </span>
                  FinderB <span className="font-medium text-[#F3E2B3]">Trusted</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-700">{badge.label}</span>
              )}
              <span className={`text-[11px] font-medium ${badge.earned || badge.active ? "text-emerald-700" : "text-slate-500"}`}>
                {eligibilityLabel(badge)}
              </span>
            </div>
            <p className="text-[11px] leading-4 text-slate-600">{badge.detail}</p>
            <p className="text-[11px] leading-4 text-slate-500">{BADGE_HINT[badge.id]}</p>
            <ul className="list-disc pl-4 text-[11px] leading-4 text-slate-500">
              {BADGE_COPY[badge.id].eligibility.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="flex gap-1">
              {(["auto", "on", "off"] as const).map((mode) => {
                const selected = badge.override === mode;
                const label = mode === "auto" ? "Auto" : mode === "on" ? "On" : "Off";
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={!canManage || !overridesReady || saving === badge.id}
                    onClick={() => void setMode(badge, mode)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold border ${
                      selected
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    } disabled:opacity-50`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
