"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "../../utils/supabase/client";
import AdminChangePassword from "./AdminChangePassword";
import AdminOverlay from "./AdminOverlay";
import AdminProfilePhoto, { type AdminProfilePhotoHandle } from "./AdminProfilePhoto";

type AdminSession = {
  id: string;
  email: string;
  role: string;
  allowed_tabs?: string[];
  displayName?: string | null;
  avatarUrl?: string | null;
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
  onAvatarChange,
}: {
  session: AdminSession;
  onClose: () => void;
  onSignOut: () => void;
  onDisplayNameChange?: (displayName: string) => void;
  onAvatarChange?: (avatarUrl: string | null) => void;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(session.avatarUrl || null);
  const [editingName, setEditingName] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const photoRef = useRef<AdminProfilePhotoHandle>(null);

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
      setEditingName(false);
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
      ? "Full access, including Manage Admins"
      : role === "controller"
        ? "All tabs except Manage Admins"
        : "Only the tabs a Developer assigned";

  return (
    <AdminOverlay>
      <div className="admin-card admin-profile-sheet flex max-h-[min(92dvh,880px)] w-full max-w-3xl flex-col overflow-hidden">
        {changingPassword ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminChangePassword
              adminId={session.id}
              email={email}
              onClose={() => setChangingPassword(false)}
            />
          </div>
        ) : (
          <>
            <div className="admin-profile-hero shrink-0">
              <div className="flex items-start justify-between px-5 pt-4 sm:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">Your profile</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/30"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="relative px-5 sm:px-8">
              <div className="relative -mt-12 w-fit">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-orange-50 text-3xl font-semibold text-orange-800 shadow-md">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 shadow-sm hover:bg-orange-50"
                  aria-label="Edit profile photo"
                  aria-expanded={photoMenu}
                  onClick={() => setPhotoMenu((open) => !open)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                {photoMenu ? (
                  <div className="absolute left-24 top-16 z-10 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-orange-50"
                      onClick={() => {
                        setPhotoMenu(false);
                        photoRef.current?.pick();
                      }}
                    >
                      {avatarUrl ? "Change photo" : "Add photo"}
                    </button>
                    {avatarUrl ? (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          setPhotoMenu(false);
                          void photoRef.current?.remove();
                        }}
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 min-w-0 pb-4">
                {editingName ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveName()}
                      disabled={savingName || !nameDraft.trim()}
                      className="admin-btn-primary shrink-0"
                    >
                      {savingName ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn-secondary shrink-0"
                      onClick={() => {
                        setNameDraft(displayName);
                        setNameNote(null);
                        setEditingName(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-semibold text-slate-900">{displayName}</h2>
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-orange-50 hover:text-orange-700"
                      aria-label="Edit name"
                      onClick={() => {
                        setNameDraft(displayName);
                        setEditingName(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                )}
                <p className="truncate text-sm text-slate-500">{email}</p>
                {nameNote ? (
                  <p className={`mt-1 text-xs ${nameNote.tone === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                    {nameNote.text}
                  </p>
                ) : null}
              </div>
              <AdminProfilePhoto
                ref={photoRef}
                bare
                avatarUrl={avatarUrl}
                name={displayName}
                onChange={(next) => {
                  setAvatarUrl(next);
                  onAvatarChange?.(next);
                }}
              />
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-8">
              {loading ? (
                <p className="text-sm text-slate-500">Loading profile…</p>
              ) : (
                <>
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

                  <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center">
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
