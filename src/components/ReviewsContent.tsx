"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminToast } from "./AdminToast";
import {
  ListSearchInput,
  PaginationControls,
  useClientPage,
} from "./AdminListControls";
import { getBusinessProfileUrl } from "../lib/site";

type AdminSession = {
  id: string;
  email?: string;
  role?: string;
};

type InnerTab = "all" | "anonymous" | "user-flags" | "business-flags";

type ReviewRow = {
  business_id: string;
  business_name: string;
  city?: string | null;
  slug?: string | null;
  review_id: string;
  author_name: string;
  public_name: string;
  content: string;
  rating: number;
  date?: string;
  anonymous: boolean;
  anonymous_reason?: string | null;
  anonymity_status: string;
  hidden: boolean;
  deleted: boolean;
  reply?: string | null;
};

type FlagRow = ReviewRow & {
  id: string;
  reporter_key: string;
  reporter_type?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at: string;
};

const TABS: { id: InnerTab; label: string; help: string }[] = [
  { id: "all", label: "All reviews", help: "Every review written on a FinderB listing" },
  { id: "anonymous", label: "Anonymous posts", help: "Customers who asked to hide their name" },
  { id: "user-flags", label: "Customer reports", help: "Reviews reported by other users" },
  { id: "business-flags", label: "Business reports", help: "Reviews flagged by the shop owner" },
];

