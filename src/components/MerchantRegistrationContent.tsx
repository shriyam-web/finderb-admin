"use client";

import { useMemo, useState, type ReactNode } from "react";
import { City, Country, State } from "country-state-city";
import { indianMobileValidationError } from "../lib/indianPhone";
import { validateRegistrationPassword } from "../lib/merchantPasswordPolicy";
import {
  REGISTRATION_EMAIL_REGEX,
  MIN_NAME_LENGTH,
  MIN_ADDRESS_LINE1_LENGTH,
} from "../lib/merchantRegistration";
import { getBusinessLoginUrl, getBusinessProfileUrl } from "../lib/site";

export type RegistrationCategory = {
  id: string;
  name: string;
  parent_id?: string | null;
};

type AdminSession = {
  id: string;
  email: string;
  role: string;
};

type FormState = {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  businessName: string;
  displayName: string;
  categoryId: string;
  subcategoryId: string;
  addressLine1: string;
  addressLine2: string;
  countryCode: string;
  country: string;
  stateCode: string;
  state: string;
  city: string;
  publicPhone: string;
  activateImmediately: boolean;
};

type FieldErrors = Partial<Record<keyof FormState | "_form", string>>;

export const DEFAULT_MERCHANT_PASSWORD = "Finderb@1234";

const INITIAL_FORM: FormState = {
  fullName: "",
  email: "",
  password: DEFAULT_MERCHANT_PASSWORD,
  mobile: "",
  businessName: "",
  displayName: "",
  categoryId: "",
  subcategoryId: "",
  addressLine1: "",
  addressLine2: "",
  countryCode: "IN",
  country: "India",
  stateCode: "",
  state: "",
  city: "",
  publicPhone: "",
  activateImmediately: false,
};

type CreatedMerchant = {
  id: string;
  registrationNumber: string;
  businessName: string;
  fullName?: string;
  email?: string;
  mobile?: string;
  slug?: string | null;
  city?: string | null;
  status?: string;
  kycStatus?: string;
};

type Props = {
  categories: RegistrationCategory[];
  adminSession: AdminSession | null;
  onRegistered?: () => void;
};

function buildMerchantShareMessage(input: {
  ownerName: string;
  businessName: string;
  email: string;
  password: string;
  mobile: string;
  registrationNumber: string;
  loginUrl: string;
}): string {
  const name = input.ownerName.trim() || "there";
  return `Hi ${name},

Welcome to FinderB! Your merchant account for ${input.businessName} is ready.

Login details
• Merchant ID: ${input.registrationNumber}
• Email: ${input.email}
• Password: ${input.password}
• Mobile: ${input.mobile}

Login here: ${input.loginUrl}

Quick start guide
1. Open the login link above and sign in with your email & password.
2. Complete your business profile (photos, about, timings, WhatsApp).
3. Review your public listing and make sure contact details look right.
4. When you're ready to grow, upgrade from Free/Starter after payment — your plan unlocks based on successful payment.
5. Need help? Reply to this message and our team will assist you.

We're excited to have ${input.businessName} on FinderB.
— Team FinderB`;
}

