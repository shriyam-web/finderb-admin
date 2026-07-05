"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeInr } from "../lib/formatDateTime";
import {
  collapsePlanExpiry,
  dateInputToIso,
  extendPlanExpiry,
  planLabel,
  toDateInputValue,
} from "../lib/merchantPlanAdmin";
import { getBusinessProfileUrl } from "../lib/site";

export type MerchantBusinessRecord = {
  id: string;
  fullName: string;
  workEmail: string;
  mobile: string;
  businessName: string;
  category: string;
  location: string | null;
  publicPhone: string;
  businessAddress: string;
  selectedPlan: string;
  billingCycle: string;
  isVerified: boolean;
  registrationNumber: string | null;
  kycStatus: string;
  paymentStatus: string;
  paymentId: string | null;
  orderId: string | null;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  razorpaySubscriptionId: string | null;
  subscriptionStatus: string | null;
  autoRenewEnabled: boolean;
  mandateStatus: string | null;
  createdAt: string;
  updatedAt: string;
  city: string | null;
  slug: string | null;
  email: string | null;
  state: string | null;
  status: string;
  images: string[] | null;
  profilePictureUrl: string | null;
  isFinderBVerified: boolean;
};

type MerchantDetailModalProps = {
  business: MerchantBusinessRecord;
  categories: string[];
  isController: boolean;
  isUploading: string | null;
  onClose: () => void;
  onSave: (updates: Partial<MerchantBusinessRecord>) => Promise<void>;
  onAdjustExpiry: (planExpiresAt: string | null) => Promise<void>;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
  onToggleStatus: () => void;
  onToggleFinderBVerified: () => void;
  onImageUpload: (file: File) => Promise<void>;
  onDeleteImage: (url: string) => Promise<void>;
  onSetProfilePicture: (url: string) => Promise<void>;
  setIsUploading: (value: string | null) => void;
};

