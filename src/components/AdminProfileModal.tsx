"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

type AdminSession = {
  id: string;
  email: string;
  role: string;
  allowed_tabs?: string[];
  displayName?: string | null;
};

type AdminRow = {
  id: string;
  email: string;
  role: string;
  allowed_tabs: string[] | null;
  is_disabled: boolean | null;
  created_at: string | null;
  display_name?: string | null;
};

function resolveDisplayName(
  session: AdminSession,
  row: AdminRow | null,
): string {
  const fromDb = row?.display_name?.trim();
  if (fromDb) return fromDb;
  const fromSession = session.displayName?.trim();
  if (fromSession) return fromSession;
  return session.email.split("@")[0] || "Admin";
}

export default function AdminProfileModal({
  session,
  onClose,
  onSignOut,
  onDisplayNameChange,
}: {
  session: AdminSession;
  onClose: () => void;
  onSignOut: () => void;
  onDisplayNameChange?: (displayName: string) => void;
}) {
  const [row, setRow] = useState<AdminRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameNote, setNameNote] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        let adminRow: AdminRow | null = null;

        const primary = await supabase
          .from("admins")
          .select(
            "id, email, role, allowed_tabs, is_disabled, created_at, display_name",
          )
          .eq("id", session.id)
          .maybeSingle();

        if (primary.error && /display_name/i.test(primary.error.message || "")) {
          const fallback = await supabase
            .from("admins")
            .select("id, email, role, allowed_tabs, is_disabled, created_at")
            .eq("id", session.id)
            .maybeSingle();
          adminRow = (fallback.data as AdminRow | null) || null;
        } else {
          adminRow = (primary.data as AdminRow | null) || null;
        }

        if (!cancelled) {
          setRow(adminRow);
          setNameDraft(resolveDisplayName(session, adminRow));
        }
      } catch {
        if (!cancelled) {
          setRow(null);
          setNameDraft(resolveDisplayName(session, null));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const email = row?.email || session.email;
  const role = row?.role || session.role;
  const tabs = row?.allowed_tabs ?? session.allowed_tabs ?? null;
  const displayName = resolveDisplayName(session, row);
  const joined = row?.created_at
    ? new Date(row.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const handleSaveName = async () => {
    const next = nameDraft.trim();
    if (!next) {
      setNameNote({ tone: "error", text: "Name cannot be empty." });
      return;
    }
    if (next === displayName) {
      setNameNote({ tone: "success", text: "Name is already up to date." });
      return;
    }

    setSavingName(true);
    setNameNote(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admins")
        .update({ display_name: next })
        .eq("id", session.id);

      if (error) {
        // Column may not exist yet — still keep name in local session.
        if (!/display_name/i.test(error.message || "")) {
          throw error;
        }
        setNameNote({
          tone: "success",
          text: "Saved on this device. Run db/add_admin_display_name.sql to sync across devices.",
        });
      } else {
        setRow((prev) => (prev ? { ...prev, display_name: next } : prev));
        setNameNote({ tone: "success", text: "Profile name updated." });
      }

      onDisplayNameChange?.(next);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not update name.";
      setNameNote({ tone: "error", text: message });
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="relative overflow-hidden bg-slate-950 px-5 pt-5 pb-6 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(45,212,191,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.1) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-teal-400/25 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-400/10 text-lg font-semibold text-teal-200">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-teal-200/80">
                  Your profile
                </p>
                <h2 className="text-lg font-semibold truncate">{displayName}</h2>
                <p className="text-sm text-slate-300 truncate">{email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
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

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading profile…</p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 px-3 py-3 space-y-2">
                <label
                  htmlFor="admin-display-name"
                  className="block text-[11px] font-medium text-slate-500"
                >
                  Profile name
                </label>
                <div className="flex gap-2">
                  <input
                    id="admin-display-name"
                    value={nameDraft}
                    onChange={(e) => {
                      setNameDraft(e.target.value);
                      setNameNote(null);
                    }}
                    maxLength={60}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500/40"
                    placeholder="Your name"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={savingName || !nameDraft.trim()}
                    className="shrink-0 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {savingName ? "Saving…" : "Save"}
                  </button>
                </div>
                {nameNote && (
                  <p
                    className={`text-xs ${
                      nameNote.tone === "success"
                        ? "text-emerald-700"
                        : "text-rose-600"
                    }`}
                  >
                    {nameNote.text}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Shown in the sidebar instead of your email username.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Role</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize mt-0.5">
                    {role.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-[11px] text-slate-500">Status</p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      row?.is_disabled ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {row?.is_disabled ? "Disabled" : "Active"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 col-span-2">
                  <p className="text-[11px] text-slate-500">Joined</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {joined}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] text-slate-500 mb-1.5">Access</p>
                {role === "controller" || role === "super_admin" ? (
                  <p className="text-sm font-medium text-slate-800">
                    Full console access
                  </p>
                ) : tabs && tabs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tabs.map((tab) => (
                      <span
                        key={tab}
                        className="rounded-full bg-teal-50 text-teal-800 px-2 py-0.5 text-[11px] font-medium"
                      >
                        {tab}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No tab permissions set</p>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