function Field({
  id,
  label,
  error,
  children,
  hint,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div id={`field-${id}`} className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="admin-label">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}

export default function MerchantRegistrationContent({
  categories,
  adminSession,
  onRegistered,
}: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [created, setCreated] = useState<CreatedMerchant | null>(null);

  const usingDefaultPassword = form.password === DEFAULT_MERCHANT_PASSWORD;
  const loginUrl = getBusinessLoginUrl();

  const shareMessage = useMemo(() => {
    if (!created || !createdPassword) return "";
    return buildMerchantShareMessage({
      ownerName: created.fullName || form.fullName,
      businessName: created.businessName,
      email: created.email || form.email,
      password: createdPassword,
      mobile: created.mobile || form.mobile,
      registrationNumber: created.registrationNumber,
      loginUrl,
    });
  }, [
    created,
    createdPassword,
    form.fullName,
    form.email,
    form.mobile,
    loginUrl,
  ]);

  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const subcategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === form.categoryId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, form.categoryId],
  );

  const countryOptions = useMemo(
    () =>
      Country.getAllCountries().map((c) => ({
        label: c.name,
        value: c.isoCode,
      })),
    [],
  );

  const stateOptions = useMemo(
    () =>
      form.countryCode
        ? State.getStatesOfCountry(form.countryCode).map((s) => ({
            label: s.name,
            value: s.isoCode,
          }))
        : [],
    [form.countryCode],
  );

  const cityOptions = useMemo(
    () =>
      form.countryCode && form.stateCode
        ? City.getCitiesOfState(form.countryCode, form.stateCode).map((c) => ({
            label: c.name,
            value: c.name,
          }))
        : [],
    [form.countryCode, form.stateCode],
  );

  const patch = (updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(updates) as (keyof FormState)[]) {
        delete next[key];
      }
      delete next._form;
      return next;
    });
  };

  const resolveCategoryLabel = () => {
    const parent = topCategories.find((c) => c.id === form.categoryId);
    if (!parent) return "";
    const child = subcategories.find((c) => c.id === form.subcategoryId);
    return child ? `${parent.name} › ${child.name}` : parent.name;
  };

  const copyText = async (value: string, kind: "password" | "message") => {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "password") {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 1600);
      } else {
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const validateStep1 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (
      !form.fullName.trim() ||
      form.fullName.trim().length < MIN_NAME_LENGTH
    ) {
      next.fullName = "Owner full name must be at least 2 characters.";
    }
    if (
      !form.email.trim() ||
      !REGISTRATION_EMAIL_REGEX.test(form.email.trim())
    ) {
      next.email = "Please enter a valid email address.";
    }
    const passwordError = validateRegistrationPassword(form.password);
    if (passwordError) next.password = passwordError;
    const mobileError = indianMobileValidationError(form.mobile, {
      label: "mobile number",
    });
    if (mobileError) next.mobile = mobileError;
    return next;
  };

  const validateStep2 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (
      !form.businessName.trim() ||
      form.businessName.trim().length < MIN_NAME_LENGTH
    ) {
      next.businessName = "Legal business name must be at least 2 characters.";
    }
    if (
      form.displayName.trim() &&
      form.displayName.trim().length < MIN_NAME_LENGTH
    ) {
      next.displayName = "Display name must be at least 2 characters.";
    }
    if (!form.categoryId)
      next.categoryId = "Please select a business category.";
    if (subcategories.length > 0 && !form.subcategoryId) {
      next.subcategoryId = "Please select a subcategory.";
    }
    if (
      !form.addressLine1.trim() ||
      form.addressLine1.trim().length < MIN_ADDRESS_LINE1_LENGTH
    ) {
      next.addressLine1 = `Address line 1 must be at least ${MIN_ADDRESS_LINE1_LENGTH} characters.`;
    }
    if (!form.country.trim()) next.country = "Please select your country.";
    if (!form.state.trim()) next.state = "Please select your state.";
    if (!form.city.trim()) next.city = "Please select your city.";
    const phoneError = indianMobileValidationError(form.publicPhone, {
      label: "display phone number",
    });
    if (phoneError) next.publicPhone = phoneError;
    return next;
  };

  const scrollToFirstError = (fieldErrors: FieldErrors) => {
    const order: (keyof FormState)[] = [
      "fullName",
      "email",
      "password",
      "mobile",
      "businessName",
      "displayName",
      "categoryId",
      "subcategoryId",
      "addressLine1",
      "country",
      "state",
      "city",
      "publicPhone",
    ];
    const first = order.find((key) => fieldErrors[key]);
    if (!first) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`field-${first}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const goNext = () => {
    if (step === 1) {
      const fieldErrors = validateStep1();
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        scrollToFirstError(fieldErrors);
        return;
      }
      if (!form.publicPhone) patch({ publicPhone: form.mobile });
      setStep(2);
      return;
    }
    void submit();
  };

  const submit = async () => {
    if (!adminSession?.id) {
      setErrors({ _form: "Admin session missing. Please log in again." });
      return;
    }

    const fieldErrors = validateStep2();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      scrollToFirstError(fieldErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/merchants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: adminSession.id,
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          mobile: form.mobile,
          businessName: form.businessName,
          displayName: form.displayName,
          category: resolveCategoryLabel(),
          city: form.city,
          state: form.state,
          country: form.country,
          publicPhone: form.publicPhone,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          selectedPlan: "free",
          billingCycle: "monthly",
          activateImmediately: form.activateImmediately,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setErrors({ _form: payload.error || "Registration failed." });
        return;
      }

      setCreatedPassword(form.password);
      setCreated(payload.business);
      setGuideOpen(true);
      setStep(3);
      onRegistered?.();
    } catch (error: unknown) {
      setErrors({
        _form:
          error instanceof Error
            ? error.message
            : "Registration failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setCreated(null);
    setCreatedPassword(null);
    setShowPassword(true);
    setCopiedMessage(false);
    setGuideOpen(true);
    setStep(1);
  };

  const whatsappShareUrl = useMemo(() => {
    if (!shareMessage || !created?.mobile) return null;
    const digits = created.mobile.replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${phone}?text=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, created?.mobile]);

  const stepCopy =
    step === 1
      ? {
          title: "Owner & login",
          sub: "Account credentials for the business owner.",
        }
      : step === 2
        ? {
            title: "Business details",
            sub: "Listing info and location. Plan stays Free until they pay.",
          }
        : {
            title: "Share credentials",
            sub: "Copy the welcome message and send it to the merchant.",
          };

  return (
    <div className="space-y-4">
      <div className="admin-platform-hero">
        <div className="admin-page-header !mb-0">
          <div>
            <h1 className="admin-page-title">Business onboarding</h1>
            <p className="admin-page-subtitle">
              Create a Free/Starter merchant account from the admin console.
              Paid plans unlock after payment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { n: 1, label: "Account" },
              { n: 2, label: "Business" },
              { n: 3, label: "Share" },
            ].map((item) => {
              const active = step === item.n;
              const done = step > item.n;
              return (
                <span
                  key={item.n}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                    done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : active
                        ? "border-primary/25 bg-primary-50 text-primary"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  <span className="tabular-nums font-semibold">
                    {done ? "✓" : item.n}
                  </span>
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {errors._form && (
        <div className="admin-alert-error">
          <p className="font-medium text-rose-900">Could not create account</p>
          <p className="mt-0.5 text-rose-700">{errors._form}</p>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">{stepCopy.title}</h2>
            <p className="admin-card-description">{stepCopy.sub}</p>
          </div>
          {step < 3 && (
            <span className="admin-badge bg-slate-50 text-slate-600 border-slate-200">
              Step {step} / 2
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  id="fullName"
                  label="Owner full name *"
                  error={errors.fullName}
                >
                  <input
                    id="fullName"
                    className="admin-input"
                    value={form.fullName}
                    onChange={(e) => patch({ fullName: e.target.value })}
                    placeholder="Priya Sharma"
                    autoFocus
                  />
                </Field>
                <Field id="email" label="Login email *" error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    className="admin-input"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="partner@studio.in"
                  />
                </Field>
                <Field
                  id="mobile"
                  label="Mobile *"
                  error={errors.mobile}
                  hint="10-digit Indian number"
                  className="md:col-span-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                      +91
                    </span>
                    <input
                      id="mobile"
                      className="admin-input"
                      value={form.mobile}
                      onChange={(e) =>
                        patch({
                          mobile: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        })
                      }
                      placeholder="98XXXXXXXX"
                      inputMode="numeric"
                    />
                  </div>
                </Field>
              </div>

              <div
                id="field-password"
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {usingDefaultPassword
                        ? "Default password"
                        : "Custom password"}
                    </p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      Auto-filled for admin creates. Change only if needed.
                    </p>
                  </div>
                  <span
                    className={`admin-badge ${
                      usingDefaultPassword
                        ? "bg-primary-50 text-primary border-primary/20"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {usingDefaultPassword ? "Default" : "Custom"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className="admin-input admin-mono pr-14"
                      value={form.password}
                      onChange={(e) => patch({ password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-primary"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(form.password, "password")}
                    className="admin-btn-secondary"
                  >
                    {copiedPassword ? "Copied" : "Copy"}
                  </button>
                  {!usingDefaultPassword && (
                    <button
                      type="button"
                      onClick={() =>
                        patch({ password: DEFAULT_MERCHANT_PASSWORD })
                      }
                      className="admin-btn-secondary"
                    >
                      Reset default
                    </button>
                  )}
                </div>
                {errors.password && (
                  <p className="text-[11px] font-medium text-rose-600">
                    {errors.password}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  id="businessName"
                  label="Legal business name *"
                  error={errors.businessName}
                >
                  <input
                    id="businessName"
                    className="admin-input"
                    value={form.businessName}
                    onChange={(e) => patch({ businessName: e.target.value })}
                    placeholder="Acme Retail Pvt Ltd"
                    autoFocus
                  />
                </Field>
                <Field
                  id="displayName"
                  label="Display name"
                  error={errors.displayName}
                  hint="Optional"
                >
                  <input
                    id="displayName"
                    className="admin-input"
                    value={form.displayName}
                    onChange={(e) => patch({ displayName: e.target.value })}
                    placeholder="Acme Store"
                  />
                </Field>
                <Field
                  id="categoryId"
                  label="Category *"
                  error={errors.categoryId}
                >
                  <select
                    id="categoryId"
                    className="admin-input"
                    value={form.categoryId}
                    onChange={(e) =>
                      patch({ categoryId: e.target.value, subcategoryId: "" })
                    }
                  >
                    <option value="">Select category</option>
                    {topCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {subcategories.length > 0 && (
                  <Field
                    id="subcategoryId"
                    label="Subcategory *"
                    error={errors.subcategoryId}
                  >
                    <select
                      id="subcategoryId"
                      className="admin-input"
                      value={form.subcategoryId}
                      onChange={(e) => patch({ subcategoryId: e.target.value })}
                    >
                      <option value="">Select subcategory</option>
                      {subcategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  id="addressLine1"
                  label="Address line 1 *"
                  error={errors.addressLine1}
                  className="md:col-span-2"
                >
                  <input
                    id="addressLine1"
                    className="admin-input"
                    value={form.addressLine1}
                    onChange={(e) => patch({ addressLine1: e.target.value })}
                    placeholder="Street, building, area"
                  />
                </Field>
                <Field
                  id="addressLine2"
                  label="Address line 2"
                  className="md:col-span-2"
                >
                  <input
                    id="addressLine2"
                    className="admin-input"
                    value={form.addressLine2}
                    onChange={(e) => patch({ addressLine2: e.target.value })}
                    placeholder="Landmark (optional)"
                  />
                </Field>
                <Field id="country" label="Country *" error={errors.country}>
                  <select
                    id="country"
                    className="admin-input"
                    value={form.countryCode}
                    onChange={(e) => {
                      const selected = Country.getCountryByCode(e.target.value);
                      patch({
                        countryCode: e.target.value,
                        country: selected?.name || "",
                        stateCode: "",
                        state: "",
                        city: "",
                      });
                    }}
                  >
                    {countryOptions.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="state" label="State *" error={errors.state}>
                  <select
                    id="state"
                    className="admin-input"
                    value={form.stateCode}
                    onChange={(e) => {
                      const selected = State.getStateByCodeAndCountry(
                        e.target.value,
                        form.countryCode,
                      );
                      patch({
                        stateCode: e.target.value,
                        state: selected?.name || "",
                        city: "",
                      });
                    }}
                  >
                    <option value="">Select state</option>
                    {stateOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="city" label="City *" error={errors.city}>
                  {cityOptions.length > 0 ? (
                    <select
                      id="city"
                      className="admin-input"
                      value={form.city}
                      onChange={(e) => patch({ city: e.target.value })}
                    >
                      <option value="">Select city</option>
                      {cityOptions.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="city"
                      className="admin-input"
                      value={form.city}
                      onChange={(e) => patch({ city: e.target.value })}
                      placeholder="Enter city"
                    />
                  )}
                </Field>
                <Field
                  id="publicPhone"
                  label="Public phone *"
                  error={errors.publicPhone}
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                      +91
                    </span>
                    <input
                      id="publicPhone"
                      className="admin-input"
                      value={form.publicPhone}
                      onChange={(e) =>
                        patch({
                          publicPhone: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        })
                      }
                      placeholder="98XXXXXXXX"
                      inputMode="numeric"
                    />
                  </div>
                </Field>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  Plan: Free / Starter
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Paid plans apply automatically after successful payment.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-emerald-700"
                  checked={form.activateImmediately}
                  onChange={(e) =>
                    patch({ activateImmediately: e.target.checked })
                  }
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Activate listing immediately
                  </span>
                  <span className="block text-[12px] text-slate-600 mt-0.5">
                    Sets listing status to Active so the profile can show
                    publicly. Leave unchecked to keep them in the pending
                    approval queue. Does not affect KYC.
                  </span>
                </span>
              </label>
            </>
          )}

          {step === 3 && created && createdPassword && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="admin-status-pill admin-status-live">
                  Account created
                </span>
                <span className="admin-badge bg-slate-50 text-slate-600 border-slate-200">
                  Free / Starter
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                  {created.businessName}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Send the welcome note below — credentials, login link, and
                  next steps.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    label: "Merchant ID",
                    value: created.registrationNumber,
                    mono: true,
                    testId: true,
                  },
                  { label: "Status", value: `${created.status}` },
                  { label: "Email", value: created.email },
                  { label: "Password", value: createdPassword, mono: true },
                ].map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() =>
                      copyText(
                        String(row.value || ""),
                        row.label === "Password" ? "password" : "message",
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left hover:border-primary/30 hover:bg-primary-50/30 transition-colors group"
                    title="Click to copy"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center justify-between gap-2">
                      {row.label}
                      <span className="opacity-0 group-hover:opacity-100 text-primary normal-case tracking-normal font-medium">
                        Copy
                      </span>
                    </p>
                    <p
                      data-testid={
                        row.testId ? "created-merchant-id" : undefined
                      }
                      className={`mt-1 text-sm font-medium text-slate-900 break-all ${row.mono ? "admin-mono !text-slate-800" : ""}`}
                    >
                      {row.value}
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Welcome message
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Credentials · {loginUrl.replace(/^https?:\/\//, "")} ·
                      guide
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(shareMessage, "message")}
                      className="admin-btn-primary !text-xs !py-1.5"
                    >
                      {copiedMessage ? "Copied" : "Copy message"}
                    </button>
                    {whatsappShareUrl && (
                      <a
                        href={whatsappShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-btn-secondary !text-xs !py-1.5"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3 max-h-[260px] overflow-y-auto custom-scrollbar">
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 font-sans">
                    {shareMessage}
                  </pre>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGuideOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                >
                  <span className="text-sm font-semibold text-slate-900">
                    What the merchant should do next
                  </span>
                  <span className="text-[11px] font-semibold text-primary">
                    {guideOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {guideOpen && (
                  <ol className="border-t border-slate-100 px-4 py-3 space-y-2.5">
                    {[
                      {
                        t: "Sign in",
                        d: `Go to ${loginUrl.replace(/^https?:\/\//, "")} with the email & password.`,
                      },
                      {
                        t: "Finish profile",
                        d: "Add photos, about, timings, and WhatsApp.",
                      },
                      {
                        t: "Check listing",
                        d: "Open the public profile and confirm contact details.",
                      },
                      {
                        t: "Upgrade later",
                        d: "Paid plans activate only after a successful payment.",
                      },
                    ].map((item, i) => (
                      <li key={item.t} className="flex gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-50 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900">
                            {item.t}
                          </p>
                          <p className="text-[12px] text-slate-500 mt-0.5">
                            {item.d}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn-secondary"
                >
                  Open login page
                </a>
                <a
                  href={getBusinessProfileUrl({
                    id: created.id,
                    businessName: created.businessName,
                    slug: created.slug,
                    city: created.city,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn-secondary"
                >
                  View public profile
                </a>
                <button
                  type="button"
                  onClick={resetForm}
                  className="admin-btn-primary"
                >
                  Onboard another
                </button>
              </div>
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="px-4 sm:px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={loading || step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="text-sm font-medium text-slate-500 disabled:opacity-30 hover:text-slate-800 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={goNext}
              className="admin-btn-primary"
            >
              {loading
                ? "Creating…"
                : step === 1
                  ? "Continue"
                  : "Create merchant"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
