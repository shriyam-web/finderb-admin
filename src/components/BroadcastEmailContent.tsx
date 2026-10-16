"use client";

import { useState } from "react";

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
  const [sent, setSent] = useState<{ to: string; subject: string; at: string }[]>([]);

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
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "The email was not delivered.");
      setSent((rows) => [{ to: to.trim(), subject: subject.trim(), at: new Date().toISOString() }, ...rows].slice(0, 12));
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setNote({ tone: "ok", text: "Delivered through Resend." });
    } catch (error) {
      setNote({ tone: "bad", text: error instanceof Error ? error.message : "The email was not delivered." });
    } finally {
      setSending(false);
    }
  };

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
              <h2 className="admin-card-title">Sent this session</h2>
              <p className="admin-card-description">A short record of what just went out.</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {sent.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400">Nothing sent yet from this screen.</p>
            ) : (
              sent.map((item) => (
                <div key={`${item.at}-${item.subject}`} className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.to}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
