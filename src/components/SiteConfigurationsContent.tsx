"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_CONFIG_FORM,
  type SiteConfigForm,
} from "../lib/siteConfigAdmin";
import AdminContentLoader from "./AdminContentLoader";

type Props = {
  adminId: string;
  canManage: boolean;
};

type PromotionPrice = {
  id: string;
  name: string;
  priceInr: number;
  referenceInr: number;
};

type Section = "Plans" | "Promote" | "Contact";

const SECTIONS: Section[] = ["Plans", "Promote", "Contact"];

function rupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function offPercent(price: number, retail: number) {
  if (!Number.isFinite(price) || !Number.isFinite(retail) || retail <= price || retail <= 0) return null;
  return Math.round((1 - price / retail) * 100);
}

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
    <label className="block min-w-0">
      <span className="admin-label mb-1 block">{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="admin-input disabled:opacity-60"
      />
    </label>
  );
}

function PricePair({
  offerLabel,
  offer,
  retailLabel,
  retail,
  disabled,
  onOffer,
  onRetail,
}: {
  offerLabel: string;
  offer: number;
  retailLabel: string;
  retail: number;
  disabled: boolean;
  onOffer: (value: string) => void;
  onRetail: (value: string) => void;
}) {
  const off = offPercent(offer, retail);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={offerLabel} type="number" disabled={disabled} value={String(offer)} onChange={onOffer} />
      <Field label={retailLabel} type="number" disabled={disabled} value={String(retail)} onChange={onRetail} />
      <p className="admin-card-description sm:col-span-2">
        Merchants pay {rupees(offer)}
        {off != null ? `. MRP ${rupees(retail)}, shown as ${off}% off.` : "."}
      </p>
    </div>
  );
}

