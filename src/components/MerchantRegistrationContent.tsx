"use client";

import { useMemo, useState, type ReactNode } from "react";
import { City, Country, State } from "country-state-city";
import { DM_Sans, Syne } from "next/font/google";
import { indianMobileValidationError } from "../lib/indianPhone";
import { validateRegistrationPassword } from "../lib/merchantPasswordPolicy";
import { REGISTRATION_EMAIL_REGEX, MIN_NAME_LENGTH, MIN_ADDRESS_LINE1_LENGTH } from "../lib/merchantRegistration";
import { getBusinessProfileUrl } from "../lib/site";

const displayFont = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-reg-display",
  display: "swap",
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-reg-body",
  display: "swap",
});

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
  selectedPlan: string;
  billingCycle: string;
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
  selectedPlan: "free",
  billingCycle: "monthly",
  activateImmediately: true,
};

const PLAN_OPTIONS = [
  { value: "free", label: "Starter", hint: "Free listing" },
  { value: "growth", label: "Growth", hint: "Paid monthly" },
  { value: "pro", label: "Pro", hint: "Premium tier" },
] as const;

type Props = {
  categories: RegistrationCategory[];
  adminSession: AdminSession | null;
  onRegistered?: () => void;
};

const inputClass =
  "w-full bg-transparent border-0 border-b-2 border-[#cfd6e0] rounded-none px-0 py-3 text-[15px] text-[#0c1222] placeholder:text-[#9aa3b2] focus:outline-none focus:border-[#1a5276] transition-[border-color] duration-200";

