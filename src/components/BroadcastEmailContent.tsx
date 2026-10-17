"use client";

import { useEffect, useMemo, useState } from "react";
import AdminContentLoader from "./AdminContentLoader";
import { ADMIN_PANEL_REFRESH } from "../lib/adminPanelRefresh";
import {
  RECIPIENT_FILTERS,
  compareRecipientHistory,
  emailRecipient,
  matchesRecipientFilter,
} from "../lib/broadcastRecipient";
import { formatDateTimeInr } from "../lib/formatDateTime";

type SentEmail = {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  createdAt: string;
};

const LOCAL_HISTORY = "finderb.broadcastEmailHistory";

export default function BroadcastEmailContent({
  canManage = false,
  adminId = null,
}: {
  canManage?: boolean;
  adminId?: string | null;
}) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [ready, setReady] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "recipient">("newest");

  const rememberLocal = (rows: SentEmail[]) => {
    setSent(rows.slice(0, 80));
    try {
      window.localStorage.setItem(LOCAL_HISTORY, JSON.stringify(rows.slice(0, 80)));
    } catch {
      /* the server copy is the record that survives a new browser */
    }
  };

  const load = async () => {
    if (!adminId) {
      setReady(true);
      return;
    }
    try {
      let local: SentEmail[] = [];
      try {
        const raw = window.localStorage.getItem(LOCAL_HISTORY);
        const parsed = raw ? (JSON.parse(raw) as SentEmail[]) : [];
        if (Array.isArray(parsed)) local = parsed;
      } catch {
        local = [];
      }
      const res = await fetch(`/api/admin/broadcast-email?adminId=${encodeURIComponent(adminId)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; emails?: SentEmail[] } | null;
      const remote = json?.success && Array.isArray(json.emails) ? json.emails : [];
      const merged = [...remote];
      for (const item of local) {
        const exists = merged.some((row) => {
          if (row.subject !== item.subject || row.to.join(",") !== item.to.join(",")) return false;
          const gap = Math.abs(new Date(row.createdAt).getTime() - new Date(item.createdAt).getTime());
          return row.createdAt === item.createdAt || gap < 2 * 60 * 1000;
        });
        if (!exists) merged.push(item);
      }
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      rememberLocal(merged);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(ADMIN_PANEL_REFRESH, onRefresh);
    return () => window.removeEventListener(ADMIN_PANEL_REFRESH, onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  const visible = useMemo(() => {
    return sent
      .map((item) => ({ item, who: emailRecipient(item) }))
      .filter((row) => matchesRecipientFilter(row.who.kind, recipientFilter))
      .sort((a, b) =>
        compareRecipientHistory(
          { kind: a.who.kind, at: a.item.createdAt },
          { kind: b.who.kind, at: b.item.createdAt },
          sortBy,
        ),
      );
  }, [recipientFilter, sent, sortBy]);

  const send = async () => {
    if (!canManage || !adminId) return;
    setSending(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, to, cc, bcc, subject, body }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; persisted?: boolean } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "The email was not delivered.");
      const justSent: SentEmail = {
        id: `local-${Date.now()}`,
        to: to.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
        cc: cc.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
        bcc: bcc.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
        subject: subject.trim(),
        createdAt: new Date().toISOString(),
      };
      rememberLocal([justSent, ...sent.filter((row) => row.id !== justSent.id)]);
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setNote({
        tone: "ok",
        text: json.persisted
          ? "Delivered through Resend."
          : "Delivered through Resend. History is saved in this browser; run supabase/admin_outbound_emails.sql so it stays after you switch computers.",
      });
      void load();
    } catch (error) {
      setNote({ tone: "bad", text: error instanceof Error ? error.message : "The email was not delivered." });
    } finally {
      setSending(false);
    }
  };

  if (!ready) return <AdminContentLoader label="Loading broadcast email" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="admin-page-title">Broadcast Email</h1>
        <p className="admin-page-subtitle">
          Write the mail here. Send delivers it through Resend from the FinderB address.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className={`xl:col-span-3 admin-card ${canManage ? "" : "opacity-70"}`}>
          <div className="admin-card-header">
            <h2 className="admin-card-title">New email</h2>
          </div>
          <div className={`space-y-3 p-4 ${canManage ? "" : "pointer-events-none"}`}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">To</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} className="admin-input" placeholder="name@email.com, another@email.com" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Cc</span>
                <input value={cc} onChange={(e) => setCc(e.target.value)} className="admin-input" placeholder="Optional" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Bcc</span>
                <input value={bcc} onChange={(e) => setBcc(e.target.value)} className="admin-input" placeholder="Optional" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="admin-input" placeholder="Subject line" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Body</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="admin-input min-h-[200px]" placeholder="Write the email" />
            </label>
            {note ? (
              <p className={`rounded-lg px-3 py-2 text-sm ${note.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                {note.text}
              </p>
            ) : null}
            <button type="button" onClick={() => void send()} disabled={sending || !canManage} className="admin-btn-primary">
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        <aside className="xl:col-span-2 admin-card overflow-hidden">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Sent</h2>
              <p className="admin-card-description">Who received each email. This stays after a refresh.</p>
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
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400">No emails for this recipient.</p>
            ) : (
              visible.map(({ item, who }) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.subject}</p>
                    <p className="shrink-0 text-[11px] text-slate-400">{formatDateTimeInr(item.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">{who.label}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
