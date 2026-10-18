"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import AdminChangePassword from "./AdminChangePassword";
import AdminOverlay from "./AdminOverlay";

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
  const [changingPassword, setChangingPassword] = useState(false);

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

  const accessLabel =
    role === "developer"
      ? "Full console access, including Manage Admins"
      : role === "controller"
        ? "All tabs except Manage Admins"
        : role === "super_admin"
          ? "Tab access is assigned by a Developer"
          : null;

  return (
    <AdminOverlay>
      <div className="admin-card w-full max-w-lg shadow-xl">
        {changingPassword ? (
          <AdminChangePassword
            adminId={session.id}
            email={email}
            onClose={() => setChangingPassword(false)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-lg font-semibold text-orange-800">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Your profile
                  </p>
                  <h2 className="truncate text-lg font-semibold text-slate-900">{displayName}</h2>
                  <p className="truncate text-sm text-slate-500">{email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="admin-btn-secondary !px-2.5 !py-1.5 text-xs"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {loading ? (
                <p className="text-sm text-slate-500">Loading profile…</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="admin-display-name" className="text-sm font-medium text-slate-800">
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
                        className="admin-input"
                        placeholder="Your name"
                      />
                      <button
                        type="button"
                        onClick={handleSaveName}
                        disabled={savingName || !nameDraft.trim()}
                        className="admin-btn-primary shrink-0"
                      >
                        {savingName ? "Saving…" : "Save"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      This name appears in the sidebar.
                    </p>
                    {nameNote ? (
                      <p className={`text-xs ${nameNote.tone === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                        {nameNote.text}
                      </p>
                    ) : null}
                  </div>

                  <dl className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <dt className="text-[11px] text-slate-400">Role</dt>
                      <dd className="mt-1 text-sm font-medium capitalize text-slate-900">
                        {role.replace(/_/g, " ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Status</dt>
                      <dd className={`mt-1 text-sm font-medium ${row?.is_disabled ? "text-rose-700" : "text-emerald-700"}`}>
                        {row?.is_disabled ? "Disabled" : "Active"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-400">Joined</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">{joined}</dd>
                    </div>
                  </dl>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-[11px] text-slate-400">Access</p>
                    {accessLabel ? (
                      <p className="mt-1.5 text-sm text-slate-800">{accessLabel}</p>
                    ) : tabs && tabs.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tabs.map((tab) => (
                          <span
                            key={tab}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {tab}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-sm text-slate-500">No tab permissions set</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Password</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Confirm your current password, then a code sent to your email.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChangingPassword(true)}
                      className="admin-btn-secondary shrink-0"
                    >
                      Change
                    </button>
                  </div>
                </>
              )}

              <button type="button" onClick={onSignOut} className="text-sm font-medium text-rose-700 hover:text-rose-800">
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </AdminOverlay>
  );
}