export default function SiteConfigurationsContent({ adminId, canManage }: Props) {
  const [form, setForm] = useState<SiteConfigForm>(DEFAULT_SITE_CONFIG_FORM);
  const [promotionPrices, setPromotionPrices] = useState<PromotionPrice[]>([]);
  const [section, setSection] = useState<Section>("Plans");
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
      else setMessage("Saved. The website and app pick this up within a few seconds. A new Growth price applies to the next checkout. Existing mandates and promotion orders keep the price already charged.");
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

  if (loading) return <AdminContentLoader label="Loading site configuration" />;

  return (
    <div className="w-full min-w-0 max-w-5xl space-y-4">
      <div className="admin-page-header">
        <div className="min-w-0">
          <h1 className="admin-page-title">Site Configurations</h1>
          <p className="admin-page-subtitle">
            Plan prices, Promote your business online, and the public contact details. A Developer sees this tab. Other accounts see it only after it is granted.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage || saving}
          onClick={() => void save()}
          className="admin-btn-primary self-start shrink-0 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      {!canManage ? (
        <div className="admin-card px-4 py-3">
          <p className="admin-card-description">You can read this page. Saving is turned off for this account.</p>
        </div>
      ) : null}
      {error ? <div className="admin-alert-error">{error}</div> : null}
      {message ? (
        <div className="admin-card px-4 py-3">
          <p className="admin-card-title">Saved</p>
          <p className="admin-card-description">{message}</p>
        </div>
      ) : null}

      <div className="admin-segmented flex-wrap">
        {SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSection(item)}
            className={`admin-segmented-btn ${section === item ? "admin-segmented-btn-active" : "admin-segmented-btn-idle"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {section === "Plans" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="admin-card p-4 sm:p-5">
            <h2 className="admin-card-title">Growth, monthly</h2>
            <p className="admin-card-description">The amount a merchant is charged each month. Starter stays free.</p>
            <div className="mt-4">
              <PricePair
                offerLabel="Price (₹)"
                offer={form.pricing.growthMonthly}
                retailLabel="MRP (₹)"
                retail={form.pricing.growthMonthlyRetail}
                disabled={!canManage}
                onOffer={(value) => setPrice("growthMonthly", value)}
                onRetail={(value) => setPrice("growthMonthlyRetail", value)}
              />
            </div>
          </section>
          <section className="admin-card p-4 sm:p-5">
            <h2 className="admin-card-title">Pro, annual</h2>
            <p className="admin-card-description">The amount a merchant is charged for the year.</p>
            <div className="mt-4">
              <PricePair
                offerLabel="Price (₹)"
                offer={form.pricing.proAnnual}
                retailLabel="MRP (₹)"
                retail={form.pricing.proAnnualRetail}
                disabled={!canManage}
                onOffer={(value) => setPrice("proAnnual", value)}
                onRetail={(value) => setPrice("proAnnualRetail", value)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {section === "Promote" ? (
        <div className="space-y-4">
          <section className="admin-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="admin-card-title">Promote your business online</h2>
                <p className="admin-card-description max-w-xl">
                  Hidden removes the feature and its pages. Visible shows them. Package prices apply to the next checkout. An order already placed keeps the price the merchant paid.
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
                className={`${
                  form.features.promoteBusinessOnline ? "admin-btn-primary" : "admin-btn-secondary"
                } shrink-0 disabled:opacity-50`}
                aria-pressed={form.features.promoteBusinessOnline}
              >
                {form.features.promoteBusinessOnline ? "Visible" : "Hidden"}
              </button>
            </div>
          </section>
          {promotionPrices.length === 0 ? (
            <section className="admin-card p-4 sm:p-5">
              <p className="admin-card-description">No promotion packages are stored yet.</p>
            </section>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {promotionPrices.map((item) => (
                <section key={item.id} className="admin-card min-w-0 p-4 sm:p-5">
                  <h2 className="admin-card-title">{item.name}</h2>
                  <p className="admin-card-description">Offer price and MRP, in rupees.</p>
                  <div className="mt-4">
                    <PricePair
                      offerLabel="Offer price (₹)"
                      offer={item.priceInr}
                      retailLabel="MRP (₹)"
                      retail={item.referenceInr}
                      disabled={!canManage}
                      onOffer={(value) => setPromotionPrice(item.id, "priceInr", value)}
                      onRetail={(value) => setPromotionPrice(item.id, "referenceInr", value)}
                    />
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {section === "Contact" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="admin-card p-4 sm:p-5">
            <h2 className="admin-card-title">Business</h2>
            <p className="admin-card-description">Name and the address used when it is shown.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Company name" disabled={!canManage} value={form.contact.companyName} onChange={(value) => setContact("companyName", value)} />
              <Field label="Brand" disabled={!canManage} value={form.contact.brand} onChange={(value) => setContact("brand", value)} />
              <Field label="Address line 1" disabled={!canManage} value={form.contact.addressLine1} onChange={(value) => setContact("addressLine1", value)} />
              <Field label="Address line 2" disabled={!canManage} value={form.contact.addressLine2} onChange={(value) => setContact("addressLine2", value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Country" disabled={!canManage} value={form.contact.country} onChange={(value) => setContact("country", value)} />
                <Field label="Pincode" disabled={!canManage} value={form.contact.pincode} onChange={(value) => setContact("pincode", value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.contact.showAddress}
                  onChange={(event) => setContact("showAddress", event.target.checked)}
                />
                <span className="admin-label">Show address on the website</span>
              </label>
            </div>
          </section>

          <section className="admin-card p-4 sm:p-5">
            <h2 className="admin-card-title">Reach</h2>
            <p className="admin-card-description">Email, phone, and the support hours.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Email" disabled={!canManage} value={form.contact.email} onChange={(value) => setContact("email", value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone" disabled={!canManage} value={form.contact.phone} onChange={(value) => setContact("phone", value)} />
                <Field label="Phone as shown" disabled={!canManage} value={form.contact.phoneDisplay} onChange={(value) => setContact("phoneDisplay", value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.contact.showPhone}
                  onChange={(event) => setContact("showPhone", event.target.checked)}
                />
                <span className="admin-label">Show phone on the website</span>
              </label>
              <Field label="Weekday hours" disabled={!canManage} value={form.contact.hoursWeekdays} onChange={(value) => setContact("hoursWeekdays", value)} />
              <Field label="Saturday hours" disabled={!canManage} value={form.contact.hoursSaturday} onChange={(value) => setContact("hoursSaturday", value)} />
              <Field label="Sunday hours" disabled={!canManage} value={form.contact.hoursSunday} onChange={(value) => setContact("hoursSunday", value)} />
            </div>
          </section>

          <section className="admin-card p-4 sm:p-5 lg:col-span-2">
            <h2 className="admin-card-title">Grievance</h2>
            <p className="admin-card-description">Shown with the public contact details.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Officer" disabled={!canManage} value={form.contact.grievanceName} onChange={(value) => setContact("grievanceName", value)} />
              <Field label="Email" disabled={!canManage} value={form.contact.grievanceEmail} onChange={(value) => setContact("grievanceEmail", value)} />
              <Field label="Response time" disabled={!canManage} value={form.contact.grievanceResponse} onChange={(value) => setContact("grievanceResponse", value)} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
