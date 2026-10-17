"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_BROADCAST_CTA_LABEL,
  resolveBroadcastCta,
  sanitizeBroadcastCtaUrl,
} from "../lib/broadcastFields";
import { formatDateTimeInr } from "../lib/formatDateTime";
import { ADMIN_PANEL_REFRESH } from "../lib/adminPanelRefresh";
import {
  RECIPIENT_FILTERS,
  compareRecipientHistory,
  matchesRecipientFilter,
  notificationRecipient,
} from "../lib/broadcastRecipient";

type Broadcast = {
  id: string;
  title: string;
  message: string;
  target_audience?: string[] | null;
  created_at: string;
  cta_url?: string | null;
  cta_label?: string | null;
  show_datetime?: boolean | null;
  read_count?: number;
  recipient_count?: number | null;
  status?: string | null;
  scheduled_at?: string | null;
  target_user_id?: string | null;
  target_business_id?: string | null;
  target_label?: string | null;
};

type Hit = { id: string; name: string; detail: string; kind: "user" | "business" };

export default function BroadcastsContent({
  canManage = false,
  adminId = null,
}: {
  canManage?: boolean;
  adminId?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audiences, setAudiences] = useState<string[]>(["Users"]);
  const [mode, setMode] = useState<"group" | "one">("group");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ users: Hit[]; businesses: Hit[] }>({ users: [], businesses: [] });
  const [target, setTarget] = useState<Hit | null>(null);
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [showDatetime, setShowDatetime] = useState(true);
  const [when, setWhen] = useState("");
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "recipient">("newest");

  const load = async () => {
    if (!adminId) return;
    const res = await fetch(`/api/admin/broadcasts?adminId=${encodeURIComponent(adminId)}`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; broadcasts?: Broadcast[] } | null;
    if (json?.success && Array.isArray(json.broadcasts)) setRows(json.broadcasts);
  };

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(ADMIN_PANEL_REFRESH, onRefresh);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.removeEventListener(ADMIN_PANEL_REFRESH, onRefresh);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  useEffect(() => {
    if (!adminId || mode !== "one" || target || query.trim().length < 2) {
      setHits({ users: [], businesses: [] });
      return;
    }
    const handle = window.setTimeout(async () => {
      const res = await fetch(
        `/api/admin/broadcasts/search?adminId=${encodeURIComponent(adminId)}&q=${encodeURIComponent(query.trim())}`,
      );
      const json = (await res.json().catch(() => null)) as {
        users?: { id: string; name: string; detail: string }[];
        businesses?: { id: string; name: string; detail: string }[];
      } | null;
      setHits({
        users: (json?.users || []).map((item) => ({ ...item, kind: "user" as const })),
        businesses: (json?.businesses || []).map((item) => ({ ...item, kind: "business" as const })),
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [adminId, mode, query, target]);

  const previewLabel = ctaLabel.trim() || DEFAULT_BROADCAST_CTA_LABEL;
  const showCta = Boolean(ctaUrl.trim() || ctaLabel.trim());
  const previewCta = resolveBroadcastCta({ cta_url: ctaUrl, cta_label: ctaLabel });
  const queue = rows.filter((row) => row.status === "queued" || row.status === "scheduled");
  const history = useMemo(() => {
    return rows
      .filter((row) => row.status !== "queued" && row.status !== "scheduled")
      .map((row) => ({ row, who: notificationRecipient(row) }))
      .filter((item) => matchesRecipientFilter(item.who.kind, recipientFilter))
      .sort((a, b) =>
        compareRecipientHistory(
          { kind: a.who.kind, at: a.row.created_at },
          { kind: b.who.kind, at: b.row.created_at },
          sortBy,
        ),
      );
  }, [recipientFilter, rows, sortBy]);

  const who = useMemo(() => {
    if (mode === "one") return target ? target.name : "One person";
    return audiences.length ? audiences.join(" · ") : "Choose an audience";
  }, [audiences, mode, target]);

  const reset = () => {
    setTitle("");
    setMessage("");
    setCtaUrl("");
    setCtaLabel("");
    setWhen("");
    setTarget(null);
    setQuery("");
  };

  const send = async (saveAs: "send" | "queue" | "schedule") => {
    if (!canManage || !adminId) return;
    if (!title.trim() || !message.trim()) {
      setNote({ tone: "bad", text: "Add a title and a message." });
      return;
    }
    if (mode === "group" && audiences.length === 0) {
      setNote({ tone: "bad", text: "Choose users, merchants, or both." });
      return;
    }
    if (mode === "one" && !target) {
      setNote({ tone: "bad", text: "Search and pick one user or one business." });
      return;
    }
    if (ctaUrl.trim() && !sanitizeBroadcastCtaUrl(ctaUrl)) {
      setNote({ tone: "bad", text: "The button link must be a full http or https URL." });
      return;
    }
    if (saveAs === "schedule" && !when) {
      setNote({ tone: "bad", text: "Pick the date and time first." });
      return;
    }

    setBusy(saveAs);
    setNote(null);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId,
          title: title.trim(),
          message: message.trim(),
          audiences: mode === "group" ? audiences : [],
          targetUserId: target?.kind === "user" ? target.id : undefined,
          targetBusinessId: target?.kind === "business" ? target.id : undefined,
          targetLabel: target ? `${target.name}` : undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          showDatetime,
          scheduledAt: when ? new Date(when).toISOString() : undefined,
          saveAs: saveAs === "send" && when ? "schedule" : saveAs,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not save this notification.");
      setNote({ tone: "ok", text: json.message || "Sent." });
      reset();
      await load();
    } catch (error) {
      setNote({ tone: "bad", text: error instanceof Error ? error.message : "Could not save this notification." });
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, action: "send-now" | "cancel") => {
    if (!adminId) return;
    setBusy(id);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, id, action }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not update this notification.");
      setNote({ tone: "ok", text: json.message || "Updated." });
      await load();
    } catch (error) {
      setNote({ tone: "bad", text: error instanceof Error ? error.message : "Could not update this notification." });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string) => {
    setAudiences((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="admin-page-title">Broadcast Notification</h1>
        <p className="admin-page-subtitle">
          Send to everyone, or to one user or one business. Schedule it, or park several in the queue.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className={`xl:col-span-3 admin-card ${canManage ? "" : "opacity-70"}`}>
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Compose</h2>
              <p className="admin-card-description">Title, message, and who receives it.</p>
            </div>
          </div>
          <div className={`p-4 space-y-4 ${canManage ? "" : "pointer-events-none"}`}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input" placeholder="A short headline" />
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Who</span>
              <div className="flex gap-2">
                {(["group", "one"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setMode(item);
                      setTarget(null);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                      mode === item ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {item === "group" ? "A group" : "One person"}
                  </button>
                ))}
              </div>
              {mode === "group" ? (
                <div className="mt-2 flex gap-2">
                  {["Users", "Merchants"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggle(item)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        audiences.includes(item) ? "border-teal-600 bg-teal-700 text-white" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      {item === "Users" ? "All users" : "All businesses"}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="relative mt-2">
                  <input
                    value={target ? target.name : query}
                    onChange={(e) => {
                      setTarget(null);
                      setQuery(e.target.value);
                    }}
                    placeholder="Search by name, email, phone, or id"
                    className="admin-input"
                  />
                  {!target && (hits.users.length > 0 || hits.businesses.length > 0) ? (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                      {[...hits.users, ...hits.businesses].map((hit) => (
                        <button
                          key={`${hit.kind}-${hit.id}`}
                          type="button"
                          onClick={() => setTarget(hit)}
                          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{hit.name}</span>
                            <span className="block text-xs text-slate-500">{hit.detail || hit.id}</span>
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {hit.kind === "user" ? "User" : "Business"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="admin-input min-h-[140px]" placeholder="What should they read?" />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Button link</span>
                <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="admin-input" placeholder="https://finderb.com/offers" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Button text</span>
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="admin-input" placeholder={DEFAULT_BROADCAST_CTA_LABEL} maxLength={40} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Send at</span>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="admin-input" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showDatetime} onChange={(e) => setShowDatetime(e.target.checked)} />
              Show the date and time on the notification
            </label>

            {note ? (
              <p className={`rounded-lg px-3 py-2 text-sm ${note.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                {note.text}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => void send(when ? "schedule" : "send")} className="admin-btn-primary">
                {busy === "send" || busy === "schedule" ? "Saving…" : when ? "Schedule" : "Send now"}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void send("queue")} className="admin-btn-secondary">
                {busy === "queue" ? "Adding…" : "Add to queue"}
              </button>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="admin-card overflow-hidden">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title">Preview</h2>
                <p className="admin-card-description">This is the card people open.</p>
              </div>
            </div>
            <div className="p-4">
              <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="rounded-xl bg-white px-3.5 py-3.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">FinderB</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{title.trim() || "Your title"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {message.trim() || "Your message appears here."}
                  </p>
                  {showCta ? (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                      {previewCta?.label || previewLabel}
                      <span aria-hidden>→</span>
                    </span>
                  ) : null}
                  {showDatetime ? (
                    <p className="mt-2 text-[11px] text-slate-400">{formatDateTimeInr(new Date())}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] font-medium text-slate-500">{who}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="admin-card overflow-hidden">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Queue</h2>
              <p className="admin-card-description">{queue.length} waiting to go out</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {queue.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400">Nothing queued. Compose one and add it here.</p>
            ) : (
              queue.map((row) => (
                <article key={row.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{row.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {row.status === "scheduled" && row.scheduled_at
                          ? `Scheduled ${formatDateTimeInr(row.scheduled_at)}`
                          : "Held in the queue"}
                        {` · ${notificationRecipient(row).label}`}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-2">
                        <button type="button" className="text-xs font-semibold text-teal-700" disabled={busy === row.id} onClick={() => void act(row.id, "send-now")}>
                          Send now
                        </button>
                        <button type="button" className="text-xs font-semibold text-rose-600" disabled={busy === row.id} onClick={() => void act(row.id, "cancel")}>
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="admin-card overflow-hidden">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Sent</h2>
              <p className="admin-card-description">Who received it, and how many opened it</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
            <label className="block text-[11px] font-medium text-slate-500">
              Recipient
              <select
                value={recipientFilter}
                onChange={(event) => setRecipientFilter(event.target.value)}
                className="admin-input mt-1"
              >
                {RECIPIENT_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-slate-500">
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value === "recipient" ? "recipient" : "newest")}
                className="admin-input mt-1"
              >
                <option value="newest">Newest first</option>
                <option value="recipient">By recipient</option>
              </select>
            </label>
          </div>
          <div className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
            {history.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400">No notifications for this recipient.</p>
            ) : (
              history.map(({ row, who }) => {
                const reads = Number(row.read_count || 0);
                const sentTo = Number(row.recipient_count || 0);
                return (
                  <article key={row.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                      <p className="shrink-0 text-[11px] text-slate-400">{formatDateTimeInr(row.created_at)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{row.message}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-slate-700">{who.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                      {reads} of {sentTo || "—"} read
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
