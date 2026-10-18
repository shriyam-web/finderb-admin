"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminToast } from "./AdminToast";
import {
  DEFAULT_MERCHANT_PASSWORD,
  type RegistrationCategory,
} from "./MerchantRegistrationContent";
import { isPlaceholderEmail } from "../lib/placeholderEmail";
import { extractIndianMobileDigits } from "../lib/indianPhone";
import {
  buildQuickOnboardPrompt,
  draftFromAiFields,
  parseQuickOnboardPayload,
  toRegistrationPayload,
  validateQuickOnboardDraft,
  type QuickOnboardDraft,
} from "../lib/quickOnboard";
import { getBusinessLoginUrl, getBusinessProfileUrl } from "../lib/site";
import { emptyWeekTimings } from "../lib/workingHours";
import WorkingHoursEditor from "./WorkingHoursEditor";
import { AiJsonArt, MapsImportArt } from "./OnboardHeroArt";
import PaymentModesCheckboxes from "./PaymentModesCheckboxes";
import { CategorySubcategoryPicker } from "./CategorySubcategoryPicker";
import {
  primaryBusinessCategory,
  splitBusinessCategories,
} from "../lib/categoryLabel";

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
  canManage?: boolean;
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

Temporary email note
We used a temporary login email because none was available. Please share your real email with our team so we can update it. You can also change your password anytime from Dashboard → Settings.`
    : "";

  return `Hi ${name},

Welcome to FinderB — your merchant account for ${input.businessName} is ready.

Your login details
Reg. No.: ${input.registrationNumber}
Email: ${input.email}
Password: ${input.password}
Mobile: ${input.mobile}

Sign in here:
${input.loginUrl}${placeholderNote}

Getting started
1. Open the link above and sign in with your email and password.
2. Complete your business profile — photos, about, working hours, and WhatsApp.
3. Review your public listing and confirm contact details look right.
4. When you want to grow, upgrade from Free/Starter after payment.

Need help? Reply to this message and our team will assist you.

