"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminToast } from "./AdminToast";
import { ListSearchInput } from "./AdminListControls";

type AdminSession = {
  id: string;
  email?: string;
  role?: string;
};

type InnerTab = "anonymous" | "user-flags" | "business-flags" | "search";

type ReviewRow = {
  id: string;
  author: string;
  content: string;
  rating: number;
  date?: string;
  anonymous?: boolean;
  anonymityStatus?: string;
  anonymousReason?: string;
  hidden?: boolean;
  deleted?: boolean;
};

type ModerationRow = {
  id: string;
  business_id: string;
  review_id: string;
  business_name: string | null;
  author_name: string | null;
  display_name: string | null;
  content: string | null;
  rating: number | null;
  anonymous: boolean;
  anonymous_reason: string | null;
  anonymity_status: string;
  hidden: boolean;
  deleted: boolean;
  admin_note: string | null;
  created_at: string;
};

type FlagRow = {
  id: string;
  business_id: string;
  review_id: string;
  reporter_key: string;
  reporter_type: string | null;
  reason: string | null;
  status: string | null;
  created_at: string;
  author_name?: string | null;
  display_name?: string | null;
  content?: string | null;
  rating?: number | null;
  business_name?: string | null;
  anonymous?: boolean;
};

type MerchantHit = {
  id: string;
  businessName: string;
  city: string | null;
  reviews: ReviewRow[];
};

const TABS: { id: InnerTab; label: string }[] = [
  { id: "anonymous", label: "Anonymous" },
  { id: "user-flags", label: "User flags" },
  { id: "business-flags", label: "Business flags" },
  { id: "search", label: "All reviews" },
];