function Field({
  label,
  value,
  onChange,
  editing,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  editing: boolean;
  type?: "text" | "email" | "textarea" | "select" | "date";
  options?: string[];
}) {
  if (!editing) {
    return (
      <div className="flex justify-between gap-4 px-4 py-3">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-medium text-slate-900 text-right break-all">{value || "—"}</span>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="px-4 py-3 space-y-1.5">
        <label className="text-xs text-slate-500">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <div className="px-4 py-3 space-y-1.5">
        <label className="text-xs text-slate-500">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-1.5">
      <label className="text-xs text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const toneClasses = {
    neutral: "bg-slate-50 border-slate-100 text-slate-800",
    success: "bg-emerald-50 border-emerald-100 text-emerald-800",
    warning: "bg-amber-50 border-amber-100 text-amber-800",
    danger: "bg-rose-50 border-rose-100 text-rose-800",
    info: "bg-sky-50 border-sky-100 text-sky-800",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClasses}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[11px] font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}

function paymentStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "success";
  if (normalized === "failed") return "danger";
  if (normalized === "pending") return "warning";
  return "neutral";
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MerchantDetailModal({
  business,
  categories,
  isController,
  isUploading,
  onClose,
  onSave,
  onAdjustExpiry,
  onDelete,
  onApprove,
  onReject,
  onToggleStatus,
  onToggleFinderBVerified,
  onImageUpload,
  onDeleteImage,
  onSetProfilePicture,
}: MerchantDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExpiry, setIsSavingExpiry] = useState(false);
  const [draft, setDraft] = useState(business);
  const [planExpiresInput, setPlanExpiresInput] = useState(toDateInputValue(business.planExpiresAt));

  useEffect(() => {
    setDraft(business);
    setPlanExpiresInput(toDateInputValue(business.planExpiresAt));
    setIsEditing(false);
  }, [business]);

  const patchDraft = (updates: Partial<MerchantBusinessRecord>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const expiryIso = useMemo(() => dateInputToIso(planExpiresInput), [planExpiresInput]);
  const isExpiryDirty = expiryIso !== business.planExpiresAt;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        fullName: draft.fullName,
        businessName: draft.businessName,
        workEmail: draft.workEmail,
        email: draft.email,
        mobile: draft.mobile,
        publicPhone: draft.publicPhone,
        category: draft.category,
        city: draft.city,
        state: draft.state,
        location: draft.location,
        businessAddress: draft.businessAddress,
        status: draft.status,
        kycStatus: draft.kycStatus,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const shiftExpiry = (direction: "extend" | "collapse", unit: "month" | "year") => {
    const current = expiryIso ?? business.planExpiresAt;
    const next =
      direction === "extend"
        ? extendPlanExpiry(current, unit)
        : collapsePlanExpiry(current, unit);
    setPlanExpiresInput(toDateInputValue(next));
  };

  const handleApplyExpiry = async () => {
    setIsSavingExpiry(true);
    try {
      await onAdjustExpiry(expiryIso);
    } finally {
      setIsSavingExpiry(false);
    }
  };

  const resetExpiryDraft = () => {
    setPlanExpiresInput(toDateInputValue(business.planExpiresAt));
  };

  const categoryOptions = categories.length > 0 ? categories : [draft.category || "Other"];
  const display = isEditing ? draft : business;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="flex items-start gap-5 min-w-0">
              <div className="relative shrink-0">
                {display.profilePictureUrl ? (
                  <img src={display.profilePictureUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-lg" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-semibold shadow-lg">
                    {(display.businessName || display.fullName || "?").charAt(0)}
                  </div>
                )}
                {display.isFinderBVerified && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight truncate">{display.businessName || display.fullName}</h2>
                <p className="text-sm text-white/70 mt-1 font-mono">{display.registrationNumber || display.id}</p>
                <a
                  href={getBusinessProfileUrl({
                    id: display.id,
                    businessName: display.businessName,
                    slug: display.slug,
                    city: display.city,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white mt-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
                >
                  View public profile
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${display.status === "Active" ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/80"}`}>
                    {display.status || "Inactive"}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-white/80">
                    KYC: {display.kycStatus || "—"}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-primary/30 text-white">
                    {planLabel(display.selectedPlan, display.billingCycle)}
                  </span>
                </div>
              </div>
            </div>
            {isController && (
              <div className="flex gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button type="button" onClick={() => { setDraft(business); setIsEditing(false); }} className="admin-btn-secondary text-xs !bg-white/10 !border-white/20 !text-white">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSaving} className="admin-btn-primary text-xs">
                      {isSaving ? "Saving…" : "Save profile"}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsEditing(true)} className="admin-btn-primary text-xs">
                    Edit profile
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {isController ? (
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/90 to-orange-50/50 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">FinderB Verified badge</p>
                  <p className="text-xs text-amber-800/80 mt-0.5">Independent of KYC. Controls the green badge on the public listing.</p>
                </div>
                <button
                  type="button"
                  onClick={onToggleFinderBVerified}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${display.isFinderBVerified ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${display.isFinderBVerified ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          ) : display.isFinderBVerified ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-5 py-4 text-sm text-emerald-800 shadow-sm">
              FinderB Verified badge is active on this listing.
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-50 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Subscription & billing</h3>
                <p className="text-xs text-slate-500 mt-0.5">Payment details are synced from Razorpay and cannot be edited here.</p>
              </div>
              <span className="inline-flex self-start px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-wide">
                {planLabel(business.selectedPlan, business.billingCycle)}
              </span>
            </div>

            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Payment" value={formatStatusLabel(business.paymentStatus)} tone={paymentStatusTone(business.paymentStatus)} />
              <StatTile label="Billing cycle" value={business.billingCycle === "annual" ? "Annual" : "Monthly"} />
              <StatTile label="Auto-debit" value={business.autoRenewEnabled ? "Enabled" : "Off"} tone={business.autoRenewEnabled ? "info" : "neutral"} />
              <StatTile label="Mandate" value={formatStatusLabel(business.mandateStatus || "none")} />
            </div>

            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Plan started</p>
                <p className="text-sm font-medium text-slate-900 mt-1">{formatDateTimeInr(business.planStartedAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Current expiry</p>
                <p className="text-sm font-medium text-slate-900 mt-1">{formatDateTimeInr(business.planExpiresAt)}</p>
              </div>
            </div>

            {business.subscriptionStatus && (
              <div className="px-5 pb-5">
                <p className="text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">Subscription status:</span> {formatStatusLabel(business.subscriptionStatus)}
                </p>
              </div>
            )}

            {isController && (
              <div className="border-t border-primary/10 bg-primary/[0.03] px-5 py-5 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Adjust validity</h4>
                  <p className="text-xs text-slate-500 mt-1">Extend or shorten the subscription end date. Plan, billing, and payment status stay unchanged.</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">New expiry date</label>
                    <input
                      type="date"
                      value={planExpiresInput}
                      onChange={(e) => setPlanExpiresInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {isExpiryDirty && (
                    <button type="button" onClick={resetExpiryDraft} className="admin-btn-secondary text-xs py-2.5">
                      Reset
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button type="button" onClick={() => shiftExpiry("collapse", "month")} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                    −1 month
                  </button>
                  <button type="button" onClick={() => shiftExpiry("collapse", "year")} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                    −1 year
                  </button>
                  <button type="button" onClick={() => shiftExpiry("extend", "month")} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    +1 month
                  </button>
                  <button type="button" onClick={() => shiftExpiry("extend", "year")} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    +1 year
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleApplyExpiry}
                    disabled={!isExpiryDirty || isSavingExpiry}
                    className="admin-btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingExpiry ? "Applying…" : "Apply validity change"}
                  </button>
                  {isExpiryDirty && (
                    <span className="text-[11px] text-slate-500">
                      Will change to {formatDateTimeInr(expiryIso)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Contact & profile</h3>
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm overflow-hidden">
                <Field label="Business name" value={display.businessName || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ businessName: v })} />
                <Field label="Owner" value={display.fullName || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ fullName: v })} />
                <Field label="Work email" value={display.workEmail || ""} editing={isEditing && isController} type="email" onChange={(v) => patchDraft({ workEmail: v })} />
                <Field label="Login email" value={display.email || ""} editing={isEditing && isController} type="email" onChange={(v) => patchDraft({ email: v })} />
                <Field label="Mobile" value={display.mobile || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ mobile: v })} />
                <Field label="Public phone" value={display.publicPhone || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ publicPhone: v })} />
                <Field
                  label="Category"
                  value={display.category || ""}
                  editing={isEditing && isController}
                  type="select"
                  options={categoryOptions}
                  onChange={(v) => patchDraft({ category: v })}
                />
                <Field
                  label="Listing status"
                  value={display.status || "Inactive"}
                  editing={isEditing && isController}
                  type="select"
                  options={["Active", "Inactive"]}
                  onChange={(v) => patchDraft({ status: v })}
                />
                <Field
                  label="KYC status"
                  value={display.kycStatus || "pending"}
                  editing={isEditing && isController}
                  type="select"
                  options={["pending", "approved", "rejected"]}
                  onChange={(v) => patchDraft({ kycStatus: v })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Location</h3>
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm overflow-hidden">
                <Field label="City" value={display.city || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ city: v })} />
                <Field label="State" value={display.state || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ state: v })} />
                <Field label="Location" value={display.location || ""} editing={isEditing && isController} onChange={(v) => patchDraft({ location: v })} />
                <Field label="Address" value={display.businessAddress || ""} editing={isEditing && isController} type="textarea" onChange={(v) => patchDraft({ businessAddress: v })} />
              </div>
            </div>
          </div>

          {(business.paymentId || business.orderId || business.razorpaySubscriptionId) && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Payment references</h3>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5 shadow-sm">
                {business.paymentId && (
                  <p className="text-[11px] font-mono text-slate-700 break-all">
                    <span className="text-slate-400 font-sans">Payment ID · </span>{business.paymentId}
                  </p>
                )}
                {business.orderId && (
                  <p className="text-[11px] font-mono text-slate-700 break-all">
                    <span className="text-slate-400 font-sans">Order ID · </span>{business.orderId}
                  </p>
                )}
                {business.razorpaySubscriptionId && (
                  <p className="text-[11px] font-mono text-slate-700 break-all">
                    <span className="text-slate-400 font-sans">Subscription ID · </span>{business.razorpaySubscriptionId}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Gallery ({display.images?.length || 0}/5)</h3>
              {(display.images?.length || 0) < 5 && (
                <label className={`cursor-pointer px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm ${isUploading === "businessImages" ? "opacity-50 pointer-events-none" : ""}`}>
                  {isUploading === "businessImages" ? "Uploading…" : "Add image"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImageUpload(file);
                    }}
                  />
                </label>
              )}
            </div>
            {display.images && display.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {display.images.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                    <img src={url} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover" />
                    {display.profilePictureUrl === url && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full shadow">Profile</span>
                    )}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <button type="button" onClick={() => onSetProfilePicture(url)} className="px-2 py-1 bg-white text-slate-900 text-[9px] font-semibold rounded-lg">Set profile</button>
                      <button type="button" onClick={() => onDeleteImage(url)} className="px-2 py-1 bg-rose-500 text-white text-[9px] font-semibold rounded-lg">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400 text-xs bg-slate-50/50">No gallery images</div>
            )}
          </div>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          {isController && (
            <button type="button" onClick={onDelete} className="admin-btn-danger text-xs">Delete profile</button>
          )}
          <div className="flex flex-wrap gap-2 ml-auto">
            <button type="button" onClick={onClose} className="admin-btn-secondary text-xs">Close</button>
            {isController && (
              <button type="button" onClick={onToggleStatus} className="admin-btn-secondary text-xs">
                {display.status === "Active" ? "Deactivate listing" : "Activate listing"}
              </button>
            )}
            {isController && business.kycStatus === "pending" && (
              <>
                <button type="button" onClick={onReject} className="admin-btn-danger text-xs">Reject</button>
                <button type="button" onClick={onApprove} className="admin-btn-primary text-xs">Approve partner</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