Glad to have ${input.businessName} on FinderB.
— Team FinderB`;
}

function StepArrow({ active }: { active?: boolean }) {
  return (
    <span
      className={`qo-step-arrow ${active ? "qo-step-arrow-on" : ""}`}
      aria-hidden
    >
      <svg viewBox="0 0 20 12" fill="none" className="h-3 w-5">
        <path
          d="M1 6h14M11 2l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function StepRail({
  active,
  steps,
}: {
  active: number;
  steps?: { n: number; label: string; hint: string }[];
}) {
  const items = steps || [
    { n: 1, label: "Copy prompt", hint: "Any AI" },
    { n: 2, label: "Paste JSON", hint: "AI reply" },
    { n: 3, label: "Review", hint: "Create" },
  ];
  return (
    <div className="qo-step-rail" dir="ltr">
      {items.map((s, i) => {
        const done = active > s.n;
        const current = active === s.n;
        return (
          <div key={s.n} className="qo-step-item">
            {i > 0 && <StepArrow active={done || current} />}
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

type OnboardMethod = "ai" | "link";

const QO_DEFAULT_METHOD_KEY = "finderb_qo_default_method";

function readDefaultMethod(): OnboardMethod {
  try {
    const v = localStorage.getItem(QO_DEFAULT_METHOD_KEY);
    if (v === "ai") return "ai";
    return "link";
  } catch {
    return "link";
  }
}

function methodLabel(m: OnboardMethod) {
  return m === "link" ? "GBP Link Method" : "AI JSON Method";
}

const FETCH_LOG_LINES = [
  "Opening Maps share redirect…",
  "Resolving place identity fingerprint…",
  "Handshake with Places Details pipeline…",
  "Decrypting listing metadata packet…",
  "Pulling editorial summary & categories…",
  "Mapping weekly opening hours grid…",
  "Hydrating gallery photo references…",
  "Scraping website for social graph…",
  "Normalizing Indian mobile formats…",
  "Scoring Google star rating payload…",
  "Aligning lat/lng to FinderB geo slot…",
  "Compressing profile extras for review…",
];

function GoogleFetchTheater({
  stage,
}: {
  stage: "idle" | "resolving" | "enriching" | "done" | "error";
}) {
  const [tick, setTick] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const a = window.setInterval(() => setTick((t) => t + 1), 90);
    const b = window.setInterval(
      () => setLogIndex((i) => (i + 1) % FETCH_LOG_LINES.length),
      520,
    );
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
    };
  }, []);

  const steps = [
    {
      id: "resolve",
      label: "Resolve share link",
      on: stage !== "idle",
    },
    {
      id: "place",
      label: "Identify Google place",
      on: stage === "enriching" || stage === "done",
    },
    {
      id: "enrich",
      label: "Enrich photos · hours · rating",
      on: stage === "enriching" || stage === "done",
    },
    {
      id: "pack",
      label: "Pack FinderB draft",
      on: stage === "done",
    },
  ];

  const progress =
    stage === "resolving" ? 28 + (tick % 18) : stage === "enriching" ? 55 + (tick % 30) : 92;

  return (
    <div className="qo-fetch-theater" role="status" aria-live="polite">
      <div className="qo-fetch-theater-glow" aria-hidden />
      <div className="qo-fetch-theater-grid" aria-hidden />
      <div className="qo-fetch-orbit" aria-hidden>
        <span className="qo-fetch-orbit-ring" />
        <span className="qo-fetch-orbit-ring qo-fetch-orbit-ring-2" />
        <span className="qo-fetch-orbit-core" />
        <span className="qo-fetch-orbit-beam" />
      </div>
      <div className="qo-fetch-theater-copy">
        <p className="qo-fetch-kicker">FinderB import engine</p>
        <h3 className="qo-fetch-title">
          {stage === "enriching"
            ? "Deep-reading the listing…"
            : "Hunting the place…"}
        </h3>
        <p className="qo-fetch-sub">
          Places API · hours map · gallery · Google rating · contacts
        </p>
        <div className="qo-fetch-meter">
          <div
            className="qo-fetch-meter-fill"
            style={{ width: `${Math.min(progress, 97)}%` }}
          />
        </div>
        <ul className="qo-fetch-steps">
          {steps.map((s) => (
            <li
              key={s.id}
              className={`qo-fetch-step ${s.on ? "qo-fetch-step-on" : ""}`}
            >
              <span className="qo-fetch-step-dot" />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="qo-fetch-log" aria-hidden>
          <span className="qo-fetch-log-prompt">»</span>
          <span key={logIndex} className="qo-fetch-log-line">
            {FETCH_LOG_LINES[logIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}

const AI_STEPS = [
  { n: 1, label: "Paste prompt into AI", hint: "With merchant details" },
  { n: 2, label: "Get the JSON", hint: "From AI reply" },
  { n: 3, label: "Paste JSON here", hint: "In FinderB" },
  { n: 4, label: "Review & Create", hint: "Partner account" },
];

const LINK_STEPS = [
  { n: 1, label: "Paste the Link", hint: "Maps share URL" },
  { n: 2, label: "Review & Create", hint: "Partner account" },
];

type LinkFillSummary = {
  name: boolean;
  address: boolean;
  phone: boolean;
  about: boolean;
  photos: number;
  website: boolean;
  mapsUrl: boolean;
  social: boolean;
  timings: boolean;
  rating: boolean;
  category: boolean;
};

const EMPTY_LINK_SUMMARY: LinkFillSummary = {
  name: false,
  address: false,
  phone: false,
  about: false,
  photos: 0,
  website: false,
  mapsUrl: false,
  social: false,
  timings: false,
  rating: false,
  category: false,
};

function summarizeLinkFields(
  fields: Parameters<typeof draftFromAiFields>[0],
): LinkFillSummary {
  return {
    name: Boolean(fields.businessName?.trim()),
    address: Boolean(
      fields.addressLine1?.trim() && fields.city?.trim() && fields.state?.trim(),
    ),
    phone: Boolean(fields.mobile?.trim()),
    about: Boolean(fields.about?.trim()),
    photos: fields.photos?.length || 0,
    website: Boolean(fields.website?.trim()),
    mapsUrl: Boolean(fields.mapsUrl?.trim()),
    social: Boolean(
      fields.instagramUrl?.trim() ||
        fields.facebookUrl?.trim() ||
        fields.youtubeUrl?.trim(),
    ),
    timings: Boolean(fields.timings),
    rating: fields.rating != null && Number.isFinite(fields.rating),
    category: Boolean(fields.category?.trim()),
  };
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
  const statusLabel =
    tone === "ok"
      ? "Ready"
      : tone === "warn"
        ? "Needed"
        : tone === "bad"
          ? "Fix"
          : "Optional";

  return (
    <div className={`qo-field-chip qo-field-${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="qo-field-label">{label}</p>
          <p className="qo-field-value">{value || "—"}</p>
        </div>
        <span
          className={`qo-field-dot qo-field-dot-${tone}`}
          title={statusLabel}
          aria-label={statusLabel}
        />
      </div>
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
  "notes": "Sample only — replace with AI output"
}`;

export default function QuickOnboardContent({
  categories,
  adminSession,
  onRegistered,
  canManage = false,
}: Props) {
  const { toast } = useAdminToast();
  const [method, setMethod] = useState<OnboardMethod>("link");
  const [defaultMethod, setDefaultMethod] = useState<OnboardMethod>("link");
  const [paste, setPaste] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const [linkSummary, setLinkSummary] =
    useState<LinkFillSummary>(EMPTY_LINK_SUMMARY);
  const [linkStage, setLinkStage] = useState<
    "idle" | "resolving" | "enriching" | "done" | "error"
  >("idle");
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const successRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(QO_DEFAULT_METHOD_KEY)) {
        localStorage.setItem(QO_DEFAULT_METHOD_KEY, "link");
      }
    } catch {
      /* ignore */
    }
    const saved = readDefaultMethod();
    setDefaultMethod(saved);
    setMethod(saved);
  }, []);

  useEffect(() => {
    if (!created || !createdPassword) return;

    const scrollToVeryTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      let node: HTMLElement | null = successRef.current;
      while (node) {
        if (node.scrollTop) node.scrollTop = 0;
        node = node.parentElement;
      }

      const main = document.querySelector("main.admin-main");
      if (main instanceof HTMLElement) main.scrollTop = 0;
      const content = document.querySelector(".admin-content-area");
      if (content instanceof HTMLElement) content.scrollTop = 0;

      successRef.current?.focus({ preventScroll: true });
    };

    scrollToVeryTop();
    const raf = window.requestAnimationFrame(() => {
      scrollToVeryTop();
      window.requestAnimationFrame(scrollToVeryTop);
    });
    const t1 = window.setTimeout(scrollToVeryTop, 0);
    const t2 = window.setTimeout(scrollToVeryTop, 120);
    const t3 = window.setTimeout(scrollToVeryTop, 320);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [created, createdPassword]);

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
      // Keep payment-mode edits across AI JSON re-parses.
      setDraft((prev) =>
        prev?.paymentModes
          ? { ...next, paymentModes: prev.paymentModes }
          : next,
      );
      setParseMessage(result.ok ? "" : result.message);
      setParseErrors(result.errors);
    }
  };

  useEffect(() => {
    if (method !== "ai") return;
    if (!paste.trim()) {
      setDraft(null);
      setParseMessage("");
      setParseErrors([]);
      return;
    }
    const t = window.setTimeout(() => applyParse(paste), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paste, categories, method]);

  const switchMethod = (next: OnboardMethod) => {
    if (next === method) return;
    setMethod(next);
    setDraft(null);
    setParseMessage("");
    setParseErrors([]);
    setLinkMessage("");
    setLinkSummary(EMPTY_LINK_SUMMARY);
    setLinkStage("idle");
    setCreated(null);
    setCreatedPassword(null);
  };

  const saveDefaultMethod = (next: OnboardMethod) => {
    setDefaultMethod(next);
    try {
      localStorage.setItem(QO_DEFAULT_METHOD_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
    toast(`Default tab set to ${methodLabel(next)}`, "success");
  };

  const fetchFromGoogleLink = async (urlOverride?: string) => {
    const url = (urlOverride ?? mapsUrl).trim();
    if (!url) {
      setLinkMessage("Paste a Google Maps share link first.");
      setLinkStage("error");
      toast("Paste a Google link first", "error");
      return;
    }
    setLinkLoading(true);
    setLinkMessage("");
    setLinkStage("resolving");
    setParseErrors([]);
    setLinkSummary(EMPTY_LINK_SUMMARY);
    const startedAt = Date.now();
    const stageTimer = window.setTimeout(() => {
      setLinkStage((s) => (s === "resolving" ? "enriching" : s));
    }, 700);
    try {
      const response = await fetch("/api/maps/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        fields?: Parameters<typeof draftFromAiFields>[0];
      };

      // Keep the theater on screen long enough to feel substantial.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 2400) {
        await new Promise((r) => window.setTimeout(r, 2400 - elapsed));
      }

      if (!response.ok || !data.success || !data.fields) {
        setDraft(null);
        setLinkSummary(EMPTY_LINK_SUMMARY);
        setLinkStage("error");
        setLinkMessage(data.error || "Could not read this Google link.");
        toast(data.error || "Could not read this Google link", "error");
        return;
      }
      const next = draftFromAiFields(data.fields, categories);
      const summary = summarizeLinkFields(data.fields);
      setDraft(next);
      setLinkSummary(summary);
      setLinkStage("done");
      const filledCount = [
        summary.name,
        summary.address,
        summary.phone,
        summary.about,
        summary.photos > 0,
        summary.website,
        summary.mapsUrl,
        summary.social,
        summary.timings,
        summary.rating,
        summary.category,
      ].filter(Boolean).length;
      setLinkMessage(
        data.message ||
          `Pulled ${filledCount} data groups from Google — review on the right.`,
      );
      toast(
        next.categoryMatched
          ? "Listing imported — review & create"
          : "Listing imported — pick a FinderB category",
        "success",
      );
    } catch {
      setDraft(null);
      setLinkSummary(EMPTY_LINK_SUMMARY);
      setLinkStage("error");
      setLinkMessage("Network error while reading the Google link.");
      toast("Network error", "error");
    } finally {
      window.clearTimeout(stageTimer);
      setLinkLoading(false);
    }
  };

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

  const activeStep =
    method === "link"
      ? draft || created
        ? 2
        : 1
      : draft || created
        ? 4
        : paste.trim()
          ? 3
          : copiedPrompt
            ? 2
            : 1;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      toast("Prompt copied — paste into your AI", "success");
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
    if (!canManage) {
      toast("Read-only — creating merchants requires Edit permission.", "error");
      return;
    }
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
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setPaste("");
    setMapsUrl("");
    setLinkMessage("");
    setLinkSummary(EMPTY_LINK_SUMMARY);
    setLinkStage("idle");
    setDraft(null);
    setParseMessage("");
    setParseErrors([]);
    setPassword(DEFAULT_MERCHANT_PASSWORD);
    setCreated(null);
    setCreatedPassword(null);
    setCopiedMessage(false);
    setCopiedField(null);
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

  const copyField = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      toast(`${label} copied`, "success");
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      toast("Could not copy", "error");
    }
  };

  if (created && createdPassword) {
    const profileUrl = getBusinessProfileUrl({
      id: created.id,
      businessName: created.businessName,
      slug: created.slug,
      city: created.city,
    });
    const credentialRows = [
      {
        label: "Reg. No.",
        value: created.registrationNumber,
      },
      {
        label: "Email",
        value: created.email || "—",
      },
      {
        label: "Password",
        value: createdPassword,
      },
      {
        label: "Mobile",
        value: created.mobile || draft?.mobile || "—",
      },
    ];

    return (
      <div className="qo-page qo-success-page">
        <div className="qo-success-top-anchor" aria-hidden />
        <section
          ref={successRef}
          tabIndex={-1}
          aria-labelledby="qo-success-title"
          className="qo-success outline-none"
        >
          <header className="qo-success-header">
            <div className="qo-success-check" aria-hidden>
              <svg
                className="h-6 w-6"
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
            <div className="min-w-0 flex-1">
              <h1 id="qo-success-title" className="qo-success-title">
                Account created
              </h1>
              <p className="qo-success-business">{created.businessName}</p>
              <p className="qo-success-lead">
                Share the welcome message below with the merchant. Credentials
                are included — no extra steps needed.
              </p>
              <p className="qo-success-meta-line">
                <span>{created.status || "Created"}</span>
                <span aria-hidden>·</span>
                <span>Reg. No. {created.registrationNumber}</span>
                {isPlaceholderEmail(created.email) && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-amber-700">
                      Placeholder email — collect the real one
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="admin-btn-primary shrink-0"
            >
              Onboard another
            </button>
          </header>

          <div className="qo-success-body">
            <div>
              <div className="qo-success-section-head">
                <h2 className="qo-success-section-title">Login credentials</h2>
              </div>
              <dl className="qo-success-rows">
                {credentialRows.map((row) => (
                  <div key={row.label} className="qo-success-row">
                    <dt>{row.label}</dt>
                    <dd>
                      <span className="admin-mono">{row.value}</span>
                      <button
                        type="button"
                        className="qo-success-row-copy"
                        onClick={() => copyField(row.label, String(row.value))}
                      >
                        {copiedField === row.label ? "Copied" : "Copy"}
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <div className="qo-success-section-head">
                <div>
                  <h2 className="qo-success-section-title">Welcome message</h2>
                  <p className="qo-success-section-sub">
                    Paste into WhatsApp, SMS, or email.
                  </p>
                </div>
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
                      Open WhatsApp
                    </a>
                  )}
                </div>
              </div>
              <pre className="qo-success-message custom-scrollbar">
                {shareMessage}
              </pre>
            </div>

            <div className="qo-success-footer">
              <div className="qo-success-links">
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn-secondary"
                >
                  Open login page
                </a>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn-secondary"
                >
                  View public profile
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const readinessChecks = draft
    ? [
        draft.businessName.trim().length >= 2 && draft.businessName.trim().length <= 50,
        draft.emailUnavailable || Boolean(draft.loginEmail),
        draft.mobile.length === 10,
        draft.categoryMatched,
        Boolean(draft.city && draft.state && draft.addressLine1),
      ]
    : [];
  const readinessDone = readinessChecks.filter(Boolean).length;
  const readinessTotal = 5;
  const readinessPct = Math.round((readinessDone / readinessTotal) * 100);

  return (
    <div className="qo-page">
      {!canManage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Read-only — creating merchants requires Edit permission.
        </div>
      )}
      <div className="qo-method-wrap">
        <div
          className={`qo-method-switch qo-method-switch-${method}`}
          role="tablist"
          aria-label="Onboard method"
        >
          <span className="qo-method-sheen" aria-hidden />
          <span className="qo-method-glider" aria-hidden />

          <div
            className={`qo-method-tab ${method === "link" ? "qo-method-tab-active" : ""}`}
            role="tab"
            aria-selected={method === "link"}
          >
            <button
              type="button"
              className="qo-method-tab-main"
              onClick={() => switchMethod("link")}
            >
              <span className="qo-method-icon qo-method-icon-brand" aria-hidden>
                <svg viewBox="0 0 24 24" className="qo-method-logo" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </span>
              <span className="qo-method-tab-copy">
                <span className="qo-method-tab-title-row">
                  <span className="qo-method-tab-title">GBP Link Method</span>
                  {defaultMethod === "link" && (
                    <span className="qo-method-tab-default">Default</span>
                  )}
                </span>
                <span className="qo-method-tab-hint">
                  Paste a Maps share URL and import the listing
                </span>
              </span>
            </button>
            {defaultMethod !== "link" && (
              <button
                type="button"
                className="qo-set-default"
                onClick={() => saveDefaultMethod("link")}
              >
                Set as default
              </button>
            )}
          </div>

          <div
            className={`qo-method-tab ${method === "ai" ? "qo-method-tab-active" : ""}`}
            role="tab"
            aria-selected={method === "ai"}
          >
            <button
              type="button"
              className="qo-method-tab-main"
              onClick={() => switchMethod("ai")}
            >
              <span className="qo-method-icon qo-method-icon-brand" aria-hidden>
                <svg
                  viewBox="0 0 630 630"
                  className="qo-method-logo"
                  aria-hidden
                >
                  <rect width="630" height="630" fill="#F7DF1E" />
                  <path
                    fill="#000000"
                    d="m423.2 492.19c12.69 20.72 29.2 35.95 58.4 35.95 24.53 0 40.2-12.26 40.2-29.2 0-20.3-16.1-27.49-43.1-39.3l-14.8-6.35c-42.72-18.2-71.1-41-71.1-89.2 0-44.4 33.83-78.2 86.7-78.2 37.64 0 64.7 13.1 84.2 47.4l-46.1 29.6c-10.15-18.2-21.1-25.37-38.1-25.37-17.34 0-28.33 11-28.33 25.37 0 17.76 10.95 24.95 36.3 35.95l14.8 6.34c50.3 21.57 78.7 43.56 78.7 93 0 53.3-41.87 82.5-98.1 82.5-54.98 0-90.5-26.2-107.88-60.54zm-209.13 5.13c9.3 16.5 17.6 30.45 37.6 30.45 19.45 0 31.7-7.61 31.7-37.2v-201.3h59.2v202.1c0 61.3-35.95 89.2-88.4 89.2-47.4 0-74.85-24.53-88.81-54.075z"
                  />
                </svg>
              </span>
              <span className="qo-method-tab-copy">
                <span className="qo-method-tab-title-row">
                  <span className="qo-method-tab-title">AI JSON Method</span>
                  {defaultMethod === "ai" && (
                    <span className="qo-method-tab-default">Default</span>
                  )}
                </span>
                <span className="qo-method-tab-hint">
                  Copy prompt, paste AI JSON, then create
                </span>
              </span>
            </button>
            {defaultMethod !== "ai" && (
              <button
                type="button"
                className="qo-set-default"
                onClick={() => saveDefaultMethod("ai")}
              >
                Set as default
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={`qo-hero ${method === "link" ? "qo-hero-link" : "qo-hero-ai"}`}
        key={method}
      >
        <div className="qo-hero-accent" aria-hidden />
        <div className="qo-hero-layout">
          <div className="qo-hero-copy">
            <h1 className="qo-title">
              {method === "link"
                ? "Import a listing from Google Maps"
                : "Onboard with AI-prepared JSON"}
            </h1>
            <p className="qo-hero-sub">
              {method === "link"
                ? "Pull business details from a Google Maps share link, review what came through, then create the FinderB partner account."
                : "Use the FinderB prompt in any AI, paste the structured JSON reply here, review every field, then create the partner."}
            </p>
            <ul className="qo-hero-points">
              {method === "link" ? (
                <>
                  <li>
                    Paste a Maps share URL — name, address, hours, rating, and
                    photos are fetched automatically.
                  </li>
                  <li>
                    Confirm category and any missing contact details in the
                    review panel.
                  </li>
                  <li>
                    Create the merchant with a default password you can share
                    immediately.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Copy the FinderB prompt — it includes live category names so
                    the AI matches your taxonomy.
                  </li>
                  <li>
                    Paste the AI’s JSON output and fix any fields that still
                    need attention.
                  </li>
                  <li>
                    Create the partner account once the review checklist is
                    complete.
                  </li>
                </>
              )}
            </ul>
            <div className="qo-hero-rail">
              <StepRail
                active={activeStep}
                steps={method === "link" ? LINK_STEPS : AI_STEPS}
              />
            </div>
          </div>

          <div className="qo-hero-art">
            {method === "link" ? <MapsImportArt /> : <AiJsonArt />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 space-y-4">
          {method === "ai" ? (
            <>
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
                        Live category & subcategory list is baked in so the AI
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
                        ai-reply.json
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
            </>
          ) : (
            <div className="space-y-4">
              <div className="qo-panel qo-link-panel qo-panel-delay-1">
                <div className="qo-panel-accent" aria-hidden />
                <div className="qo-panel-body !pt-4">
                  <div className="mb-4">
                    <p className="qo-panel-step">
                      <span className="qo-panel-step-num">1</span>
                      Import
                    </p>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Bring the listing from{" "}
                      <a
                        href="https://maps.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-700 underline underline-offset-2 hover:text-teal-900"
                      >
                        Google Maps
                      </a>
                    </h2>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                      One share link is enough. We resolve the place, pull
                      public details, then open the review form on the right.
                    </p>
                  </div>

                  <div
                    className={`qo-link-drop ${
                      linkLoading
                        ? "qo-link-drop-busy"
                        : linkStage === "done"
                          ? "qo-link-drop-ok"
                          : linkStage === "error"
                            ? "qo-link-drop-err"
                            : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="qo-link-drop-icon" aria-hidden>
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="admin-label !mb-0">
                            Google Maps share URL
                          </span>
                          {linkStage === "done" && (
                            <span className="qo-parse-ok !py-0.5 !text-[10px]">
                              Imported
                            </span>
                          )}
                          {linkStage === "error" && (
                            <span className="qo-parse-bad !py-0.5 !text-[10px]">
                              Failed
                            </span>
                          )}
                        </div>
                        <input
                          className="admin-input"
                          value={mapsUrl}
                          onChange={(e) => {
                            setMapsUrl(e.target.value);
                            if (linkStage === "error" || linkStage === "done") {
                              setLinkStage("idle");
                              setLinkMessage("");
                            }
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text")?.trim();
                            if (text) {
                              window.setTimeout(() => {
                                setMapsUrl(text);
                                void fetchFromGoogleLink(text);
                              }, 0);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void fetchFromGoogleLink();
                            }
                          }}
                          placeholder="https://maps.app.goo.gl/… or google.com/maps/place/…"
                          spellCheck={false}
                          disabled={linkLoading}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={linkLoading || !mapsUrl.trim()}
                        onClick={() => void fetchFromGoogleLink()}
                        className="admin-btn-primary !text-xs !py-2 min-w-[9.5rem]"
                      >
                        {linkLoading
                          ? linkStage === "enriching"
                            ? "Importing…"
                            : "Resolving…"
                          : draft
                            ? "Re-fetch listing"
                            : "Fetch listing"}
                      </button>
                      <button
                        type="button"
                        className="admin-btn-secondary !text-xs !py-2"
                        disabled={linkLoading || (!mapsUrl && !draft)}
                        onClick={() => {
                          setMapsUrl("");
                          setDraft(null);
                          setLinkMessage("");
                          setLinkSummary(EMPTY_LINK_SUMMARY);
                          setLinkStage("idle");
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="qo-link-tips">
                    <p className="qo-link-tips-title">Tips for a clean import</p>
                    <ul className="qo-link-tips-list">
                      <li>
                        Open the <strong>exact place listing</strong> in{" "}
                        <a
                          href="https://maps.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Google Maps
                        </a>
                        , then use <strong>Share → Copy link</strong>.
                      </li>
                      <li>
                        Use a <strong>place / business link</strong> only —
                        city search, directions, or dropped-pin links often
                        fail or return incomplete data.
                      </li>
                      <li>
                        Short links like <code>maps.app.goo.gl/…</code> and
                        full <code>google.com/maps/place/…</code> URLs both
                        work. Paste starts fetch automatically (or press
                        Enter).
                      </li>
                      <li>
                        Owner name and email are <strong>not on Maps</strong> —
                        fill owner later if needed; login uses a placeholder
                        email.
                      </li>
                      <li>
                        Always confirm <strong>FinderB category</strong> on the
                        right before create — Google’s category is only a hint.
                      </li>
                    </ul>
                  </div>

                  {linkLoading && <GoogleFetchTheater stage={linkStage} />}

                  {linkMessage && !linkLoading && (
                    <p
                      className={`mt-3 text-[12px] font-medium ${
                        linkStage === "done"
                          ? "text-emerald-700"
                          : "text-rose-600"
                      }`}
                    >
                      {linkMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-7 space-y-4">
          <div className="qo-panel qo-review-panel qo-panel-delay-3">
            <div className="qo-panel-body !pt-4">
              <div className="qo-review-header">
                <div className="min-w-0">
                  <p className="qo-panel-step">
                    <span className="qo-panel-step-num">
                      {method === "link" ? "2" : "3"}
                    </span>
                    Review
                  </p>
                  <h2 className="qo-review-title">
                    {method === "link"
                      ? "Confirm imported listing"
                      : "Review & create"}
                  </h2>
                  <p className="qo-review-sub">
                    {method === "link"
                      ? "Check imported fields, confirm category, then create the partner."
                      : "Tweak any field, then create the merchant account."}
                  </p>
                </div>
                {draft && (
                  <div className="qo-review-meta">
                    <div className="qo-readiness qo-readiness-compact">
                      <span className="text-[11px] font-medium text-slate-500 shrink-0">
                        {readinessDone}/{readinessTotal}
                      </span>
                      <div className="qo-readiness-track">
                        <div
                          className="qo-readiness-fill"
                          style={{ width: `${readinessPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-teal-700 shrink-0">
                        {readinessPct}%
                      </span>
                    </div>
                    {validation.ok && (
                      <span className="qo-review-ready">Ready to create</span>
                    )}
                  </div>
                )}
              </div>

              {!draft ? (
                <div className="qo-empty qo-empty-review">
                  <div className="qo-empty-icon">
                    {method === "link" ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {method === "link"
                      ? "No listing imported yet"
                      : "Waiting for AI JSON"}
                  </p>
                  <p className="mt-1.5 text-[12px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {method === "link"
                      ? "Paste a Maps share link on the left. This form unlocks when the import finishes."
                      : "Copy the prompt, paste the AI JSON on the left, then review fields here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="qo-section-label">Snapshot</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <FieldStatus
                        label="Business"
                        value={draft.businessName}
                        tone={fieldTone(
                          "businessName",
                          draft.businessName.trim().length >= 2 &&
                            draft.businessName.trim().length <= 50,
                        )}
                      />
                      <FieldStatus
                        label="Owner"
                        value={
                          draft.ownerFullName.trim()
                            ? draft.ownerFullName
                            : "Optional — fill later"
                        }
                        tone={
                          draft.ownerFullName.trim().length >= 2
                            ? "ok"
                            : "neutral"
                        }
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
                      <FieldStatus
                        label="About"
                        value={
                          draft.about
                            ? draft.about.slice(0, 80) +
                              (draft.about.length > 80 ? "…" : "")
                            : "—"
                        }
                        tone={draft.about ? "ok" : "neutral"}
                      />
                      <FieldStatus
                        label="Media / social"
                        value={[
                          draft.photos?.length
                            ? `${draft.photos.length} photo(s)`
                            : "",
                          draft.website ? "Website" : "",
                          draft.instagramUrl ? "IG" : "",
                          draft.facebookUrl ? "FB" : "",
                          draft.mapsUrl ? "Maps" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        tone={
                          draft.photos?.length ||
                          draft.website ||
                          draft.instagramUrl ||
                          draft.facebookUrl ||
                          draft.mapsUrl
                            ? "ok"
                            : "neutral"
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <p className="qo-section-label md:col-span-2">Edit details</p>
                    <label className="space-y-1">
                      <span className="admin-label">
                        Owner full name{" "}
                        <span className="font-normal text-slate-400">
                          (optional)
                        </span>
                      </span>
                      <input
                        className="admin-input"
                        value={draft.ownerFullName}
                        onChange={(e) =>
                          patchDraft({ ownerFullName: e.target.value })
                        }
                        placeholder="Can be filled later on the profile"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="admin-label">Business name</span>
                      <input
                        className="admin-input"
                        value={draft.businessName}
                        maxLength={50}
                        onChange={(e) =>
                          patchDraft({ businessName: e.target.value.slice(0, 50) })
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
                      <span className="block text-[11px] leading-snug text-slate-400">
                        One language only. Hindi and English together will not be saved.
                      </span>
                    </label>
                    <div className="space-y-1 md:col-span-2">
                      <span className="admin-label">Categories</span>
                      <div className="rounded-lg border border-slate-200 bg-white">
                        <CategorySubcategoryPicker
                          categories={categories}
                          value={
                            draft.categoryMatched ? draft.resolvedCategory : ""
                          }
                          onChange={(value) => {
                            const labels = splitBusinessCategories(value);
                            const primary = primaryBusinessCategory(value);
                            const parts = primary.split(/\s*›\s*/);
                            patchDraft({
                              resolvedCategory: value,
                              category: parts[0] || primary,
                              subcategory: parts[1] || "",
                              categoryMatched: labels.length > 0,
                            });
                          }}
                        />
                      </div>
                      {!draft.categoryMatched && draft.category ? (
                        <p className="text-[11px] text-amber-700">
                          AI suggested:{" "}
                          {draft.subcategory
                            ? `${draft.category} › ${draft.subcategory}`
                            : draft.category}{" "}
                          — add matching FinderB categories above.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Map multiple categories so this partner shows in each
                          listing.
                        </p>
                      )}
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
                            mobile: extractIndianMobileDigits(e.target.value),
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
                            publicPhone: extractIndianMobileDigits(
                              e.target.value,
                            ),
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
                            ? "Will generate company-name-#####@finderb.com"
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

                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Profile extras
                      </p>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                        From Google / website
                      </span>
                    </div>

                    {(draft.photos?.length || 0) > 0 && (
                      <div className="space-y-1.5">
                        <span className="admin-label">
                          Photos ({draft.photos.length}/5)
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {draft.photos.map((url) => (
                            <div
                              key={url}
                              className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white"
                                onClick={() =>
                                  patchDraft({
                                    photos: draft.photos.filter((p) => p !== url),
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <label className="space-y-1 block">
                      <span className="admin-label">Description / about</span>
                      <textarea
                        className="admin-input min-h-[88px] resize-y"
                        value={draft.about}
                        onChange={(e) => patchDraft({ about: e.target.value })}
                        placeholder="Business description from Google"
                      />
                    </label>

                    <WorkingHoursEditor
                      value={draft.timings || emptyWeekTimings()}
                      onChange={(next) => patchDraft({ timings: next })}
                      onClear={() => patchDraft({ timings: null })}
                      heading="Working hours"
                    />

                    {draft.rating != null && (
                      <div className="qo-google-rating">
                        <div>
                          <span className="admin-label">Google rating</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Stored separately from FinderB reviews / rating
                          </p>
                        </div>
                        <div className="qo-google-rating-score">
                          <span className="qo-google-rating-star" aria-hidden>
                            ★
                          </span>
                          <span className="qo-google-rating-value">
                            {Number(draft.rating).toFixed(1)}
                          </span>
                          <span className="qo-google-rating-max">/ 5</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="admin-label">Website</span>
                        <input
                          className="admin-input"
                          value={draft.website}
                          onChange={(e) =>
                            patchDraft({ website: e.target.value })
                          }
                          placeholder="https://"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="admin-label">Google Maps link</span>
                        <input
                          className="admin-input"
                          value={draft.mapsUrl}
                          onChange={(e) =>
                            patchDraft({ mapsUrl: e.target.value })
                          }
                          placeholder="https://maps.google.com/…"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="admin-label">Instagram</span>
                        <input
                          className="admin-input"
                          value={draft.instagramUrl}
                          onChange={(e) =>
                            patchDraft({ instagramUrl: e.target.value })
                          }
                          placeholder="https://instagram.com/…"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="admin-label">Facebook</span>
                        <input
                          className="admin-input"
                          value={draft.facebookUrl}
                          onChange={(e) =>
                            patchDraft({ facebookUrl: e.target.value })
                          }
                          placeholder="https://facebook.com/…"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="admin-label">YouTube</span>
                        <input
                          className="admin-input"
                          value={draft.youtubeUrl}
                          onChange={(e) =>
                            patchDraft({ youtubeUrl: e.target.value })
                          }
                          placeholder="https://youtube.com/…"
                        />
                      </label>
                      <div className="space-y-1">
                        <span className="admin-label">Coordinates</span>
                        <p className="admin-input !bg-slate-50 text-[12px] text-slate-600">
                          {draft.latitude != null && draft.longitude != null
                            ? `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`
                            : "No coordinates"}
                        </p>
                      </div>
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

                  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                    <PaymentModesCheckboxes
                      idPrefix="qo-payment"
                      values={draft.paymentModes}
                      onChange={(paymentModes) => patchDraft({ paymentModes })}
                    />
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                      checked={draft.activateImmediately}
                      onChange={(e) =>
                        patchDraft({ activateImmediately: e.target.checked })
                      }
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-900">
                        Activate listing immediately
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
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
                      disabled={loading || !validation.ok || !canManage}
                      onClick={() => void createMerchant()}
                      className="admin-btn-primary !px-5 disabled:opacity-50"
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