function stars(rating: number | null | undefined) {
  const value = Math.max(1, Math.min(5, Number(rating) || 5));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReviewsContent({
  adminSession,
  canManage,
}: {
  adminSession: AdminSession | null;
  canManage: boolean;
}) {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<InnerTab>("anonymous");
  const [anonStatus, setAnonStatus] = useState<"pending" | "allowed" | "revealed" | "">("pending");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [anonymous, setAnonymous] = useState<ModerationRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [merchants, setMerchants] = useState<MerchantHit[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ adminId: adminSession.id });
      if (tab === "anonymous") {
        params.set("kind", "anonymous");
        if (anonStatus) params.set("status", anonStatus);
      }
      else if (tab === "user-flags") params.set("kind", "user-flags");
      else if (tab === "business-flags") params.set("kind", "business-flags");
      else {
        params.set("kind", "search");
        if (query.trim()) params.set("q", query.trim());
      }
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not load reviews.", "error");
        return;
      }
      if (tab === "anonymous") setAnonymous(json.rows || []);
      if (tab === "user-flags" || tab === "business-flags") setFlags(json.rows || []);
      if (tab === "search") {
        const fromMatches = (json.matches || []).map((row: ModerationRow) => ({
          id: row.business_id,
          businessName: row.business_name || "Business",
          city: null,
          reviews: [
            {
              id: row.review_id,
              author: row.author_name || "Customer",
              content: row.content || "",
              rating: row.rating || 5,
              anonymous: row.anonymous,
              anonymityStatus: row.anonymity_status,
              anonymousReason: row.anonymous_reason,
              hidden: row.hidden,
              deleted: row.deleted,
            },
          ],
        }));
        setMerchants(
          fromMatches.length ? fromMatches : json.businesses || [],
        );
      }
    } catch {
      toast("Could not load reviews.", "error");
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, tab, query, toast, anonStatus]);

  useEffect(() => {
    if (tab !== "search") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, adminSession?.id, anonStatus]);

  const act = async (payload: Record<string, unknown>, key: string) => {
    if (!canManage || !adminSession?.id) {
      toast("Read-only access. Ask a Developer for edit permission.", "error");
      return;
    }
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          adminId: adminSession.id,
          adminNote: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Action failed.", "error");
        return;
      }
      toast("Updated.", "success");
      await load();
    } catch {
      toast("Action failed.", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const copyReviewId = async (reviewId: string) => {
    try {
      await navigator.clipboard.writeText(reviewId);
      setCopiedId(reviewId);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setCopiedId(null);
    }
  };

  const ReviewIdChip = ({ reviewId }: { reviewId: string }) => (
    <button
      type="button"
      onClick={() => void copyReviewId(reviewId)}
      className="rounded-md border border-slate-300 bg-transparent px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-slate-400"
      title="Copy review ID"
    >
      {copiedId === reviewId ? "Copied" : reviewId.slice(0, 8)}
    </button>
  );

  const actionButtons = (
    businessId: string,
    reviewId: string,
    extras?: { reportId?: string; anonymous?: boolean },
  ) => {
    const key = `${businessId}:${reviewId}`;
    const disabled = !canManage || busyKey === key;
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act({ action: "hide", businessId, reviewId }, key)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Hide
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act({ action: "unhide", businessId, reviewId }, key)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Unhide
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!confirm("Delete this review from the public listing?")) return;
            void act({ action: "delete", businessId, reviewId }, key);
          }}
          className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act({ action: "restore", businessId, reviewId }, key)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Restore
        </button>
        {extras?.anonymous ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void act({ action: "allowAnonymous", businessId, reviewId }, key)
              }
              className="rounded-lg border border-teal-200 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
            >
              Keep anonymous
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                void act({ action: "revealAnonymous", businessId, reviewId }, key)
              }
              className="rounded-lg border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-40"
            >
              Reveal name
            </button>
          </>
        ) : null}
        {extras?.reportId ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              void act({ action: "dismissFlag", reportId: extras.reportId }, key)
            }
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Dismiss flag
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Moderate anonymous posts, customer flags, and business flags. Developer
          accounts assign this tab to other admins.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === item.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Admin note (saved with the next action)
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Why you are hiding, revealing, or dismissing this review"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500/40"
        />
      </label>

      {tab === "anonymous" ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["pending", "Needs review"],
              ["allowed", "Kept anonymous"],
              ["revealed", "Name revealed"],
              ["", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setAnonStatus(value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                anonStatus === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "search" ? (
        <div className="flex flex-wrap gap-2">
          <ListSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search merchant name, business ID, or review ID"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tab === "anonymous" ? (
        anonymous.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No anonymous reviews yet.
          </p>
        ) : (
          <div className="space-y-3">
            {anonymous.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {row.business_name || row.business_id}
                    </p>
                    <p className="text-xs text-slate-500">
                      Real name: {row.author_name || "—"} · Public:{" "}
                      {row.display_name || "—"} · {stars(row.rating)} ·{" "}
                      {row.anonymity_status}
                    </p>
                  </div>
                  <ReviewIdChip reviewId={row.review_id} />
                </div>
                <p className="mt-2 text-sm text-slate-700">{row.content}</p>
                {row.anonymous_reason ? (
                  <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Reason: {row.anonymous_reason}
                  </p>
                ) : null}
                <div className="mt-3">
                  {actionButtons(row.business_id, row.review_id, {
                    anonymous: true,
                  })}
                </div>
              </article>
            ))}
          </div>
        )
      ) : tab === "user-flags" || tab === "business-flags" ? (
        flags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No open {tab === "user-flags" ? "user" : "business"} flags.
          </p>
        ) : (
          <div className="space-y-3">
            {flags.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {row.business_name || `Review ${row.review_id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.author_name || row.display_name || "Customer"}
                      {row.rating ? ` · ${stars(row.rating)}` : ""} · {row.reporter_key} ·{" "}
                      {formatWhen(row.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReviewIdChip reviewId={row.review_id} />
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {row.status || "open"}
                    </p>
                  </div>
                </div>
                {row.content ? (
                  <p className="mt-2 text-sm text-slate-700">{row.content}</p>
                ) : null}
                <p className="mt-2 text-sm text-slate-600">Flag: {row.reason}</p>
                <div className="mt-3">
                  {actionButtons(row.business_id, row.review_id, {
                    reportId: row.id,
                    anonymous: Boolean(row.anonymous),
                  })}
                </div>
              </article>
            ))}
          </div>
        )
      ) : merchants.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          Search a merchant or paste a review ID.
        </p>
      ) : (
        <div className="space-y-4">
          {merchants.map((merchant) => (
            <section
              key={merchant.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-slate-900">
                {merchant.businessName}
                {merchant.city ? ` · ${merchant.city}` : ""}
              </h2>
              <p className="font-mono text-[11px] text-slate-400">{merchant.id}</p>
              <div className="mt-3 space-y-3">
                {(merchant.reviews || []).map((review) => (
                  <div
                    key={review.id}
                    className="rounded-lg border border-slate-100 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {review.author}{" "}
                        <span className="text-amber-500">{stars(review.rating)}</span>
                      </p>
                      <ReviewIdChip reviewId={review.id} />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{review.content}</p>
                    {review.anonymousReason ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Anonymous reason: {review.anonymousReason}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      {actionButtons(merchant.id, review.id, {
                        anonymous: Boolean(review.anonymous),
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