function stars(rating: number | null | undefined) {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "Date not stored";
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

function visibilityLabel(row: Pick<ReviewRow, "hidden" | "deleted">) {
  if (row.deleted) return { label: "Removed", className: "bg-rose-50 text-rose-800 border-rose-200" };
  if (row.hidden) return { label: "Hidden from public", className: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "Visible on listing", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

function anonymousLabel(status: string) {
  if (status === "pending") return { label: "Needs a decision", className: "bg-sky-50 text-sky-800 border-sky-200" };
  if (status === "allowed") return { label: "Kept anonymous", className: "bg-slate-100 text-slate-700 border-slate-200" };
  if (status === "revealed") return { label: "Real name shown", className: "bg-violet-50 text-violet-800 border-violet-200" };
  return { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
}

function isFlagRow(row: ReviewRow | FlagRow): row is FlagRow {
  return "reporter_key" in row;
}

function toReviewRow(raw: Record<string, unknown>): ReviewRow {
  return {
    business_id: String(raw.business_id || raw.businessId || ""),
    business_name: String(raw.business_name || raw.businessName || "Business"),
    city: raw.city ? String(raw.city) : null,
    slug: raw.slug ? String(raw.slug) : null,
    review_id: String(raw.review_id || raw.id || ""),
    author_name: String(raw.author_name || raw.author || "Customer"),
    public_name: String(raw.public_name || raw.display_name || raw.author || "Customer"),
    content: String(raw.content || ""),
    rating: Number(raw.rating) || 0,
    date: raw.date ? String(raw.date) : raw.created_at ? String(raw.created_at) : "",
    anonymous: Boolean(raw.anonymous),
    anonymous_reason: raw.anonymous_reason ? String(raw.anonymous_reason) : null,
    anonymity_status: String(raw.anonymity_status || (raw.anonymous ? "pending" : "allowed")),
    hidden: Boolean(raw.hidden),
    deleted: Boolean(raw.deleted),
    reply: raw.reply ? String(raw.reply) : null,
  };
}

export default function ReviewsContent({
  adminSession,
  canManage,
}: {
  adminSession: AdminSession | null;
  canManage: boolean;
}) {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<InnerTab>("all");
  const [anonStatus, setAnonStatus] = useState<"pending" | "allowed" | "revealed" | "">("pending");
  const [flagStatus, setFlagStatus] = useState<"open" | "all">("open");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [note, setNote] = useState("");
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, visible: 0, hidden: 0, removed: 0, anonymousPending: 0 });
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
      } else if (tab === "user-flags") {
        params.set("kind", "user-flags");
        params.set("status", flagStatus);
      } else if (tab === "business-flags") {
        params.set("kind", "business-flags");
        params.set("status", flagStatus);
      } else {
        params.set("kind", "all");
        if (appliedQuery.trim()) params.set("q", appliedQuery.trim());
      }
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Could not load reviews.", "error");
        return;
      }
      if (tab === "user-flags" || tab === "business-flags") {
        setFlags(
          (json.rows || []).map((row: Record<string, unknown>) => ({
            ...toReviewRow(row),
            id: String(row.id),
            reporter_key: String(row.reporter_key || ""),
            reporter_type: row.reporter_type ? String(row.reporter_type) : null,
            reason: row.reason ? String(row.reason) : null,
            status: row.status ? String(row.status) : "open",
            created_at: String(row.created_at || ""),
          })),
        );
      } else {
        setReviews((json.rows || []).map((row: Record<string, unknown>) => toReviewRow(row)));
      }
      if (json.counts) setCounts((current) => ({ ...current, ...json.counts }));
    } catch {
      toast("Could not load reviews.", "error");
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, tab, appliedQuery, toast, anonStatus, flagStatus]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setNote("");
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

  const list = tab === "user-flags" || tab === "business-flags" ? flags : reviews;
  const paging = useClientPage(list, 12, `${tab}-${anonStatus}-${flagStatus}-${appliedQuery}`);

  const actionButtons = (
    businessId: string,
    reviewId: string,
    extras?: { reportId?: string; anonymous?: boolean; hidden?: boolean; deleted?: boolean },
  ) => {
    const key = `${businessId}:${reviewId}`;
    const disabled = !canManage || busyKey === key;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">What do you want to do?</p>
        <div className="flex flex-wrap gap-1.5">
          {extras?.hidden ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void act({ action: "unhide", businessId, reviewId }, key)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Show on listing again
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || extras?.deleted}
              onClick={() => void act({ action: "hide", businessId, reviewId }, key)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Hide from public
            </button>
          )}
          {extras?.deleted ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void act({ action: "restore", businessId, reviewId }, key)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Restore review
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!confirm("Remove this review from the public listing?")) return;
                void act({ action: "delete", businessId, reviewId }, key);
              }}
              className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            >
              Remove review
            </button>
          )}
          {extras?.anonymous ? (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void act({ action: "allowAnonymous", businessId, reviewId }, key)}
                className="rounded-lg border border-teal-200 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
              >
                Keep name hidden
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void act({ action: "revealAnonymous", businessId, reviewId }, key)}
                className="rounded-lg border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-40"
              >
                Show real name
              </button>
            </>
          ) : null}
          {extras?.reportId ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void act({ action: "dismissFlag", reportId: extras.reportId }, key)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Mark report done
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderReview = (row: ReviewRow, extra?: { reportId?: string; reason?: string | null; reportStatus?: string | null; reportedAt?: string }) => {
    const vis = visibilityLabel(row);
    const listingUrl = getBusinessProfileUrl({ id: row.business_id, slug: row.slug, city: row.city, businessName: row.business_name });
    return (
      <article key={`${row.business_id}:${row.review_id}:${extra?.reportId || ""}`} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <a href={listingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 hover:underline">
              {row.business_name}
            </a>
            <p className="text-xs text-slate-500">{[row.city, formatWhen(row.date || extra?.reportedAt)].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${vis.className}`}>{vis.label}</span>
            {row.anonymous ? (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${anonymousLabel(row.anonymity_status).className}`}>
                {anonymousLabel(row.anonymity_status).label}
              </span>
            ) : null}
            {extra?.reportStatus ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Report: {extra.reportStatus}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm font-medium text-slate-900">
            {row.anonymous ? (
              <>
                Public name: {row.public_name}
                <span className="ml-2 font-normal text-slate-500">Real name: {row.author_name}</span>
              </>
            ) : (
              <>Reviewer: {row.author_name}</>
            )}
            <span className="ml-2 text-amber-500">{stars(row.rating)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{row.content || "No review text."}</p>
          {row.anonymous_reason ? (
            <p className="mt-2 text-xs text-slate-500">Why they asked to stay anonymous: {row.anonymous_reason}</p>
          ) : null}
          {row.reply ? (
            <p className="mt-2 text-xs text-slate-600">Shop reply: {row.reply}</p>
          ) : null}
          {extra?.reason ? (
            <p className="mt-2 text-xs font-medium text-rose-700">Report reason: {extra.reason}</p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void copyReviewId(row.review_id)}
            className="rounded-md border border-slate-300 bg-transparent px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-slate-400"
          >
            {copiedId === row.review_id ? "Copied review ID" : `Review ID ${row.review_id.slice(0, 8)}`}
          </button>
        </div>
        <div className="mt-3">
          {actionButtons(row.business_id, row.review_id, {
            reportId: extra?.reportId,
            anonymous: row.anonymous,
            hidden: row.hidden,
            deleted: row.deleted,
          })}
        </div>
      </article>
    );
  };

  const emptyCopy = useMemo(() => {
    if (tab === "anonymous") return "No anonymous reviews in this filter.";
    if (tab === "user-flags") return "No customer reports in this filter.";
    if (tab === "business-flags") return "No business reports in this filter.";
    return appliedQuery.trim() ? "No reviews match that search." : "No reviews found yet.";
  }, [tab, appliedQuery]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reviews</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Read what customers posted on listings, hide or remove a review if it breaks the rules, and decide whether an
          anonymous review should stay nameless.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ["On listings", counts.visible],
          ["Hidden", counts.hidden],
          ["Removed", counts.removed],
          ["Anonymous waiting", counts.anonymousPending],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-left text-sm font-medium ${
              tab === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="block">{item.label}</span>
            <span className="block text-[11px] font-normal text-slate-500">{item.help}</span>
          </button>
        ))}
      </div>

      {tab === "all" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedQuery(query.trim());
          }}
        >
          <ListSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search shop, city, reviewer, review text, or review ID"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
          {appliedQuery ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setAppliedQuery("");
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
            >
              Show all
            </button>
          ) : null}
        </form>
      ) : null}

      {tab === "anonymous" ? (
        <div className="flex flex-wrap gap-1.5">
          {([
            ["pending", "Needs a decision"],
            ["allowed", "Kept anonymous"],
            ["revealed", "Name shown"],
            ["", "All anonymous"],
          ] as const).map(([value, label]) => (
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

      {tab === "user-flags" || tab === "business-flags" ? (
        <div className="flex flex-wrap gap-1.5">
          {([
            ["open", "Open reports"],
            ["all", "All reports"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFlagStatus(value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                flagStatus === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Optional note saved with your next action
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Example: Hidden because it names another customer"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500/40"
        />
      </label>

      {loading ? (
        <p className="text-sm text-slate-500">Loading reviews…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          {emptyCopy}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {paging.pageItems.map((item) =>
              isFlagRow(item)
                ? renderReview(item, {
                    reportId: item.id,
                    reason: item.reason,
                    reportStatus: item.status,
                    reportedAt: item.created_at,
                  })
                : renderReview(item),
            )}
          </div>
          <PaginationControls
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={paging.pageSize}
            onPageChange={paging.setPage}
          />
        </>
      )}
    </div>
  );
}
