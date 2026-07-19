"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { City, Country, State } from "country-state-city";
import Image from "next/image";
import QRCode from "qrcode";
import { formatDateTimeInr } from "../lib/formatDateTime";
import {
  fetchMerchantAuditLogs,
  type MerchantAuditEntry,
} from "../lib/merchantAudit";
import {
  applyPlanPreset,
  collapsePlanExpiry,
  dateInputToIso,
  extendPlanExpiry,
  MERCHANT_PLAN_PRESETS,
  planLabel,
  resolvePlanPresetId,
  toDateInputValue,
} from "../lib/merchantPlanAdmin";
import { getBusinessProfileUrl } from "../lib/site";
import { isPlaceholderEmail } from "../lib/placeholderEmail";

export type MerchantBusinessRecord = {
  id: string;
  fullName: string;
  workEmail: string;
  mobile: string;
  owner_name: string | null;
  owner_mobile: string | null;
  businessName: string;
  category: string;
  location: string | null;
  publicPhone: string;
  businessAddress: string;
  selectedPlan: string;
  billingCycle: string;
  isVerified: boolean;
  registrationNumber: string | null;
  panNumber: string | null;
  aadharNumber: string | null;
  panUrl: string | null;
  aadharUrl: string | null;
  msmeGstUrl: string | null;
  cinNumber: string | null;
  bankIfsc: string | null;
  bankAccountNumber: string | null;
  upiId: string | null;
  razorpayContactId: string | null;
  razorpayFundAccountId: string | null;
  bankName: string | null;
  kycStatus: string;
  hasVerifiedBadge: boolean;
  paymentStatus: string;
  paymentId: string | null;
  orderId: string | null;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  razorpaySubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionCancelledAt: string | null;
  autoRenewEnabled: boolean;
  mandateStatus: string | null;
  createdAt: string;
  updatedAt: string;
  city: string | null;
  slug: string | null;
  email: string | null;
  state: string | null;
  country: string | null;
  status: string;
  images: string[] | null;
  profilePictureUrl: string | null;
  isFinderBVerified: boolean;
  about: string | null;
  discountRange: string | null;
  displayName: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  keywords: string[] | null;
  latitude: number | null;
  longitude: number | null;
  paymentModes: string[] | null;
  profileQrLink: string | null;
  rating: number | null;
  serviceCategory: string | null;
  timings: unknown;
  website: string | null;
  whatsappNumber: string | null;
  yearsInBusiness: number | null;
  youtubeUrl: string | null;
  review: unknown;
  reviewReply: unknown;
  password?: string | null;
};

type MerchantDetailModalProps = {
  business: MerchantBusinessRecord;
  categories: string[];
  canManage: boolean;
  canViewFinancialData: boolean;
  isUploading: string | null;
  uploadProgress?: { current: number; total: number } | null;
  onClose: () => void;
  onSave: (updates: Partial<MerchantBusinessRecord>) => Promise<void>;
  onChangePlan: (updates: Partial<MerchantBusinessRecord>) => Promise<void>;
  onAdjustExpiry: (planExpiresAt: string | null) => Promise<void>;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
  onToggleStatus: () => void;
  onToggleFinderBVerified: () => void;
  onImageUpload: (files: File[]) => Promise<void>;
  onDeleteImage: (url: string) => Promise<void>;
  onSetProfilePicture: (url: string) => Promise<void>;
  onReorderImages?: (urls: string[]) => Promise<void>;
  setIsUploading: (value: string | null) => void;
  loginPasswordDisplay?: string | null;
  hasStoredPassword?: boolean;
  onRevealLoginPassword?: () => void;
  onHideLoginPassword?: () => void;
};

type TabId = "overview" | "business" | "kyc" | "billing" | "gallery" | "audit";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "business", label: "Business" },
  { id: "kyc", label: "KYC" },
  { id: "billing", label: "Billing" },
  { id: "gallery", label: "Gallery" },
  { id: "audit", label: "Audit" },
];

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayHours = { isClosed: boolean; open: string; close: string };
type WeekTimings = Record<(typeof WEEKDAYS)[number], DayHours>;

const DEFAULT_DAY: DayHours = {
  isClosed: false,
  open: "09:00",
  close: "18:00",
};

const PAYMENT_MODE_OPTIONS = [
  "Cash",
  "UPI",
  "Debit Card",
  "Credit Card",
  "Net Banking",
  "Wallets",
  "Cheque",
  "EMI",
];

const DISCOUNT_OPTIONS = [
  "Up to 10%",
  "10% - 20%",
  "20% - 30%",
  "30% - 40%",
  "40% - 50%",
  "50% +",
];

/* ---------- formatters ---------- */

function splitList(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

function normalizeTimings(timings: unknown): WeekTimings {
  const source =
    timings && typeof timings === "object"
      ? (timings as Record<string, unknown>)
      : {};

  return WEEKDAYS.reduce((acc, day) => {
    const slot = source[day];
    if (!slot || slot === "Closed") {
      acc[day] = { isClosed: true, open: "09:00", close: "18:00" };
      return acc;
    }
    if (typeof slot === "string") {
      const match = slot.match(
        /(\d{1,2}:\d{2})\s*[–\-—to]+\s*(\d{1,2}:\d{2})/i,
      );
      if (match) {
        acc[day] = { isClosed: false, open: match[1], close: match[2] };
      } else {
        acc[day] = { ...DEFAULT_DAY };
      }
      return acc;
    }
    if (typeof slot === "object" && slot !== null) {
      const parsed = slot as {
        isClosed?: boolean;
        open?: string;
        close?: string;
      };
      acc[day] = {
        isClosed: Boolean(parsed.isClosed),
        open: parsed.open || "09:00",
        close: parsed.close || "18:00",
      };
      return acc;
    }
    acc[day] = { ...DEFAULT_DAY };
    return acc;
  }, {} as WeekTimings);
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return digits > 0 ? value.toFixed(digits) : String(value);
}

function formatCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng))
    return "—";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function googleMapsLink(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng))
    return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function formatTimings(timings: unknown): string {
  if (!timings || typeof timings !== "object") return "—";
  return WEEKDAYS.map((day) => {
    const slot = normalizeTimings(timings)[day];
    if (slot.isClosed) return `${day}: Closed`;
    return `${day}: ${slot.open} – ${slot.close}`;
  }).join("\n");
}