const selectClass =
  "w-full bg-transparent border-0 border-b-2 border-[#cfd6e0] rounded-none px-0 py-3 text-[15px] text-[#0c1222] focus:outline-none focus:border-[#1a5276] transition-[border-color] duration-200 appearance-none cursor-pointer";

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
    <div id={`field-${id}`} className={`group space-y-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7385] group-focus-within:text-[#1a5276] transition-colors"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[12px] text-[#8b93a3] leading-snug">{hint}</p>}
      {error && <p className="text-[12px] font-medium text-[#b91c1c]">{error}</p>}
    </div>
  );
}

export default function MerchantRegistrationContent({ categories, adminSession, onRegistered }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [created, setCreated] = useState<{
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
  } | null>(null);

  const usingDefaultPassword = form.password === DEFAULT_MERCHANT_PASSWORD;

  const topCategories = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name)),
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
    () => Country.getAllCountries().map((c) => ({ label: c.name, value: c.isoCode })),
    [],
  );

  const stateOptions = useMemo(
    () =>
      form.countryCode
        ? State.getStatesOfCountry(form.countryCode).map((s) => ({ label: s.name, value: s.isoCode }))
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

  const copyPassword = async (value = form.password) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 1600);
    } catch {
      // ignore
    }
  };

  const validateStep1 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.fullName.trim() || form.fullName.trim().length < MIN_NAME_LENGTH) {
      next.fullName = "Owner full name must be at least 2 characters.";
    }
    if (!form.email.trim() || !REGISTRATION_EMAIL_REGEX.test(form.email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    const passwordError = validateRegistrationPassword(form.password);
    if (passwordError) next.password = passwordError;
    const mobileError = indianMobileValidationError(form.mobile, { label: "mobile number" });
    if (mobileError) next.mobile = mobileError;
    return next;
  };

  const validateStep2 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.businessName.trim() || form.businessName.trim().length < MIN_NAME_LENGTH) {
      next.businessName = "Legal business name must be at least 2 characters.";
    }
    if (form.displayName.trim() && form.displayName.trim().length < MIN_NAME_LENGTH) {
      next.displayName = "Display name must be at least 2 characters.";
    }
    if (!form.categoryId) next.categoryId = "Please select a business category.";
    if (subcategories.length > 0 && !form.subcategoryId) {
      next.subcategoryId = "Please select a subcategory.";
    }
    if (!form.addressLine1.trim() || form.addressLine1.trim().length < MIN_ADDRESS_LINE1_LENGTH) {
      next.addressLine1 = `Address line 1 must be at least ${MIN_ADDRESS_LINE1_LENGTH} characters.`;
    }
    if (!form.country.trim()) next.country = "Please select your country.";
    if (!form.state.trim()) next.state = "Please select your state.";
    if (!form.city.trim()) next.city = "Please select your city.";
    const phoneError = indianMobileValidationError(form.publicPhone, { label: "display phone number" });
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
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          selectedPlan: form.selectedPlan,
          billingCycle: form.billingCycle,
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
      setStep(3);
      onRegistered?.();
    } catch (error: unknown) {
      setErrors({
        _form: error instanceof Error ? error.message : "Registration failed. Please try again.",
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
    setStep(1);
  };

  const stepCopy =
    step === 1
      ? { title: "Who’s signing in?", sub: "Owner identity and login credentials." }
      : step === 2
        ? { title: "Where do they operate?", sub: "Listing details, location, and plan." }
        : { title: "Partner is live", sub: "Share the credentials and you’re done." };

  return (
    <div
      className={`${displayFont.variable} ${bodyFont.variable} relative isolate overflow-hidden rounded-[28px] border border-[#d5dbe6]`}
      style={{ fontFamily: "var(--font-reg-body), system-ui, sans-serif" }}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(26,82,118,0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(166,124,42,0.10), transparent 50%), linear-gradient(165deg, #f7f8fb 0%, #eef2f7 45%, #f4f1ea 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(12,18,34,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(12,18,34,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr] min-h-[640px]">
        {/* Editorial rail */}
        <aside className="relative border-b lg:border-b-0 lg:border-r border-[#d5dbe6] px-7 py-8 sm:px-9 sm:py-10 flex flex-col justify-between gap-10 bg-[#0b1520] text-white overflow-hidden">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, rgba(83,146,191,0.55), transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -left-10 bottom-10 h-40 w-40 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, rgba(166,124,42,0.5), transparent 70%)" }}
          />

          <div className="relative space-y-8">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#8fa4b8]">
              FinderB · Backend create
            </p>
            <div>
              <h1
                className="text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.05] tracking-tight text-white"
                style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
              >
                Register a
                <br />
                <span className="text-[#7eadcf]">merchant</span>
                <br />
                in minutes.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-[#9eb0c2] max-w-sm">
                Same fields as public signup — built for admins. Default login password is ready to share.
              </p>
            </div>

            <ol className="space-y-3">
              {[
                { n: 1, label: "Account", desc: "Owner + login" },
                { n: 2, label: "Business", desc: "Listing + plan" },
                { n: 3, label: "Done", desc: "Credentials ready" },
              ].map((item) => {
                const active = step === item.n;
                const done = step > item.n;
                return (
                  <li
                    key={item.n}
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-colors duration-300 ${
                      active
                        ? "border-[#5392bf]/40 bg-white/8"
                        : done
                          ? "border-emerald-400/25 bg-emerald-400/5"
                          : "border-white/10 bg-transparent"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                        done
                          ? "bg-emerald-400/20 text-emerald-300"
                          : active
                            ? "bg-[#1a5276] text-white"
                            : "bg-white/5 text-[#7a8fa3]"
                      }`}
                      style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
                    >
                      {done ? "✓" : item.n}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${active || done ? "text-white" : "text-[#7a8fa3]"}`}>
                        {item.label}
                      </p>
                      <p className="text-[12px] text-[#7a8fa3]">{item.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fa4b8]">Default password</p>
            <p
              className="mt-1.5 font-mono text-lg tracking-wide text-[#f0f3f8]"
              style={{ fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
            >
              {DEFAULT_MERCHANT_PASSWORD}
            </p>
          </div>
        </aside>

        {/* Form pane */}
        <div className="px-6 py-8 sm:px-9 sm:py-10 flex flex-col">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a3]">
                {step < 3 ? `Step ${step} / 2` : "Complete"}
              </p>
              <h2
                className="mt-2 text-[1.75rem] leading-tight tracking-tight text-[#0c1222]"
                style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
              >
                {stepCopy.title}
              </h2>
              <p className="mt-1.5 text-[14px] text-[#6b7385]">{stepCopy.sub}</p>
            </div>
            {step < 3 && (
              <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d5dbe6] bg-white/70">
                <span
                  className="text-2xl font-extrabold text-[#1a5276]"
                  style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
                >
                  0{step}
                </span>
              </div>
            )}
          </div>

          {errors._form && (
            <div className="mb-6 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
              {errors._form}
            </div>
          )}

          <div className="flex-1 space-y-8">
            {step === 1 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
                  <Field id="fullName" label="Owner full name *" error={errors.fullName}>
                    <input
                      id="fullName"
                      className={inputClass}
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
                      className={inputClass}
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
                    <div className="flex items-end gap-3 border-b-2 border-[#cfd6e0] focus-within:border-[#1a5276] transition-colors">
                      <span className="pb-3 text-[15px] font-medium text-[#6b7385]">+91</span>
                      <input
                        id="mobile"
                        className="w-full bg-transparent border-0 rounded-none px-0 py-3 text-[15px] focus:outline-none"
                        value={form.mobile}
                        onChange={(e) => patch({ mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                        placeholder="98XXXXXXXX"
                        inputMode="numeric"
                      />
                    </div>
                  </Field>
                </div>

                <div
                  id="field-password"
                  className={`rounded-[22px] border px-5 py-5 transition-colors ${
                    usingDefaultPassword
                      ? "border-[#a9c9df] bg-[linear-gradient(135deg,#eef4f8_0%,#ffffff_70%)]"
                      : "border-[#f2e8d0] bg-[linear-gradient(135deg,#faf6ee_0%,#ffffff_70%)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <p
                        className="text-lg tracking-tight text-[#0c1222]"
                        style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
                      >
                        {usingDefaultPassword ? "Default password locked in" : "Custom password"}
                      </p>
                      <p className="text-[13px] text-[#6b7385] mt-1">
                        Auto-filled for admin creates. Change it only if the merchant needs something else.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                        usingDefaultPassword ? "bg-[#1a5276] text-white" : "bg-[#a67c2a] text-white"
                      }`}
                    >
                      {usingDefaultPassword ? "Default" : "Custom"}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="relative flex-1">
                      <label htmlFor="password" className="sr-only">
                        Password
                      </label>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className={`${inputClass} font-mono tracking-wide pr-16`}
                        style={{ fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
                        value={form.password}
                        onChange={(e) => patch({ password: e.target.value })}
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#1a5276]"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyPassword()}
                        className="rounded-full border border-[#1a5276] px-4 py-2.5 text-[12px] font-semibold text-[#1a5276] hover:bg-[#1a5276] hover:text-white transition-colors"
                      >
                        {copiedPassword ? "Copied" : "Copy"}
                      </button>
                      {!usingDefaultPassword && (
                        <button
                          type="button"
                          onClick={() => patch({ password: DEFAULT_MERCHANT_PASSWORD })}
                          className="rounded-full border border-[#d5dbe6] px-4 py-2.5 text-[12px] font-semibold text-[#6b7385] hover:border-[#1a5276] hover:text-[#1a5276] transition-colors"
                        >
                          Reset default
                        </button>
                      )}
                    </div>
                  </div>
                  {errors.password && <p className="text-[12px] font-medium text-[#b91c1c] mt-2">{errors.password}</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
                  <Field id="businessName" label="Legal business name *" error={errors.businessName}>
                    <input
                      id="businessName"
                      className={inputClass}
                      value={form.businessName}
                      onChange={(e) => patch({ businessName: e.target.value })}
                      placeholder="Acme Retail Pvt Ltd"
                      autoFocus
                    />
                  </Field>
                  <Field id="displayName" label="Display name" error={errors.displayName} hint="Optional">
                    <input
                      id="displayName"
                      className={inputClass}
                      value={form.displayName}
                      onChange={(e) => patch({ displayName: e.target.value })}
                      placeholder="Acme Store"
                    />
                  </Field>
                  <Field id="categoryId" label="Category *" error={errors.categoryId}>
                    <select
                      id="categoryId"
                      className={selectClass}
                      value={form.categoryId}
                      onChange={(e) => patch({ categoryId: e.target.value, subcategoryId: "" })}
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
                    <Field id="subcategoryId" label="Subcategory *" error={errors.subcategoryId}>
                      <select
                        id="subcategoryId"
                        className={selectClass}
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

                <div className="h-px bg-[#dfe3eb]" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
                  <Field id="addressLine1" label="Address line 1 *" error={errors.addressLine1} className="md:col-span-2">
                    <input
                      id="addressLine1"
                      className={inputClass}
                      value={form.addressLine1}
                      onChange={(e) => patch({ addressLine1: e.target.value })}
                      placeholder="Street, building, area"
                    />
                  </Field>
                  <Field id="addressLine2" label="Address line 2" className="md:col-span-2">
                    <input
                      id="addressLine2"
                      className={inputClass}
                      value={form.addressLine2}
                      onChange={(e) => patch({ addressLine2: e.target.value })}
                      placeholder="Landmark (optional)"
                    />
                  </Field>
                  <Field id="country" label="Country *" error={errors.country}>
                    <select
                      id="country"
                      className={selectClass}
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
                      className={selectClass}
                      value={form.stateCode}
                      onChange={(e) => {
                        const selected = State.getStateByCodeAndCountry(e.target.value, form.countryCode);
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
                        className={selectClass}
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
                        className={inputClass}
                        value={form.city}
                        onChange={(e) => patch({ city: e.target.value })}
                        placeholder="Enter city"
                      />
                    )}
                  </Field>
                  <Field id="publicPhone" label="Public phone *" error={errors.publicPhone}>
                    <div className="flex items-end gap-3 border-b-2 border-[#cfd6e0] focus-within:border-[#1a5276] transition-colors">
                      <span className="pb-3 text-[15px] font-medium text-[#6b7385]">+91</span>
                      <input
                        id="publicPhone"
                        className="w-full bg-transparent border-0 rounded-none px-0 py-3 text-[15px] focus:outline-none"
                        value={form.publicPhone}
                        onChange={(e) => patch({ publicPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                        placeholder="98XXXXXXXX"
                        inputMode="numeric"
                      />
                    </div>
                  </Field>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7385] mb-3">Plan</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PLAN_OPTIONS.map((plan) => {
                      const active = form.selectedPlan === plan.value;
                      return (
                        <button
                          key={plan.value}
                          type="button"
                          onClick={() =>
                            patch({
                              selectedPlan: plan.value,
                              billingCycle: plan.value === "free" ? "monthly" : form.billingCycle,
                            })
                          }
                          className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                            active
                              ? "border-[#1a5276] bg-[#1a5276] text-white"
                              : "border-[#d5dbe6] bg-white/60 text-[#0c1222] hover:border-[#1a5276]/50"
                          }`}
                        >
                          <p
                            className="text-[17px] tracking-tight"
                            style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
                          >
                            {plan.label}
                          </p>
                          <p className={`text-[12px] mt-1 ${active ? "text-white/75" : "text-[#8b93a3]"}`}>
                            {plan.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {form.selectedPlan !== "free" && (
                    <div className="mt-4 flex gap-2">
                      {(["monthly", "annual"] as const).map((cycle) => (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => patch({ billingCycle: cycle })}
                          className={`rounded-full px-4 py-2 text-[12px] font-semibold capitalize transition-colors ${
                            form.billingCycle === cycle
                              ? "bg-[#0c1222] text-white"
                              : "border border-[#d5dbe6] text-[#6b7385]"
                          }`}
                        >
                          {cycle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-4 cursor-pointer rounded-2xl border border-[#b7d4c4] bg-[#f0faf5] px-5 py-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#047857]"
                    checked={form.activateImmediately}
                    onChange={(e) => patch({ activateImmediately: e.target.checked })}
                  />
                  <span>
                    <span
                      className="block text-[15px] text-[#0c1222]"
                      style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
                    >
                      Activate listing immediately
                    </span>
                    <span className="block text-[13px] text-[#4d6b5c] mt-1 leading-snug">
                      Active status + approved KYC. Uncheck to leave them in the pending queue.
                    </span>
                  </span>
                </label>
              </>
            )}

            {step === 3 && created && (
              <div className="space-y-7 py-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Created
                </div>
                <div>
                  <h3
                    className="text-[2rem] leading-tight tracking-tight text-[#0c1222]"
                    style={{ fontFamily: "var(--font-reg-display), system-ui, sans-serif" }}
                  >
                    {created.businessName}
                  </h3>
                  <p className="mt-2 text-[14px] text-[#6b7385]">
                    Account is ready. Share these credentials with the partner.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Merchant ID", value: created.registrationNumber, mono: true, testId: true },
                    { label: "Status", value: `${created.status} · KYC ${created.kycStatus}` },
                    { label: "Email", value: created.email },
                    { label: "Mobile", value: created.mobile },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-[#d5dbe6] bg-white/70 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a3]">{row.label}</p>
                      <p
                        data-testid={row.testId ? "created-merchant-id" : undefined}
                        className={`mt-1.5 text-[14px] font-semibold text-[#0c1222] break-all ${row.mono ? "font-mono" : ""}`}
                      >
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>

                {createdPassword && (
                  <div className="rounded-2xl border border-[#1a5276]/25 bg-[#eef4f8] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a5276]">Login password</p>
                      <p
                        className="mt-1 font-mono text-xl tracking-wide text-[#0c1222]"
                        style={{ fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
                      >
                        {createdPassword}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyPassword(createdPassword)}
                      className="rounded-full bg-[#1a5276] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#123a54] transition-colors"
                    >
                      {copiedPassword ? "Copied" : "Copy password"}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href={getBusinessProfileUrl({
                      id: created.id,
                      businessName: created.businessName,
                      slug: created.slug,
                      city: created.city,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[#d5dbe6] px-5 py-2.5 text-[13px] font-semibold text-[#0c1222] hover:border-[#1a5276] hover:text-[#1a5276] transition-colors"
                  >
                    View public profile
                  </a>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full bg-[#0c1222] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1a5276] transition-colors"
                  >
                    Register another
                  </button>
                </div>
              </div>
            )}
          </div>

          {step < 3 && (
            <div className="mt-10 flex items-center justify-between gap-3 border-t border-[#dfe3eb] pt-6">
              <button
                type="button"
                disabled={loading || step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="text-[13px] font-semibold text-[#6b7385] disabled:opacity-30 hover:text-[#0c1222] transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={goNext}
                className="rounded-full bg-[#1a5276] px-7 py-3 text-[13px] font-semibold text-white hover:bg-[#123a54] disabled:opacity-60 transition-colors"
              >
                {loading ? "Creating…" : step === 1 ? "Continue" : "Create merchant"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
