"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminToast } from "./AdminToast";
import {
  DEFAULT_MERCHANT_PASSWORD,
  type RegistrationCategory,
} from "./MerchantRegistrationContent";
import { isPlaceholderEmail } from "../lib/placeholderEmail";
import {
  buildQuickOnboardPrompt,
  draftFromAiFields,
  parseQuickOnboardPayload,
  toRegistrationPayload,
  validateQuickOnboardDraft,
  type QuickOnboardDraft,
} from "../lib/quickOnboard";
import { getBusinessLoginUrl, getBusinessProfileUrl } from "../lib/site";

type AdminSession = {
  id: string;
  email: string;
  role: string;
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
  const placeholderNote = isPlaceholderEmail(input.email)
    ? `

Note: We created a temporary login email for you since none was available. Please share your real email with our team so we can update it. You can change your password anytime from your dashboard → Settings.`
    : "";
  return `Hi ${name},

Welcome to FinderB! Your merchant account for ${input.businessName} is ready.

Login details
• Merchant ID: ${input.registrationNumber}
• Email: ${input.email}
• Password: ${input.password}
• Mobile: ${input.mobile}

Login here: ${input.loginUrl}${placeholderNote}

Quick start guide
1. Open the login link above and sign in with your email & password.
2. Complete your business profile (photos, about, timings, WhatsApp).
3. Review your public listing and make sure contact details look right.
4. When you're ready to grow, upgrade from Free/Starter after payment — your plan unlocks based on successful payment.
5. Need help? Reply to this message and our team will assist you.

We're excited to have ${input.businessName} on FinderB.
— Team FinderB`;
}