type MerchantReview = {
  id?: string;
  date?: string;
  author?: string;
  rating?: number;
  content?: string;
  merchantReply?: { date?: string; content?: string };
};

function parseReviews(review: unknown): MerchantReview[] {
  if (!Array.isArray(review)) return [];
  return review.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const reply =
      source.merchantReply && typeof source.merchantReply === "object"
        ? (source.merchantReply as Record<string, unknown>)
        : null;
    const rating = Number(source.rating);
    return [
      {
        id: typeof source.id === "string" ? source.id : undefined,
        date: typeof source.date === "string" ? source.date : undefined,
        author: typeof source.author === "string" ? source.author : undefined,
        rating: Number.isFinite(rating) ? rating : undefined,
        content:
          typeof source.content === "string" ? source.content : undefined,
        merchantReply: reply
          ? {
              date: typeof reply.date === "string" ? reply.date : undefined,
              content:
                typeof reply.content === "string" ? reply.content : undefined,
            }
          : undefined,
      },
    ];
  });
}

function formatReviewReply(reviewReply: unknown): string {
  if (!reviewReply) return "—";
  if (typeof reviewReply === "string") return reviewReply.trim() || "—";
  if (
    typeof reviewReply === "object" &&
    reviewReply !== null &&
    "content" in reviewReply
  ) {
    const content = (reviewReply as { content?: string }).content;
    return content?.trim() || "—";
  }
  return "—";
}

/* ---------- compact building blocks ---------- */

/** True while the modal is in edit mode — lets read-only rows explain themselves. */
const EditModeContext = createContext(false);

function LockedHint({ children }: { children: ReactNode }) {
  const editing = useContext(EditModeContext);
  if (!editing) return <>{children}</>;
  return (
    <div
      tabIndex={0}
      className="group relative cursor-not-allowed outline-none focus:bg-slate-50"
    >
      {children}
      <span className="pointer-events-none absolute right-3 -top-2 z-10 hidden group-hover:inline-flex group-focus:inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        You&apos;re not allowed to edit this info
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] font-medium text-slate-500 mb-1.5 px-0.5">
        {title}
      </h4>
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <LockedHint>
      <div className="flex items-start justify-between gap-4 px-3 py-2">
        <span className="text-xs text-slate-500 shrink-0">{label}</span>
        <span
          className={`text-xs text-slate-900 text-right break-all ${mono ? "font-mono" : "font-medium"}`}
        >
          {value?.trim() ? value : "—"}
        </span>
      </div>
    </LockedHint>
  );
}

function BlockRow({ label, value }: { label: string; value: string }) {
  return (
    <LockedHint>
      <div className="px-3 py-2 space-y-0.5">
        <span className="text-xs text-slate-500">{label}</span>
        <p className="text-xs font-medium text-slate-900 whitespace-pre-wrap break-words">
          {value || "—"}
        </p>
      </div>
    </LockedHint>
  );
}

function LinkRow({
  label,
  href,
  text,
}: {
  label: string;
  href: string | null | undefined;
  text?: string;
}) {
  const trimmed = href?.trim();
  if (!trimmed) return <Row label={label} value={null} />;
  return (
    <LockedHint>
      <div className="flex items-start justify-between gap-4 px-3 py-2">
        <span className="text-xs text-slate-500 shrink-0">{label}</span>
        <a
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-teal-700 hover:underline text-right break-all"
        >
          {text ?? trimmed}
        </a>
      </div>
    </LockedHint>
  );
}

