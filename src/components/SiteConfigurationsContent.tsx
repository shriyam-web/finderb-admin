"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_CONFIG_FORM,
  type SiteConfigForm,
} from "../lib/siteConfigAdmin";

type Props = {
  adminId: string;
  canManage: boolean;
};

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
      />
    </label>
  );
}

type PromotionPrice = {
  id: string;
  name: string;
  priceInr: number;
  referenceInr: number;
};

export default function SiteConfigurationsContent({ adminId, canManage }: Props) {
  const [form, setForm] = useState<SiteConfigForm>(DEFAULT_SITE_CONFIG_FORM);
  const [promotionPrices, setPromotionPrices] = useState<PromotionPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/admin/site-config?adminId=${encodeURIComponent(adminId)}`);
        const body = (await response.json()) as {
          success?: boolean;
          config?: SiteConfigForm;
          promotionPrices?: PromotionPrice[];
          error?: string;
        };
        if (!cancelled && body.success && body.config) setForm(body.config);
        if (!cancelled && body.success && body.promotionPrices) setPromotionPrices(body.promotionPrices);
        if (!cancelled && !body.success) setError(body.error || "Could not load site configuration.");
      } catch {
        if (!cancelled) setError("Could not load site configuration.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminId]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, config: form, promotionPrices }),
      });
      const body = (await response.json()) as { success?: boolean; error?: string };
      if (!body.success) setError(body.error || "Could not save.");
      else setMessage("Saved. The website and app pick this up within a few seconds. A new Growth price applies to the next checkout, and a new monthly Razorpay plan is created when that amount changes. Existing mandates stay on their current plan. Promotion prices apply to the next Promote your business online checkout. Orders already placed keep the price the merchant paid.");
    } catch {
      setError("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const setPrice = (key: keyof SiteConfigForm["pricing"], value: string) => {
    const amount = Number(value);
    setForm((current) => ({
      ...current,
      pricing: { ...current.pricing, [key]: Number.isFinite(amount) ? amount : 0 },
    }));
  };

  const setPromotionPrice = (id: string, key: "priceInr" | "referenceInr", value: string) => {
    const amount = Number(value);
    setPromotionPrices((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [key]: Number.isFinite(amount) ? amount : 0 } : item,
      ),
    );
  };

  const setContact = (key: keyof SiteConfigForm["contact"], value: string | boolean) => {
    setForm((current) => ({
      ...current,
      contact: { ...current.contact, [key]: value },
    }));
  };

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Loading site configuration…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Site Configurations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Plan prices, Promote your business online prices, and public contact details. Developer access only, until you grant this tab to someone else.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Pricing plans</h2>
        <p className="mt-1 text-xs text-slate-500">Amounts in rupees. Starter stays free. These are the amounts merchants are charged.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Growth monthly price" type="number" disabled={!canManage} value={String(form.pricing.growthMonthly)} onChange={(value) => setPrice("growthMonthly", value)} />
          <Field label="Growth monthly MRP" type="number" disabled={!canManage} value={String(form.pricing.growthMonthlyRetail)} onChange={(value) => setPrice("growthMonthlyRetail", value)} />
          <Field label="Pro annual price" type="number" disabled={!canManage} value={String(form.pricing.proAnnual)} onChange={(value) => setPrice("proAnnual", value)} />
          <Field label="Pro annual MRP" type="number" disabled={!canManage} value={String(form.pricing.proAnnualRetail)} onChange={(value) => setPrice("proAnnualRetail", value)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Public contact</h2>
        <p className="mt-1 text-xs text-slate-500">Shown on the FinderB website and in the app support email.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Company name" disabled={!canManage} value={form.contact.companyName} onChange={(value) => setContact("companyName", value)} />
          <Field label="Brand" disabled={!canManage} value={form.contact.brand} onChange={(value) => setContact("brand", value)} />
          <Field label="Email" disabled={!canManage} value={form.contact.email} onChange={(value) => setContact("email", value)} />
          <Field label="Phone" disabled={!canManage} value={form.contact.phone} onChange={(value) => setContact("phone", value)} />
          <Field label="Phone as shown" disabled={!canManage} value={form.contact.phoneDisplay} onChange={(value) => setContact("phoneDisplay", value)} />
          <Field label="Address line 1" disabled={!canManage} value={form.contact.addressLine1} onChange={(value) => setContact("addressLine1", value)} />
          <Field label="Address line 2" disabled={!canManage} value={form.contact.addressLine2} onChange={(value) => setContact("addressLine2", value)} />
          <Field label="Country" disabled={!canManage} value={form.contact.country} onChange={(value) => setContact("country", value)} />
          <Field label="Pincode" disabled={!canManage} value={form.contact.pincode} onChange={(value) => setContact("pincode", value)} />
          <Field label="Weekday hours" disabled={!canManage} value={form.contact.hoursWeekdays} onChange={(value) => setContact("hoursWeekdays", value)} />
          <Field label="Saturday hours" disabled={!canManage} value={form.contact.hoursSaturday} onChange={(value) => setContact("hoursSaturday", value)} />
          <Field label="Sunday hours" disabled={!canManage} value={form.contact.hoursSunday} onChange={(value) => setContact("hoursSunday", value)} />
          <Field label="Grievance officer" disabled={!canManage} value={form.contact.grievanceName} onChange={(value) => setContact("grievanceName", value)} />
          <Field label="Grievance email" disabled={!canManage} value={form.contact.grievanceEmail} onChange={(value) => setContact("grievanceEmail", value)} />
          <Field label="Grievance response" disabled={!canManage} value={form.contact.grievanceResponse} onChange={(value) => setContact("grievanceResponse", value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled={!canManage} checked={form.contact.showPhone} onChange={(event) => setContact("showPhone", event.target.checked)} />
            Show phone on the website
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled={!canManage} checked={form.contact.showAddress} onChange={(event) => setContact("showAddress", event.target.checked)} />
            Show address on the website
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Promote Your Business Online</h2>
            <p className="mt-1 text-xs text-slate-500">
              Off hides the feature and its pages. On shows them. The prices below are what merchants pay. Changing a price does not change an order that is already placed.
            </p>
          </div>
          <button
            type="button"
            disabled={!canManage}
            onClick={() =>
              setForm((current) => ({
                ...current,
                features: { promoteBusinessOnline: !current.features.promoteBusinessOnline },
              }))
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              form.features.promoteBusinessOnline ? "bg-emerald-600" : "bg-slate-300"
            }`}
            aria-pressed={form.features.promoteBusinessOnline}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                form.features.promoteBusinessOnline ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800">
          {form.features.promoteBusinessOnline ? "Visible" : "Hidden"}
        </p>
        {promotionPrices.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {promotionPrices.map((item) => (
              <div key={item.id} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <Field
                  label={`${item.name} offer price`}
                  type="number"
                  disabled={!canManage}
                  value={String(item.priceInr)}
                  onChange={(value) => setPromotionPrice(item.id, "priceInr", value)}
                />
                <Field
                  label={`${item.name} MRP`}
                  type="number"
                  disabled={!canManage}
                  value={String(item.referenceInr)}
                  onChange={(value) => setPromotionPrice(item.id, "referenceInr", value)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button
        type="button"
        disabled={!canManage || saving}
        onClick={save}
        className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save configuration"}
      </button>
    </div>
  );
}