function StepRail({ active }: { active: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: "Copy prompt", hint: "ChatGPT" },
    { n: 2 as const, label: "Paste JSON", hint: "AI reply" },
    { n: 3 as const, label: "Review", hint: "Create" },
  ];
  return (
    <div className="qo-step-rail">
      {steps.map((s, i) => {
        const done = active > s.n;
        const current = active === s.n;
        return (
          <div key={s.n} className="contents">
            {i > 0 && (
              <div
                className={`qo-step-line ${done || current ? "qo-step-line-on" : ""}`}
              />
            )}
            <div
              className={`qo-step-pill ${
                done ? "qo-step-done" : current ? "qo-step-current" : ""
              }`}
            >
              <span className="qo-step-num">
                {done ? (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  s.n
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold leading-none">
                  {s.label}
                </span>
                <span className="block text-[9px] opacity-70 mt-0.5">
                  {s.hint}
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FieldStatus({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={`qo-field-chip qo-field-${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className="qo-field-badge">
          {tone === "ok"
            ? "Ready"
            : tone === "warn"
              ? "Add"
              : tone === "bad"
                ? "Fix"
                : "—"}
        </span>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-slate-900 break-words leading-snug">
        {value || "—"}
      </p>
    </div>
  );
}

const SAMPLE_JSON = `{
  "ownerFullName": "Priya Sharma",
  "loginEmail": "",
  "emailUnavailable": true,
  "mobile": "9812345678",
  "businessName": "Flame & Flavors",
  "displayName": "Flame & Flavors",
  "category": "Restaurants",
  "subcategory": "Fine Dining",
  "addressLine1": "12 MG Road, Connaught Place",
  "addressLine2": "",
  "city": "New Delhi",
  "state": "Delhi",
  "country": "India",
  "publicPhone": "9812345678",
  "activateImmediately": false,
  "notes": "Sample only — replace with ChatGPT output"
}`;

export default function QuickOnboardContent({
  categories,
  adminSession,
  onRegistered,
}: Props) {
  const { toast } = useAdminToast();
  const [paste, setPaste] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [draft, setDraft] = useState<QuickOnboardDraft | null>(null);
  const [parseMessage, setParseMessage] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [password, setPassword] = useState(DEFAULT_MERCHANT_PASSWORD);
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedMerchant | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const categoryChoices = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    for (const parent of topCategories) {
      const children = categories
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (children.length === 0) {
        rows.push({ label: parent.name, value: parent.name });
      } else {
        for (const child of children) {
          rows.push({
            label: `${parent.name} › ${child.name}`,
            value: `${parent.name} › ${child.name}`,
          });
        }
      }
    }
    return rows;
  }, [categories, topCategories]);

  const promptText = useMemo(
    () => buildQuickOnboardPrompt(categories),
    [categories],
  );

  const applyParse = (raw: string) => {
    const result = parseQuickOnboardPayload(raw);
    if (!result.fields && !result.ok) {
      setDraft(null);
      setParseMessage(result.message);
      setParseErrors([]);
      return;
    }
    if (result.fields) {
      const next = draftFromAiFields(result.fields, categories);
      setDraft(next);
      setParseMessage(result.ok ? "" : result.message);
      setParseErrors(result.errors);
    }
  };

  useEffect(() => {
    if (!paste.trim()) {
      setDraft(null);
      setParseMessage("");
      setParseErrors([]);
      return;
    }
    const t = window.setTimeout(() => applyParse(paste), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paste, categories]);

  const patchDraft = (updates: Partial<QuickOnboardDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if ("category" in updates || "resolvedCategory" in updates) {
        if (updates.resolvedCategory) {
          next.categoryMatched = true;
          next.resolvedCategory = updates.resolvedCategory;
          next.category = updates.resolvedCategory;
        }
      }
      if (updates.emailUnavailable === true) {
        next.loginEmail = "";
      }
      return next;
    });
    setParseMessage("");
  };

  const validation = useMemo(() => {
    if (!draft) return { ok: false as const, error: "Paste AI JSON first." };
    return validateQuickOnboardDraft(draft, password);
  }, [draft, password]);

  const activeStep: 1 | 2 | 3 = created ? 3 : draft ? 3 : paste.trim() ? 2 : 1;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      toast("Prompt copied — paste into ChatGPT", "success");
      window.setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      toast("Could not copy prompt", "error");
    }
  };

  const loginUrl = getBusinessLoginUrl();

  const shareMessage = useMemo(() => {
    if (!created || !createdPassword) return "";
    return buildMerchantShareMessage({
      ownerName: created.fullName || draft?.ownerFullName || "",
      businessName: created.businessName,
      email: created.email || "",
      password: createdPassword,
      mobile: created.mobile || draft?.mobile || "",
      registrationNumber: created.registrationNumber,
      loginUrl,
    });
  }, [created, createdPassword, draft, loginUrl]);

  const whatsappShareUrl = useMemo(() => {
    if (!shareMessage || !created?.mobile) return null;
    const digits = created.mobile.replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${phone}?text=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, created?.mobile]);

  const createMerchant = async () => {
    if (!adminSession?.id) {
      toast("Admin session missing. Please log in again.", "error");
      return;
    }
    if (!draft || !validation.ok) {
      toast(
        !validation.ok && "error" in validation
          ? validation.error
          : "Fix missing fields first.",
        "error",
      );
      return;
    }

    setLoading(true);
    try {
      const payload = toRegistrationPayload(draft, password);
      const res = await fetch("/api/merchants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: adminSession.id,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.error || "Registration failed.", "error");
        return;
      }
      setCreated(data.business);
      setCreatedPassword(password);
      toast("Merchant created", "success");
      onRegistered?.();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setPaste("");
    setDraft(null);
    setParseMessage("");
    setParseErrors([]);
    setPassword(DEFAULT_MERCHANT_PASSWORD);
    setCreated(null);
    setCreatedPassword(null);
    setCopiedMessage(false);
  };

  const fieldTone = (
    key: keyof QuickOnboardDraft,
    okWhen: boolean,
  ): "ok" | "warn" | "bad" | "neutral" => {
    if (!draft) return "neutral";
    if (!okWhen) return "warn";
    if (key === "loginEmail" && draft.emailUnavailable) return "ok";
    return "ok";
  };

  if (created && createdPassword) {
    return (
      <div className="qo-page">
        <div className="qo-success">
          <div className="qo-success-check" aria-hidden>
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="text-center mb-6">
            <p className="qo-kicker justify-center">Partner ready</p>
            <h1 className="qo-title !mt-1">Account created</h1>
            <p className="admin-page-subtitle !mt-1.5 max-w-md mx-auto">
              Share login details with the merchant — then onboard the next one.
            </p>
            <div className="mt-3 flex justify-center">
              <StepRail active={3} />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white/90 p-5 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="admin-status-pill admin-status-live">
                Account created
              </span>
              {isPlaceholderEmail(created.email) && (
                <span className="admin-badge bg-amber-50 text-amber-800 border-amber-200">
                  Placeholder email — collect the real one
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                {created.businessName}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Merchant ID {created.registrationNumber} · {created.status}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Merchant ID",
                  value: created.registrationNumber,
                },
                { label: "Email", value: created.email },
                { label: "Password", value: createdPassword },
                { label: "Mobile", value: created.mobile },
              ].map((row) => (
                <div
                  key={row.label}
                  className="qo-field-chip qo-field-ok !py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {row.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 break-all admin-mono">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">
                  Welcome message
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareMessage);
                        setCopiedMessage(true);
                        toast("Message copied", "success");
                        window.setTimeout(() => setCopiedMessage(false), 2000);
                      } catch {
                        toast("Could not copy", "error");
                      }
                    }}
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
              <pre className="px-4 py-3 max-h-[220px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 font-sans">
                {shareMessage}
              </pre>
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
                onClick={resetAll}
                className="admin-btn-primary"
              >
                Onboard another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const readinessChecks = draft
    ? [
        draft.businessName.length >= 2,
        draft.ownerFullName.length >= 2,
        draft.emailUnavailable || Boolean(draft.loginEmail),
        draft.mobile.length === 10,
        draft.categoryMatched,
        Boolean(draft.city && draft.state && draft.addressLine1),
      ]
    : [];
  const readinessDone = readinessChecks.filter(Boolean).length;
  const readinessTotal = 6;
  const readinessPct = Math.round((readinessDone / readinessTotal) * 100);

  return (
    <div className="qo-page">
      <div className="qo-hero">
        <div className="qo-hero-mesh" aria-hidden />
        <div className="qo-hero-glow" aria-hidden />
        <div className="qo-hero-glow-2" aria-hidden />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="qo-kicker">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
              AI-assisted partner creation
            </p>
            <h1 className="qo-title">Quick Onboard</h1>
            <p className="admin-page-subtitle !mt-1.5 max-w-xl">
              Turn a Google Business listing into a live FinderB partner in
              three tight steps — copy, paste, create.
            </p>
            <div className="qo-flow">
              <span className="qo-flow-chip">Google Business</span>
              <span className="qo-flow-arrow" aria-hidden>
                →
              </span>
              <span className="qo-flow-chip">ChatGPT</span>
              <span className="qo-flow-arrow" aria-hidden>
                →
              </span>
              <span className="qo-flow-chip qo-flow-chip-accent">
                FinderB partner
              </span>
              <span className="qo-meta-pill ml-0 sm:ml-1">
                {categories.length} taxonomy labels
              </span>
            </div>
          </div>
          <StepRail active={activeStep} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 space-y-4">
          <div className="qo-panel qo-panel-delay-1">
            <div className="qo-panel-accent" aria-hidden />
            <div className="qo-panel-body">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="qo-panel-step">
                    <span className="qo-panel-step-num">1</span>
                    Prompt
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Copy the FinderB prompt
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                    Live category & subcategory list is baked in so ChatGPT
                    picks exact FinderB names.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className={`admin-btn-primary !text-xs !py-2 shrink-0 shadow-sm transition-transform ${
                    copiedPrompt ? "scale-105" : ""
                  }`}
                >
                  {copiedPrompt ? "Copied ✓" : "Copy prompt"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPromptOpen((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
              >
                {promptOpen ? "Hide prompt preview" : "Preview prompt"}
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${promptOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {promptOpen && (
                <pre className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans">
                  {promptText}
                </pre>
              )}
            </div>
          </div>

          <div className="qo-panel qo-panel-paste qo-panel-delay-2">
            <div className="qo-panel-body !pt-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="qo-panel-step">
                    <span className="qo-panel-step-num">2</span>
                    Paste
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Drop the AI JSON
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Only the fenced JSON block — not raw Google text.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaste(SAMPLE_JSON)}
                    className="admin-btn-secondary !text-xs !py-1.5"
                  >
                    Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaste("")}
                    className="admin-btn-secondary !text-xs !py-1.5"
                    disabled={!paste}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="qo-terminal">
                <div className="qo-terminal-bar">
                  <span className="qo-terminal-dot bg-rose-400" />
                  <span className="qo-terminal-dot bg-amber-400" />
                  <span className="qo-terminal-dot bg-emerald-400" />
                  <span className="ml-2 text-[10px] font-medium text-slate-400 truncate">
                    chatgpt-reply.json
                  </span>
                  {paste.trim() && draft && !parseMessage ? (
                    <span className="ml-auto qo-parse-ok !py-0.5 !text-[10px]">
                      Parsed
                    </span>
                  ) : paste.trim() && parseMessage ? (
                    <span className="ml-auto qo-parse-bad !py-0.5 !text-[10px]">
                      Needs fix
                    </span>
                  ) : null}
                </div>
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text) {
                      window.setTimeout(() => applyParse(text), 0);
                    }
                  }}
                  rows={13}
                  spellCheck={false}
                  placeholder={`\`\`\`json\n{ "businessName": "...", "category": "...", "subcategory": "..." }\n\`\`\``}
                  className="qo-paste-area"
                />
              </div>

              {parseMessage && (
                <p className="mt-2 text-[12px] font-medium text-rose-600">
                  {parseMessage}
                </p>
              )}
              {parseErrors.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {parseErrors.map((err) => (
                    <li
                      key={err}
                      className="text-[11px] text-rose-600 font-medium"
                    >
                      {err}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-4">
          <div className="qo-panel min-h-[28rem] qo-panel-delay-3">
            <div className="qo-panel-body !pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <p className="qo-panel-step">
                    <span className="qo-panel-step-num">3</span>
                    Review
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Review & create
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Tweak any field, then create the merchant account.
                  </p>
                </div>
                {draft && validation.ok && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ready to create
                  </span>
                )}
              </div>

              {!draft ? (
                <div className="qo-empty">
                  <div className="qo-empty-icon">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    Waiting for AI JSON
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Copy the prompt → paste Google details into ChatGPT → drop
                    the JSON reply on the left. Status chips light up the
                    moment it parses.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 opacity-70">
                    {["Business", "Category", "Mobile", "Location"].map(
                      (label) => (
                        <span
                          key={label}
                          className="rounded-md border border-dashed border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-400"
                        >
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="qo-readiness">
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                      {readinessDone}/{readinessTotal} ready
                    </span>
                    <div className="qo-readiness-track">
                      <div
                        className="qo-readiness-fill"
                        style={{ width: `${readinessPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-teal-700 shrink-0">
                      {readinessPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <FieldStatus
                      label="Business"
                      value={draft.businessName}
                      tone={fieldTone(
                        "businessName",
                        draft.businessName.length >= 2,
                      )}
                    />
                    <FieldStatus
                      label="Owner"
                      value={draft.ownerFullName}
                      tone={fieldTone(
                        "ownerFullName",
                        draft.ownerFullName.length >= 2,
                      )}
                    />
                    <FieldStatus
                      label="Login email"
                      value={
                        draft.emailUnavailable
                          ? "Placeholder (email missing)"
                          : draft.loginEmail
                      }
                      tone={
                        draft.emailUnavailable || draft.loginEmail
                          ? "ok"
                          : "warn"
                      }
                    />
                    <FieldStatus
                      label="Mobile"
                      value={draft.mobile}
                      tone={fieldTone("mobile", draft.mobile.length === 10)}
                    />
                    <FieldStatus
                      label="Category"
                      value={
                        draft.categoryMatched
                          ? draft.resolvedCategory
                          : draft.category
                            ? draft.subcategory
                              ? `${draft.category} › ${draft.subcategory}`
                              : draft.category
                            : "Pick from list"
                      }
                      tone={draft.categoryMatched ? "ok" : "warn"}
                    />
                    <FieldStatus
                      label="Location"
                      value={[draft.city, draft.state, draft.country]
                        .filter(Boolean)
                        .join(", ")}
                      tone={draft.city && draft.state ? "ok" : "warn"}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <label className="space-y-1">
                      <span className="admin-label">Owner full name</span>
                      <input
                        className="admin-input"
                        value={draft.ownerFullName}
                        onChange={(e) =>
                          patchDraft({ ownerFullName: e.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">Business name</span>
                      <input
                        className="admin-input"
                        value={draft.businessName}
                        onChange={(e) =>
                          patchDraft({ businessName: e.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">Display name</span>
                      <input
                        className="admin-input"
                        value={draft.displayName}
                        onChange={(e) =>
                          patchDraft({ displayName: e.target.value })
                        }
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="admin-label">Category</span>
                      <select
                        className="admin-input"
                        value={
                          draft.categoryMatched ? draft.resolvedCategory : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          const parts = value.split(/\s*›\s*/);
                          patchDraft({
                            resolvedCategory: value,
                            category: parts[0] || value,
                            subcategory: parts[1] || "",
                            categoryMatched: Boolean(value),
                          });
                        }}
                      >
                        <option value="">
                          {draft.category
                            ? `AI suggested: ${
                                draft.subcategory
                                  ? `${draft.category} › ${draft.subcategory}`
                                  : draft.category
                              } — pick match`
                            : "Select category"}
                        </option>
                        {categoryChoices.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="space-y-1 md:col-span-2">
                      <span className="admin-label">Address line 1</span>
                      <input
                        className="admin-input"
                        value={draft.addressLine1}
                        onChange={(e) =>
                          patchDraft({ addressLine1: e.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                      <span className="admin-label">Address line 2</span>
                      <input
                        className="admin-input"
                        value={draft.addressLine2}
                        onChange={(e) =>
                          patchDraft({ addressLine2: e.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">City</span>
                      <input
                        className="admin-input"
                        value={draft.city}
                        onChange={(e) => patchDraft({ city: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">State</span>
                      <input
                        className="admin-input"
                        value={draft.state}
                        onChange={(e) => patchDraft({ state: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">Mobile</span>
                      <input
                        className="admin-input"
                        value={draft.mobile}
                        onChange={(e) =>
                          patchDraft({
                            mobile: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 10),
                          })
                        }
                        inputMode="numeric"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">Public phone</span>
                      <input
                        className="admin-input"
                        value={draft.publicPhone}
                        onChange={(e) =>
                          patchDraft({
                            publicPhone: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 10),
                          })
                        }
                        inputMode="numeric"
                      />
                    </label>
                    <div className="space-y-1 md:col-span-2">
                      <span className="admin-label">Login email</span>
                      <input
                        type="email"
                        className="admin-input disabled:bg-slate-50"
                        value={draft.loginEmail}
                        disabled={draft.emailUnavailable}
                        onChange={(e) =>
                          patchDraft({ loginEmail: e.target.value })
                        }
                        placeholder={
                          draft.emailUnavailable
                            ? "Will generate company-name@finderb.com"
                            : "partner@studio.in"
                        }
                      />
                      <label className="mt-1.5 flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-teal-700"
                          checked={draft.emailUnavailable}
                          onChange={(e) =>
                            patchDraft({
                              emailUnavailable: e.target.checked,
                              loginEmail: e.target.checked
                                ? ""
                                : draft.loginEmail,
                            })
                          }
                        />
                        <span className="text-[11px] text-slate-600">
                          Email not available — use placeholder login
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Login password
                      </p>
                      <span className="admin-badge bg-teal-50 text-teal-800 border-teal-100">
                        Default
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? "text" : "password"}
                          className="admin-input admin-mono pr-14"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-teal-700"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPassword(DEFAULT_MERCHANT_PASSWORD)}
                        className="admin-btn-secondary !text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-emerald-700"
                      checked={draft.activateImmediately}
                      onChange={(e) =>
                        patchDraft({ activateImmediately: e.target.checked })
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Activate listing immediately
                      </span>
                      <span className="block text-[12px] text-slate-600 mt-0.5">
                        Sets status to Active for public display. Does not
                        affect KYC.
                      </span>
                    </span>
                  </label>

                  {!validation.ok && "error" in validation && (
                    <p className="text-[12px] font-medium text-rose-600">
                      {validation.error}
                    </p>
                  )}

                  <div className="qo-create-bar">
                    <button
                      type="button"
                      onClick={resetAll}
                      className="admin-btn-secondary"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      disabled={loading || !validation.ok}
                      onClick={() => void createMerchant()}
                      className="admin-btn-primary !px-5"
                    >
                      {loading ? "Creating…" : "Create merchant"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