function ProfileQr({
  profileUrl,
  businessName,
}: {
  profileUrl: string;
  businessName: string;
}) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(profileUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((value) => {
        if (active) setDataUrl(value);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });

    return () => {
      active = false;
    };
  }, [profileUrl]);

  const filename = `${businessName || "merchant"}-profile-qr`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-xs text-slate-500 shrink-0">Profile QR</span>
      <div className="flex flex-col items-end gap-2">
        {dataUrl ? (
          <Image
            src={dataUrl}
            alt={`QR code for ${businessName}`}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-md border border-slate-200 bg-white p-1"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[10px] text-slate-400">
            Generating…
          </div>
        )}
        <div className="flex items-center gap-3">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-link"
          >
            Open profile
          </a>
          {dataUrl && (
            <a
              href={dataUrl}
              download={`${filename || "merchant-profile-qr"}.png`}
              className="admin-link"
            >
              Download QR
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  editing,
  type = "text",
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  editing: boolean;
  type?: "text" | "email" | "textarea" | "select" | "number" | "url";
  options?: string[];
  hint?: string;
}) {
  if (!editing) {
    if (type === "textarea") return <BlockRow label={label} value={value} />;
    if (type === "url" && value.trim()) {
      return <LinkRow label={label} href={value} />;
    }
    return <Row label={label} value={value} />;
  }

  const inputClass =
    "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40";

  if (type === "textarea") {
    return (
      <div className="px-3 py-2 space-y-1">
        <label className="text-xs text-slate-500">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          rows={4}
          className={inputClass}
        />
        {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5">
      <label className="text-xs text-slate-500 shrink-0">{label}</label>
      <div className="w-56 max-w-[62%]">
        {type === "select" && options ? (
          <select
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className={inputClass}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type === "number" ? "number" : type}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className={inputClass}
          />
        )}
        {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function TagsRow({
  label,
  values,
}: {
  label: string;
  values: string[] | null | undefined;
}) {
  return (
    <div className="px-3 py-2 space-y-1">
      <span className="text-xs text-slate-500">{label}</span>
      {values?.length ? (
        <div className="flex flex-wrap gap-1">
          {values.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium text-teal-800"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs font-medium text-slate-900">—</p>
      )}
    </div>
  );
}

function TagListEditor({
  label,
  values,
  onChange,
  placeholder = "Type a value, press Enter",
  hint,
}: {
  label: string;
  values: string[] | null;
  onChange: (next: string[] | null) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [input, setInput] = useState("");
  const tags = values ?? [];

  const addFromInput = () => {
    const items = input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && !tags.includes(item));
    if (items.length) onChange([...tags, ...items]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((item) => item !== tag);
    onChange(next.length ? next : null);
  };

  return (
    <div className="px-3 py-2 space-y-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 pl-1.5 pr-1 py-0.5 text-[11px] font-medium text-teal-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded p-0.5 text-teal-600 hover:bg-teal-100 hover:text-teal-900"
                aria-label={`Remove ${tag}`}
              >
                <svg
                  className="w-2.5 h-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addFromInput();
          } else if (e.key === "Backspace" && !input && tags.length) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        onBlur={addFromInput}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
      />
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  // Keep a stored value selectable even if it's not in the option list.
  const allOptions =
    value && !options.includes(value) ? [value, ...options] : options;

  return (
    <div className="flex items-center justify-between gap-4 px-3 py-1.5">
      <label className="text-xs text-slate-500 shrink-0">{label}</label>
      <div className="w-56 max-w-[62%]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
        >
          <option value="">{placeholder}</option>
          {allOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LocationSelects({
  city,
  state,
  country,
  onPatch,
}: {
  city: string | null;
  state: string | null;
  country: string | null;
  onPatch: (patch: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
  }) => void;
}) {
  const countries = useMemo(() => Country.getAllCountries(), []);
  const countryCode = useMemo(
    () => countries.find((c) => c.name === (country || "India"))?.isoCode,
    [countries, country],
  );
  const states = useMemo(
    () => (countryCode ? State.getStatesOfCountry(countryCode) : []),
    [countryCode],
  );
  const stateCode = useMemo(
    () => states.find((s) => s.name === state)?.isoCode,
    [states, state],
  );
  const cities = useMemo(
    () =>
      countryCode && stateCode
        ? City.getCitiesOfState(countryCode, stateCode)
        : [],
    [countryCode, stateCode],
  );

  return (
    <>
      <SelectRow
        label="Country"
        value={country || ""}
        options={countries.map((c) => c.name)}
        placeholder="Select country"
        onChange={(v) =>
          onPatch({ country: v || null, state: null, city: null })
        }
      />
      <SelectRow
        label="State"
        value={state || ""}
        options={states.map((s) => s.name)}
        placeholder={country ? "Select state" : "Select country first"}
        onChange={(v) => onPatch({ state: v || null, city: null })}
      />
      <SelectRow
        label="City"
        value={city || ""}
        options={cities.map((c) => c.name)}
        placeholder={state ? "Select city" : "Select state first"}
        onChange={(v) => onPatch({ city: v || null })}
      />
    </>
  );
}

function PaymentModesEditor({
  values,
  onChange,
}: {
  values: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const selected = values ?? [];
  // Preserve any legacy values not in the preset list.
  const options = [
    ...PAYMENT_MODE_OPTIONS,
    ...selected.filter((v) => !PAYMENT_MODE_OPTIONS.includes(v)),
  ];

  const toggle = (mode: string) => {
    const next = selected.includes(mode)
      ? selected.filter((item) => item !== mode)
      : [...selected, mode];
    onChange(next.length ? next : null);
  };

  return (
    <div className="px-3 py-2 space-y-1.5">
      <span className="text-xs text-slate-500">Payment modes</span>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {options.map((mode) => (
          <label
            key={mode}
            className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(mode)}
              onChange={() => toggle(mode)}
              className="h-3.5 w-3.5 rounded border-slate-300 accent-teal-600"
            />
            {mode}
          </label>
        ))}
      </div>
    </div>
  );
}

function TimingsEditor({
  value,
  editing,
  onChange,
}: {
  value: unknown;
  editing: boolean;
  onChange: (next: WeekTimings) => void;
}) {
  const timings = normalizeTimings(value);

  if (!editing) {
    return <BlockRow label="Business hours" value={formatTimings(value)} />;
  }

  const patchDay = (
    day: (typeof WEEKDAYS)[number],
    patch: Partial<DayHours>,
  ) => {
    onChange({
      ...timings,
      [day]: { ...timings[day], ...patch },
    });
  };

  const applyWeekdays = () => {
    const template = timings.Monday;
    onChange({
      ...timings,
      Tuesday: { ...template },
      Wednesday: { ...template },
      Thursday: { ...template },
      Friday: { ...template },
    });
  };

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Business hours</span>
        <button
          type="button"
          onClick={applyWeekdays}
          className="text-[10px] font-medium text-teal-700 hover:underline"
        >
          Copy Mon → Fri
        </button>
      </div>
      <div className="space-y-1.5">
        {WEEKDAYS.map((day) => {
          const slot = timings[day];
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-2 py-1.5"
            >
              <span className="w-16 text-[11px] font-medium text-slate-700">
                {day.slice(0, 3)}
              </span>
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={slot.isClosed}
                  onChange={(e) =>
                    patchDay(day, { isClosed: e.target.checked })
                  }
                  className="rounded border-slate-300"
                />
                Closed
              </label>
              {!slot.isClosed && (
                <>
                  <input
                    type="time"
                    value={slot.open}
                    onChange={(e) => patchDay(day, { open: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-900"
                  />
                  <span className="text-[11px] text-slate-400">to</span>
                  <input
                    type="time"
                    value={slot.close}
                    onChange={(e) => patchDay(day, { close: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-900"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  const cls = {
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    primary: "bg-teal-50 text-teal-800 border-teal-100",
  }[tone];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function statusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  const s = (status || "").toLowerCase();
  if (["active", "completed", "approved"].includes(s)) return "success";
  if (["pending"].includes(s)) return "warning";
  if (["failed", "rejected", "inactive"].includes(s)) return "danger";
  return "neutral";
}

/* ---------- modal ---------- */

export default function MerchantDetailModal({
  business,
  categories,
  canManage,
  canViewFinancialData,
  isUploading,
  uploadProgress,
  onClose,
  onSave,
  onChangePlan,
  onAdjustExpiry,
  onDelete,
  onApprove,
  onReject,
  onToggleStatus,
  onToggleFinderBVerified,
  onImageUpload,
  onDeleteImage,
  onSetProfilePicture,
  onReorderImages,
  loginPasswordDisplay,
  hasStoredPassword,
  onRevealLoginPassword,
  onHideLoginPassword,
}: MerchantDetailModalProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingExpiry, setIsSavingExpiry] = useState(false);
  const [mapLink, setMapLink] = useState(() =>
    googleMapsLink(business.latitude, business.longitude),
  );
  const [isReadingMapLink, setIsReadingMapLink] = useState(false);
  const [mapLinkError, setMapLinkError] = useState("");
  const [draft, setDraft] = useState(business);
  const [planExpiresInput, setPlanExpiresInput] = useState(
    toDateInputValue(business.planExpiresAt),
  );
  const [planPresetId, setPlanPresetId] = useState(
    resolvePlanPresetId(business.selectedPlan, business.billingCycle),
  );
  const [auditLogs, setAuditLogs] = useState<MerchantAuditEntry[]>([]);
  const [auditError, setAuditError] = useState("");
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(
    null,
  );
  const visibleTabs = canViewFinancialData
    ? TABS
    : TABS.filter((item) => item.id !== "billing");
  const visibleAuditLogs = canViewFinancialData
    ? auditLogs
    : auditLogs.filter(
        (entry) =>
          !entry.action.startsWith("subscription.") &&
          !entry.action.startsWith("payment."),
      );

  // Block background scrolling while the modal is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setDraft(business);
    setPlanExpiresInput(toDateInputValue(business.planExpiresAt));
    setPlanPresetId(
      resolvePlanPresetId(business.selectedPlan, business.billingCycle),
    );
    setMapLink(googleMapsLink(business.latitude, business.longitude));
    setMapLinkError("");
    setIsEditing(false);
    // A same-merchant refresh must preserve active edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  useEffect(() => {
    setDraft((previous) => ({
      ...previous,
      images: business.images,
      profilePictureUrl: business.profilePictureUrl,
      profileQrLink: business.profileQrLink,
      selectedPlan: business.selectedPlan,
      billingCycle: business.billingCycle,
      planStartedAt: business.planStartedAt,
      planExpiresAt: business.planExpiresAt,
      paymentStatus: business.paymentStatus,
      isFinderBVerified: business.isFinderBVerified,
      kycStatus: business.kycStatus,
      updatedAt: business.updatedAt,
      ...(!isEditing ? { status: business.status } : {}),
    }));
  }, [
    business.images,
    business.profilePictureUrl,
    business.profileQrLink,
    business.selectedPlan,
    business.billingCycle,
    business.planStartedAt,
    business.planExpiresAt,
    business.paymentStatus,
    business.isFinderBVerified,
    business.kycStatus,
    business.updatedAt,
    business.status,
    isEditing,
  ]);

  useEffect(() => {
    setPlanExpiresInput(toDateInputValue(business.planExpiresAt));
    setPlanPresetId(
      resolvePlanPresetId(business.selectedPlan, business.billingCycle),
    );
  }, [business.planExpiresAt, business.selectedPlan, business.billingCycle]);

  useEffect(() => {
    if (tab !== "audit") return;
    let active = true;
    setIsLoadingAudit(true);
    setAuditError("");
    fetchMerchantAuditLogs(business.id)
      .then((logs) => {
        if (active) setAuditLogs(logs);
      })
      .catch(() => {
        if (active) setAuditError("Could not load audit history.");
      })
      .finally(() => {
        if (active) setIsLoadingAudit(false);
      });
    return () => {
      active = false;
    };
  }, [tab, business.id]);

  const patchDraft = (updates: Partial<MerchantBusinessRecord>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const expiryIso = useMemo(
    () => dateInputToIso(planExpiresInput),
    [planExpiresInput],
  );
  const isExpiryDirty = expiryIso !== business.planExpiresAt;
  const currentPlanPresetId = resolvePlanPresetId(
    business.selectedPlan,
    business.billingCycle,
  );
  const isStarterPlan = currentPlanPresetId === "starter";
  const isPlanDirty = planPresetId !== currentPlanPresetId;
  const isDirty = useMemo(() => {
    const editableFields = [
      "fullName",
      "owner_name",
      "owner_mobile",
      "businessName",
      "displayName",
      "workEmail",
      "mobile",
      "publicPhone",
      "whatsappNumber",
      "category",
      "serviceCategory",
      "city",
      "state",
      "country",
      "location",
      "businessAddress",
      "latitude",
      "longitude",
      "status",
      "about",
      "keywords",
      "discountRange",
      "yearsInBusiness",
      "website",
      "instagramUrl",
      "facebookUrl",
      "youtubeUrl",
      "paymentModes",
      "timings",
    ] as const;
    return editableFields.some(
      (field) =>
        JSON.stringify(draft[field]) !== JSON.stringify(business[field]),
    );
  }, [business, draft]);

  const handlePlanChange = async () => {
    const preset = MERCHANT_PLAN_PRESETS.find(
      (item) => item.id === planPresetId,
    );
    if (!preset) return;

    setIsSavingPlan(true);
    try {
      const updates = applyPlanPreset(preset, {
        planStartedAt: business.planStartedAt,
        planExpiresAt: business.planExpiresAt,
      });
      await onChangePlan(updates);
    } catch {
      // Parent toasts errors.
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        fullName: draft.fullName,
        owner_name: draft.owner_name,
        owner_mobile: draft.owner_mobile,
        businessName: draft.businessName,
        displayName: draft.displayName,
        workEmail: draft.workEmail,
        mobile: draft.mobile,
        publicPhone: draft.publicPhone,
        whatsappNumber: draft.whatsappNumber,
        category: draft.category,
        serviceCategory: draft.serviceCategory,
        city: draft.city,
        state: draft.state,
        country: draft.country,
        location: draft.location,
        businessAddress: draft.businessAddress,
        latitude: draft.latitude,
        longitude: draft.longitude,
        status: draft.status,
        about: draft.about,
        keywords: draft.keywords,
        discountRange: draft.discountRange,
        yearsInBusiness: draft.yearsInBusiness,
        website: draft.website,
        instagramUrl: draft.instagramUrl,
        facebookUrl: draft.facebookUrl,
        youtubeUrl: draft.youtubeUrl,
        paymentModes: draft.paymentModes,
        timings: normalizeTimings(draft.timings),
        profileQrLink: getBusinessProfileUrl({
          id: draft.id,
          businessName: draft.businessName,
          slug: draft.slug,
          city: draft.city,
        }),
      });
      setIsEditing(false);
    } catch {
      // Parent handlers toast the error; stay in edit mode.
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapLink = async (url = mapLink) => {
    if (!url.trim()) {
      setMapLinkError("Paste a Google Maps link.");
      return;
    }

    setIsReadingMapLink(true);
    setMapLinkError("");
    try {
      const response = await fetch("/api/maps/coordinates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const result = (await response.json()) as {
        success: boolean;
        latitude?: number;
        longitude?: number;
        error?: string;
      };

      if (
        !response.ok ||
        !result.success ||
        result.latitude == null ||
        result.longitude == null
      ) {
        setMapLinkError(result.error || "Could not extract coordinates.");
        return;
      }

      patchDraft({
        latitude: result.latitude,
        longitude: result.longitude,
      });
    } catch {
      setMapLinkError("Could not read this Google Maps link.");
    } finally {
      setIsReadingMapLink(false);
    }
  };

  const resetDraft = () => {
    setDraft(business);
    setMapLink(googleMapsLink(business.latitude, business.longitude));
    setMapLinkError("");
    setIsEditing(false);
  };

  const extractMapLinkIfUrl = (value: string) => {
    if (/^https?:\/\/\S+$/i.test(value.trim())) void handleMapLink(value);
  };

  const handleReorderImages = async (fromIndex: number, toIndex: number) => {
    if (!onReorderImages || fromIndex === toIndex) return;
    const images = [...(display.images ?? [])];
    const [moved] = images.splice(fromIndex, 1);
    images.splice(toIndex, 0, moved);
    await onReorderImages(images);
  };

  const shiftExpiry = (
    direction: "extend" | "collapse",
    unit: "month" | "year",
  ) => {
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
    } catch {
      // Parent toasts errors.
    } finally {
      setIsSavingExpiry(false);
    }
  };

  const categoryOptions =
    categories.length > 0 ? categories : [draft.category || "Other"];
  const display = isEditing ? draft : business;
  const editable = isEditing && canManage;
  const reviews = useMemo(() => parseReviews(display.review), [display.review]);
  const defaultReviewReply = formatReviewReply(display.reviewReply);

  return (
    <EditModeContext.Provider value={editable}>
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-4 pb-0 border-b border-slate-200 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {display.profilePictureUrl ? (
                  <img
                    src={display.profilePictureUrl}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center text-base font-semibold shrink-0">
                    {(display.businessName || display.fullName || "?").charAt(
                      0,
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-900 truncate">
                      {display.businessName || display.fullName}
                    </h2>
                    {display.isFinderBVerified && (
                      <Chip tone="success">Verified</Chip>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-500">
                      {display.registrationNumber || display.id}
                    </span>
                    <a
                      href={getBusinessProfileUrl({
                        id: display.id,
                        businessName: display.businessName,
                        slug: display.slug,
                        city: display.city,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-teal-700 hover:underline"
                    >
                      Public profile ↗
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Chip tone={statusTone(display.status)}>
                      Listing {display.status || "Inactive"}
                    </Chip>
                    <Chip tone="neutral">
                      KYC {display.kycStatus || "pending"}
                    </Chip>
                    {isPlaceholderEmail(display.email) && (
                      <Chip tone="warning">Email missing</Chip>
                    )}
                    {canViewFinancialData && (
                      <>
                        <Chip tone={statusTone(display.paymentStatus)}>
                          Pay {formatStatusLabel(display.paymentStatus)}
                        </Chip>
                        <Chip tone="primary">
                          {planLabel(
                            display.selectedPlan,
                            display.billingCycle,
                          )}
                        </Chip>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManage &&
                  (isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="admin-btn-secondary !text-xs !py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className="admin-btn-primary !text-xs !py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="admin-btn-secondary !text-xs !py-1.5"
                    >
                      Edit
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={onClose}
                  className="admin-btn-ghost !p-1.5"
                  aria-label="Close"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <nav className="flex gap-1 mt-3 -mb-px">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? "border-teal-600 text-teal-800"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/50">
            {tab === "overview" && (
              <>
                {(canManage || display.isFinderBVerified) && (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        FinderB Verified badge
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Green badge on the public listing. Independent of KYC.
                      </p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={onToggleFinderBVerified}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${display.isFinderBVerified ? "bg-emerald-500" : "bg-slate-300"}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition ${display.isFinderBVerified ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    ) : (
                      <Chip tone="success">Active</Chip>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <Section title="Contact">
                    <Field
                      label="Business name"
                      value={display.businessName || ""}
                      editing={editable}
                      onChange={(v) => patchDraft({ businessName: v })}
                    />
                    <Field
                      label="Display name"
                      value={display.displayName || ""}
                      editing={editable}
                      onChange={(v) => patchDraft({ displayName: v || null })}
                    />
                    <Field
                      label="Owner"
                      value={display.fullName || ""}
                      editing={editable}
                      onChange={(v) =>
                        patchDraft({ fullName: v, owner_name: v || null })
                      }
                    />
                    <Field
                      label="Work email"
                      value={display.workEmail || ""}
                      editing={editable}
                      type="email"
                      onChange={(v) => patchDraft({ workEmail: v })}
                    />
                    {/* Login email is the merchant's credential — never editable. */}
                    <Row
                      label="Login email"
                      value={
                        isPlaceholderEmail(display.email)
                          ? `${display.email} (placeholder — real email missing)`
                          : display.email
                      }
                    />
                    <Field
                      label="Owner mobile"
                      value={display.mobile || ""}
                      editing={editable}
                      onChange={(v) =>
                        patchDraft({ mobile: v, owner_mobile: v || null })
                      }
                    />
                    <Field
                      label="Public phone"
                      value={display.publicPhone || ""}
                      editing={editable}
                      onChange={(v) => patchDraft({ publicPhone: v })}
                    />
                    <Field
                      label="WhatsApp"
                      value={display.whatsappNumber || ""}
                      editing={editable}
                      onChange={(v) =>
                        patchDraft({ whatsappNumber: v || null })
                      }
                    />
                  </Section>

                  <Section title="Listing">
                    <Field
                      label="Category"
                      value={display.category || ""}
                      editing={editable}
                      type="select"
                      options={categoryOptions}
                      onChange={(v) => patchDraft({ category: v })}
                    />
                    {editable ? (
                      <TagListEditor
                        label="Service categories"
                        values={splitList(display.serviceCategory)}
                        onChange={(next) =>
                          patchDraft({
                            serviceCategory: next ? next.join(", ") : null,
                          })
                        }
                        placeholder="Type a category, press Enter"
                        hint="Shown on the public listing"
                      />
                    ) : (
                      <TagsRow
                        label="Service categories"
                        values={splitList(display.serviceCategory)}
                      />
                    )}
                    <Field
                      label="Listing status"
                      value={display.status || "Inactive"}
                      editing={editable}
                      type="select"
                      options={["Active", "Inactive", "Pending", "Rejected"]}
                      onChange={(v) => patchDraft({ status: v })}
                      hint="Controls public profile visibility"
                    />
                    <Row
                      label="KYC status"
                      value={`${display.kycStatus || "pending"} (verification system not live)`}
                    />
                    <Row
                      label="Rating"
                      value={formatNumber(display.rating, 1)}
                    />
                    <Row
                      label="Joined"
                      value={formatDateTimeInr(display.createdAt)}
                    />
                    <Row
                      label="Updated"
                      value={formatDateTimeInr(display.updatedAt)}
                    />
                  </Section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <Section title="Location">
                    {editable ? (
                      <LocationSelects
                        city={display.city}
                        state={display.state}
                        country={display.country}
                        onPatch={(patch) => patchDraft(patch)}
                      />
                    ) : (
                      <>
                        <Row label="City" value={display.city} />
                        <Row label="State" value={display.state} />
                        <Row label="Country" value={display.country} />
                      </>
                    )}
                    <Field
                      label="Location label"
                      value={display.location || ""}
                      editing={editable}
                      onChange={(v) => patchDraft({ location: v })}
                    />
                    {editable ? (
                      <div className="px-3 py-2 space-y-1.5">
                        <label className="text-xs text-slate-500">
                          Google Maps link
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={mapLink}
                            onChange={(e) => {
                              setMapLink(e.target.value);
                              setMapLinkError("");
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData
                                .getData("text")
                                .trim();
                              if (pasted) {
                                window.setTimeout(
                                  () => extractMapLinkIfUrl(pasted),
                                  100,
                                );
                              }
                            }}
                            onBlur={(e) =>
                              extractMapLinkIfUrl(e.currentTarget.value)
                            }
                            placeholder="Paste Share → Copy link"
                            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
                          />
                        </div>
                        {isReadingMapLink && (
                          <p className="text-[10px] text-slate-500">
                            Reading location…
                          </p>
                        )}
                        {mapLinkError ? (
                          <p className="text-[10px] text-rose-600">
                            {mapLinkError}
                          </p>
                        ) : display.latitude != null &&
                          display.longitude != null ? (
                          <p className="text-[10px] text-emerald-700">
                            Location extracted:{" "}
                            {formatCoords(display.latitude, display.longitude)}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400">
                            Open the exact place or dropped pin in Google Maps,
                            then copy its share link.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <LinkRow
                          label="Google Maps link"
                          href={googleMapsLink(
                            display.latitude,
                            display.longitude,
                          )}
                        />
                        <Row
                          label="Coordinates"
                          value={formatCoords(
                            display.latitude,
                            display.longitude,
                          )}
                          mono
                        />
                      </>
                    )}
                    <Field
                      label="Address"
                      value={display.businessAddress || ""}
                      editing={editable}
                      type="textarea"
                      onChange={(v) => patchDraft({ businessAddress: v })}
                    />
                  </Section>

                  <Section title="Identifiers">
                    <Row
                      label="Merchant ID"
                      value={display.registrationNumber}
                      mono
                    />
                    <Row label="Internal ID" value={display.id} mono />
                    <Row label="URL slug" value={display.slug} mono />
                    <ProfileQr
                      profileUrl={getBusinessProfileUrl({
                        id: display.id,
                        businessName: display.businessName,
                        slug: display.slug,
                        city: display.city,
                      })}
                      businessName={display.businessName}
                    />
                    {canManage && hasStoredPassword && (
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="text-xs text-slate-500 shrink-0">
                          Login password
                        </span>
                        <span className="text-xs font-mono text-slate-900 flex-1 text-right break-all">
                          {loginPasswordDisplay || "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={
                            loginPasswordDisplay
                              ? onHideLoginPassword
                              : onRevealLoginPassword
                          }
                          className="admin-link shrink-0"
                        >
                          {loginPasswordDisplay ? "Hide" : "Reveal"}
                        </button>
                      </div>
                    )}
                  </Section>
                </div>
              </>
            )}

            {tab === "business" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <Section title="Brand & content">
                    <Field
                      label="About"
                      value={display.about || ""}
                      editing={editable}
                      type="textarea"
                      onChange={(v) => patchDraft({ about: v || null })}
                    />
                    {editable ? (
                      <TagListEditor
                        label="Keywords"
                        values={display.keywords}
                        onChange={(next) => patchDraft({ keywords: next })}
                        placeholder="Type a keyword, press Enter"
                      />
                    ) : (
                      <TagsRow label="Keywords" values={display.keywords} />
                    )}
                    {editable ? (
                      <div className="flex items-center justify-between gap-4 px-3 py-1.5">
                        <label className="text-xs text-slate-500 shrink-0">
                          Discount offer
                        </label>
                        <div className="w-56 max-w-[62%]">
                          <select
                            value={display.discountRange || ""}
                            onChange={(e) =>
                              patchDraft({
                                discountRange: e.target.value || null,
                              })
                            }
                            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
                          >
                            <option value="">No discount</option>
                            {/* Keep a legacy value selectable if it's not a preset */}
                            {display.discountRange &&
                              !DISCOUNT_OPTIONS.includes(
                                display.discountRange,
                              ) && (
                                <option value={display.discountRange}>
                                  {display.discountRange}
                                </option>
                              )}
                            {DISCOUNT_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <Row
                        label="Discount offer"
                        value={display.discountRange}
                      />
                    )}
                    <Field
                      label="Year established"
                      value={
                        display.yearsInBusiness != null
                          ? String(display.yearsInBusiness)
                          : ""
                      }
                      editing={editable}
                      type="number"
                      onChange={(v) =>
                        patchDraft({
                          yearsInBusiness:
                            v.trim() === "" || Number.isNaN(Number(v))
                              ? null
                              : Number(v),
                        })
                      }
                    />
                    <div className="px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Reviews</span>
                        <span className="text-xs font-medium text-slate-900">
                          {reviews.length} review
                          {reviews.length === 1 ? "" : "s"}
                          {reviews.filter((review) => review.rating != null)
                            .length > 0 &&
                            ` · avg ${(reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) / reviews.filter((review) => review.rating != null).length).toFixed(1)}`}
                        </span>
                      </div>
                      {reviews.length ? (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                          {reviews.map((review, index) => (
                            <div
                              key={
                                review.id ??
                                `${review.author ?? "review"}-${index}`
                              }
                              className="rounded-md border border-slate-100 bg-slate-50 p-2"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-medium text-slate-800">
                                  {review.author || "Anonymous"}
                                  {review.rating != null &&
                                    ` · ${review.rating}/5`}
                                </span>
                                {review.date && (
                                  <span className="text-slate-400">
                                    {formatDateTimeInr(review.date)}
                                  </span>
                                )}
                              </div>
                              {review.content && (
                                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">
                                  {review.content}
                                </p>
                              )}
                              {review.merchantReply?.content && (
                                <div className="mt-2 border-l-2 border-teal-200 pl-2">
                                  <p className="text-[10px] font-medium text-teal-800">
                                    Merchant reply
                                    {review.merchantReply.date &&
                                      ` · ${formatDateTimeInr(review.merchantReply.date)}`}
                                  </p>
                                  <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                    {review.merchantReply.content}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-slate-900">
                          No reviews
                        </p>
                      )}
                    </div>
                    {defaultReviewReply !== "—" && (
                      <BlockRow
                        label="Default reply"
                        value={defaultReviewReply}
                      />
                    )}
                  </Section>

                  <div className="space-y-4">
                    <Section title="Social & web">
                      <Field
                        label="Website"
                        value={display.website || ""}
                        editing={editable}
                        type="url"
                        onChange={(v) => patchDraft({ website: v || null })}
                      />
                      <Field
                        label="Instagram"
                        value={display.instagramUrl || ""}
                        editing={editable}
                        type="url"
                        onChange={(v) =>
                          patchDraft({ instagramUrl: v || null })
                        }
                      />
                      <Field
                        label="Facebook"
                        value={display.facebookUrl || ""}
                        editing={editable}
                        type="url"
                        onChange={(v) => patchDraft({ facebookUrl: v || null })}
                      />
                      <Field
                        label="YouTube"
                        value={display.youtubeUrl || ""}
                        editing={editable}
                        type="url"
                        onChange={(v) => patchDraft({ youtubeUrl: v || null })}
                      />
                    </Section>
                    <Section title="Operations">
                      {editable ? (
                        <PaymentModesEditor
                          values={display.paymentModes}
                          onChange={(next) =>
                            patchDraft({ paymentModes: next })
                          }
                        />
                      ) : (
                        <TagsRow
                          label="Payment modes"
                          values={display.paymentModes}
                        />
                      )}
                      <TimingsEditor
                        value={display.timings}
                        editing={editable}
                        onChange={(next) => patchDraft({ timings: next })}
                      />
                    </Section>
                  </div>
                </div>
              </>
            )}

            {tab === "kyc" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <Section title="KYC documents">
                    <Row label="PAN number" value={display.panNumber} mono />
                    <Row
                      label="Aadhaar number"
                      value={display.aadharNumber}
                      mono
                    />
                    <Row label="KYC status" value={display.kycStatus} />
                    <LinkRow
                      label="PAN document"
                      href={display.panUrl}
                      text="View"
                    />
                    <LinkRow
                      label="Aadhaar document"
                      href={display.aadharUrl}
                      text="View"
                    />
                    <LinkRow
                      label="MSME / GST document"
                      href={display.msmeGstUrl}
                      text="View"
                    />
                  </Section>
                </div>

                {canViewFinancialData &&
                  (business.paymentId ||
                    business.orderId ||
                    business.razorpaySubscriptionId) && (
                    <Section title="Payment references">
                      <Row label="Payment ID" value={business.paymentId} mono />
                      <Row label="Order ID" value={business.orderId} mono />
                      <Row
                        label="Subscription ID"
                        value={business.razorpaySubscriptionId}
                        mono
                      />
                    </Section>
                  )}
              </>
            )}

            {canViewFinancialData && tab === "billing" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <Section title="Subscription">
                    <Row
                      label="Plan"
                      value={planLabel(
                        business.selectedPlan,
                        business.billingCycle,
                      )}
                    />
                    <Row
                      label="Payment status"
                      value={formatStatusLabel(business.paymentStatus)}
                    />
                    <Row
                      label="Auto-debit"
                      value={business.autoRenewEnabled ? "Enabled" : "Off"}
                    />
                    <Row
                      label="Mandate"
                      value={formatStatusLabel(
                        business.mandateStatus || "none",
                      )}
                    />
                    {business.subscriptionStatus && (
                      <Row
                        label="Subscription status"
                        value={formatStatusLabel(business.subscriptionStatus)}
                      />
                    )}
                  </Section>

                  <Section title="Validity">
                    {isStarterPlan ? (
                      <div className="px-3 py-3">
                        <p className="text-xs font-medium text-slate-900">
                          Starter has no validity period
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Upgrade to a paid plan to set or extend validity.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Row
                          label="Plan started"
                          value={formatDateTimeInr(business.planStartedAt)}
                        />
                        <Row
                          label="Expires"
                          value={formatDateTimeInr(business.planExpiresAt)}
                        />
                        {business.subscriptionCancelledAt && (
                          <Row
                            label="Cancelled"
                            value={formatDateTimeInr(
                              business.subscriptionCancelledAt,
                            )}
                          />
                        )}
                      </>
                    )}
                  </Section>
                </div>

                {canManage && (
                  <Section title="Change plan">
                    <div className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <select
                        value={planPresetId}
                        onChange={(e) => setPlanPresetId(e.target.value)}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
                      >
                        {MERCHANT_PLAN_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handlePlanChange}
                        disabled={!isPlanDirty || isSavingPlan}
                        className="admin-btn-primary !text-xs !py-2 disabled:cursor-not-allowed"
                      >
                        {isSavingPlan ? "Updating…" : "Update plan"}
                      </button>
                      {isPlanDirty && (
                        <button
                          type="button"
                          onClick={() => setPlanPresetId(currentPlanPresetId)}
                          className="admin-btn-secondary !text-xs !py-2"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <p className="px-3 pb-3 text-[11px] text-slate-500">
                      Starter clears validity. Growth adds one month; Pro adds
                      one year.
                    </p>
                  </Section>
                )}

                {canManage && !isStarterPlan && (
                  <Section title="Adjust validity">
                    <div className="px-3 py-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={planExpiresInput}
                          onChange={(e) => setPlanExpiresInput(e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
                        />
                        {(
                          [
                            ["collapse", "year", "−1y"],
                            ["collapse", "month", "−1m"],
                            ["extend", "month", "+1m"],
                            ["extend", "year", "+1y"],
                          ] as const
                        ).map(([dir, unit, label]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => shiftExpiry(dir, unit)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApplyExpiry}
                          disabled={!isExpiryDirty || isSavingExpiry}
                          className="admin-btn-primary !text-xs !py-1.5 disabled:cursor-not-allowed"
                        >
                          {isSavingExpiry ? "Applying…" : "Apply"}
                        </button>
                        {isExpiryDirty && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setPlanExpiresInput(
                                  toDateInputValue(business.planExpiresAt),
                                )
                              }
                              className="admin-btn-secondary !text-xs !py-1.5"
                            >
                              Reset
                            </button>
                            <span className="text-[11px] text-slate-500">
                              New expiry: {formatDateTimeInr(expiryIso)}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        This changes only the current paid plan&apos;s expiry.
                      </p>
                    </div>
                  </Section>
                )}
              </>
            )}

            {tab === "gallery" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-600">
                      {display.images?.length || 0}/5 images
                    </p>
                    {canManage && onReorderImages && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Drag images to reorder
                      </p>
                    )}
                  </div>
                  {canManage && (display.images?.length || 0) < 5 && (
                    <label
                      className={`admin-btn-primary !text-xs !py-1.5 cursor-pointer ${isUploading === "businessImages" ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      {isUploading === "businessImages"
                        ? uploadProgress
                          ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
                          : "Uploading…"
                        : "Add images"}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length) onImageUpload(files);
                          // Allow re-selecting the same file(s) later.
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {display.images && display.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {display.images.map((url, index) => (
                      <div
                        key={url}
                        draggable={canManage && Boolean(onReorderImages)}
                        onDragStart={() => setDraggedImageIndex(index)}
                        onDragOver={(event) => {
                          if (onReorderImages) event.preventDefault();
                        }}
                        onDrop={() => {
                          if (draggedImageIndex != null) {
                            void handleReorderImages(draggedImageIndex, index);
                          }
                          setDraggedImageIndex(null);
                        }}
                        onDragEnd={() => setDraggedImageIndex(null)}
                        className={`relative group aspect-square rounded-lg overflow-hidden border bg-slate-100 ${
                          draggedImageIndex === index
                            ? "border-teal-400 opacity-60"
                            : "border-slate-200"
                        } ${canManage && onReorderImages ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <img
                          src={url}
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {display.profilePictureUrl === url && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-medium rounded">
                            Profile
                          </span>
                        )}
                        {canManage && (
                          <div className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                            {onReorderImages && (
                              <span className="text-[10px] font-medium text-white/90">
                                ⋮⋮ Drag to move
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onSetProfilePicture(url)}
                              className="px-2 py-1 bg-white text-slate-900 text-[10px] font-medium rounded"
                            >
                              Set profile
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteImage(url)}
                              className="px-2 py-1 bg-rose-500 text-white text-[10px] font-medium rounded"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs bg-white">
                    No gallery images
                  </div>
                )}
              </div>
            )}

            {tab === "audit" && (
              <Section title="Merchant activity">
                {isLoadingAudit ? (
                  <div className="px-3 py-5 text-xs text-slate-500">
                    Loading audit history…
                  </div>
                ) : auditError ? (
                  <div className="px-3 py-5 text-xs text-rose-600">
                    {auditError}
                  </div>
                ) : visibleAuditLogs.length === 0 ? (
                  <div className="px-3 py-5 text-xs text-slate-500">
                    No audit activity yet.
                  </div>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {visibleAuditLogs.map((entry) => {
                      const changedFields = entry.changes
                        ? Object.keys(entry.changes)
                        : [];
                      return (
                        <li key={entry.id} className="px-3 py-2.5">
                          <p className="text-xs font-medium text-slate-900">
                            {entry.summary || formatStatusLabel(entry.action)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {entry.actor_email || "System"}
                            {entry.actor_role ? ` · ${entry.actor_role}` : ""}
                            {" · "}
                            {formatDateTimeInr(entry.created_at)}
                          </p>
                          {changedFields.length > 0 && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              Changed: {changedFields.join(", ")}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Section>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center gap-2 shrink-0">
            {canManage && (
              <button
                type="button"
                onClick={onDelete}
                className="admin-btn-danger !text-xs !py-1.5"
              >
                Delete
              </button>
            )}
            <div className="flex flex-wrap gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="admin-btn-secondary !text-xs !py-1.5"
              >
                Close
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={onToggleStatus}
                  className="admin-btn-secondary !text-xs !py-1.5"
                >
                  {display.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              )}
              {canManage &&
                (business.status || "").toLowerCase() === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={onReject}
                      className="admin-btn-danger !text-xs !py-1.5"
                    >
                      Reject listing
                    </button>
                    <button
                      type="button"
                      onClick={onApprove}
                      className="admin-btn-primary !text-xs !py-1.5"
                    >
                      Approve listing
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      </div>
    </EditModeContext.Provider>
  );
}
