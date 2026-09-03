"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createClient } from "../../utils/supabase/client";
import {
  allowedTabsFromModes,
  countGrantedTabs,
  modesFromAllowedTabs,
  type TabAccessMode,
} from "../lib/adminTabAccess";

export type AdminProfile = {
  id: string;
  email: string;
  password?: string;
  role: string;
  is_disabled: boolean;
  allowed_tabs: string[] | null;
  allowed_tab_modes?: Record<string, TabAccessMode> | null;
  created_at: string;
};

type AdminSession = {
  id: string;
  email: string;
  role: string;
};

/** Tabs controllers can assign (excludes Manage Admins). */
export const ASSIGNABLE_ADMIN_TABS = [
  "Dashboard",
  "Users",
  "Merchants",
  "Business Onboarding",
  "Quick Onboard",
  "Leads",
  "Categories",
  "Movies",
  "Tourist Places",
  "Payments & Subscriptions",
  "Broadcasts",
  "Blogs",
  "YouTube Playlists",
  "FinderB Jobs",
  "Settings",
] as const;

type Props = {
  admins: AdminProfile[];
  setAdmins: Dispatch<SetStateAction<AdminProfile[]>>;
  adminSession: AdminSession | null;
};

type RoleFilter = "all" | "controller" | "super_admin" | "admin";

function roleLabel(role: string) {
  return role.replace(/_/g, " ");
}

function roleBadgeClass(role: string) {
  if (role === "controller")
    return "admin-badge bg-slate-900 text-white border-slate-900";
  if (role === "super_admin")
    return "admin-badge bg-primary/10 text-primary border-primary/20";
  return "admin-badge bg-slate-50 text-slate-600 border-slate-200";
}

function initials(email: string) {
  const local = email.split("@")[0] || email;
  return local.slice(0, 2).toUpperCase();
}

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ManageAdminsContent({
  admins,
  setAdmins,
  adminSession,
}: Props) {
  const isController = adminSession?.role === "controller";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionsAdmin, setPermissionsAdmin] = useState<AdminProfile | null>(
    null,
  );
  const [draftModes, setDraftModes] = useState<Record<string, TabAccessMode>>(
    {},
  );
  const [savingTabs, setSavingTabs] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!permissionsAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPermissionsAdmin(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [permissionsAdmin]);

  const stats = useMemo(() => {
    const active = admins.filter((a) => !a.is_disabled).length;
    const disabled = admins.filter((a) => a.is_disabled).length;
    const controllers = admins.filter((a) => a.role === "controller").length;
    return { total: admins.length, active, disabled, controllers };
  }, [admins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins
      .filter((a) => {
        if (roleFilter !== "all" && a.role !== roleFilter) return false;
        if (!q) return true;
        return (
          a.email.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const rank = (r: string) =>
          r === "controller" ? 0 : r === "super_admin" ? 1 : 2;
        const byRole = rank(a.role) - rank(b.role);
        if (byRole !== 0) return byRole;
        return a.email.localeCompare(b.email);
      });
  }, [admins, search, roleFilter]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admins")
        .insert([
          {
            email: newEmail.toLowerCase().trim(),
            password: newPassword,
            role: "admin",
          },
        ])
        .select();

      if (error) {
        flash("Could not create admin: " + error.message);
      } else if (data?.[0]) {
        setAdmins((prev) => [...prev, data[0]]);
        setNewEmail("");
        setNewPassword("");
        setShowCreate(false);
        flash("Admin created");
      }
    } catch {
      flash("Could not create admin.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromoteToSuperAdmin = async (admin: AdminProfile) => {
    if (!isController) return flash("Only Controller can perform this action.");
    if (!confirm(`Promote ${admin.email} to super admin?`)) return;
    setActionBusyId(admin.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admins")
        .update({ role: "super_admin" })
        .eq("id", admin.id)
        .select();
      if (error) flash(error.message);
      else if (data?.[0]) {
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === admin.id ? { ...a, role: "super_admin" } : a,
          ),
        );
        flash("Promoted to super admin");
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDemoteToAdmin = async (admin: AdminProfile) => {
    if (!isController) return flash("Only Controller can perform this action.");
    if (!confirm(`Demote ${admin.email} to admin?`)) return;
    setActionBusyId(admin.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admins")
        .update({ role: "admin" })
        .eq("id", admin.id)
        .select();
      if (error) flash(error.message);
      else if (data?.[0]) {
        setAdmins((prev) =>
          prev.map((a) => (a.id === admin.id ? { ...a, role: "admin" } : a)),
        );
        flash("Demoted to admin");
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleDisable = async (admin: AdminProfile) => {
    if (!isController) return flash("Only Controller can perform this action.");
    const action = admin.is_disabled ? "enable" : "disable";
    if (!confirm(`Are you sure you want to ${action} ${admin.email}?`)) return;
    setActionBusyId(admin.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admins")
        .update({ is_disabled: !admin.is_disabled })
        .eq("id", admin.id)
        .select();
      if (error) flash(error.message);
      else if (data?.[0]) {
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === admin.id ? { ...a, is_disabled: !admin.is_disabled } : a,
          ),
        );
        flash(`Admin ${action}d`);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const openPermissions = (admin: AdminProfile) => {
    setPermissionsAdmin(admin);
    if (
      admin.allowed_tab_modes &&
      Object.keys(admin.allowed_tab_modes).length > 0
    ) {
      setDraftModes({ ...admin.allowed_tab_modes });
    } else {
      setDraftModes(modesFromAllowedTabs(admin.allowed_tabs));
    }
  };

  const handleSaveTabs = async () => {
    if (!isController || !permissionsAdmin) return;
    setSavingTabs(true);
    try {
      const allowed_tabs = allowedTabsFromModes(draftModes);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admins")
        .update({
          allowed_tabs,
          allowed_tab_modes: draftModes,
        })
        .eq("id", permissionsAdmin.id)
        .select();
      if (error) flash(error.message);
      else if (data?.[0]) {
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === permissionsAdmin.id
              ? {
                  ...a,
                  allowed_tabs,
                  allowed_tab_modes: draftModes,
                }
              : a,
          ),
        );
        setPermissionsAdmin(null);
        flash("Tab access updated");
      }
    } finally {
      setSavingTabs(false);
    }
  };

  const handleDeleteAdmin = async (admin: AdminProfile) => {
    if (admin.role === "super_admin" || admin.email === "admin@finderb.com") {
      flash("This admin cannot be deleted.");
      return;
    }
    if (!confirm(`Delete admin ${admin.email}? This cannot be undone.`)) return;
    setActionBusyId(admin.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admins")
        .delete()
        .eq("id", admin.id);
      if (error) flash(error.message);
      else {
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
        flash("Admin deleted");
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const setDraftTabMode = (tab: string, mode: TabAccessMode) => {
    setDraftModes((prev) => {
      const next = { ...prev };
      if (mode === "none") delete next[tab];
      else next[tab] = mode;
      return next;
    });
  };

  const grantedCount = countGrantedTabs(draftModes);

  const colSpan = isController ? 7 : 4;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2 text-[12px] font-medium text-white ">
          {toast}
        </div>
      )}

      <div className="admin-platform-hero">
        <div className="admin-page-header !mb-0">
          <div>
            <h1 className="admin-page-title">Admin management</h1>
            <p className="admin-page-subtitle">
              Create operators, change roles, and control which tabs each admin
              can open.
            </p>
          </div>
          {isController && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="admin-btn-primary self-start"
            >
              {showCreate ? "Close" : "Add admin"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="admin-metric-chip">
          Total <strong>{stats.total}</strong>
        </span>
        <span className="admin-metric-chip">
          Active <strong>{stats.active}</strong>
        </span>
        <span className="admin-metric-chip">
          Disabled <strong>{stats.disabled}</strong>
        </span>
        <span className="admin-metric-chip">
          Controllers <strong>{stats.controllers}</strong>
        </span>
      </div>

      {showCreate && isController && (
        <form onSubmit={handleCreateAdmin} className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Create admin</h2>
              <p className="admin-card-description">
                New accounts start as admin. Assign tabs after creation.
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Email
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="admin-input"
                placeholder="ops@finderb.com"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="admin-input pr-14"
                  placeholder="Min. 6 characters"
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-primary"
                  onClick={() => setShowNewPassword((v) => !v)}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="admin-btn-primary"
            >
              {isLoading ? "Creating…" : "Create admin"}
            </button>
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => {
                setShowCreate(false);
                setNewEmail("");
                setNewPassword("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="admin-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or role…"
            className="admin-search w-full"
          />
        </div>
        <div className="admin-segmented overflow-x-auto max-w-full">
          {(
            [
              ["all", "All"],
              ["controller", "Controller"],
              ["super_admin", "Super"],
              ["admin", "Admin"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRoleFilter(value)}
              className={`admin-segmented-btn whitespace-nowrap ${
                roleFilter === value ? "admin-segmented-btn-active" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:block admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Role</th>
                {isController && <th>Password</th>}
                {isController && <th>Access</th>}
                <th>Status</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((admin) => {
                const busy = actionBusyId === admin.id;
                const canMutate = isController && admin.role !== "controller";
                const isYou = adminSession?.email === admin.email;
                return (
                  <tr
                    key={admin.id}
                    className={admin.is_disabled ? "opacity-60" : undefined}
                  >
                    <td>
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="admin-avatar">
                          {initials(admin.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {admin.email}
                          </p>
                          {isYou && (
                            <p className="text-[11px] text-primary font-medium">
                              You
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <span className={roleBadgeClass(admin.role)}>
                          {roleLabel(admin.role)}
                        </span>
                        {canMutate && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              admin.role === "super_admin"
                                ? handleDemoteToAdmin(admin)
                                : handlePromoteToSuperAdmin(admin)
                            }
                            className="block text-[11px] font-medium text-primary hover:underline disabled:opacity-40"
                          >
                            {admin.role === "super_admin"
                              ? "Demote"
                              : "Promote"}
                          </button>
                        )}
                      </div>
                    </td>
                    {isController && (
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="admin-mono text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 min-w-[76px]">
                            {visiblePasswords[admin.id]
                              ? admin.password || "—"
                              : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setVisiblePasswords((p) => ({
                                ...p,
                                [admin.id]: !p[admin.id],
                              }))
                            }
                            className="text-[11px] font-medium text-slate-500 hover:text-primary"
                          >
                            {visiblePasswords[admin.id] ? "Hide" : "Show"}
                          </button>
                        </div>
                      </td>
                    )}
                    {isController && (
                      <td>
                        {admin.role === "controller" ? (
                          <span className="text-xs text-slate-500">
                            Full access
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPermissions(admin)}
                            className="text-[12px] font-medium text-primary hover:underline"
                          >
                            {admin.allowed_tabs?.length || 0} tabs
                          </button>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            admin.is_disabled
                              ? "text-rose-700"
                              : "text-emerald-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              admin.is_disabled
                                ? "bg-rose-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          {admin.is_disabled ? "Disabled" : "Active"}
                        </span>
                        {canMutate && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggleDisable(admin)}
                            className="text-[11px] font-medium text-slate-500 hover:text-primary disabled:opacity-40"
                          >
                            {admin.is_disabled ? "Enable" : "Disable"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-slate-600 tabular-nums whitespace-nowrap">
                        {formatJoined(admin.created_at)}
                      </span>
                    </td>
                    <td className="text-right">
                      {canMutate && admin.email !== "admin@finderb.com" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteAdmin(admin)}
                          className="admin-icon-btn-danger disabled:opacity-40"
                          title="Delete"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="admin-empty">
                    {admins.length === 0
                      ? "No admins yet"
                      : "No admins match your filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden space-y-2">
        {filtered.map((admin) => {
          const busy = actionBusyId === admin.id;
          const canMutate = isController && admin.role !== "controller";
          return (
            <article
              key={admin.id}
              className={`admin-card p-3.5 space-y-3 ${admin.is_disabled ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="admin-avatar shrink-0">
                  {initials(admin.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 break-all">
                    {admin.email}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={roleBadgeClass(admin.role)}>
                      {roleLabel(admin.role)}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        admin.is_disabled ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {admin.is_disabled ? "Disabled" : "Active"}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      · {formatJoined(admin.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {isController && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <span className="admin-mono text-[11px] text-slate-700">
                    {visiblePasswords[admin.id]
                      ? admin.password || "—"
                      : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setVisiblePasswords((p) => ({
                        ...p,
                        [admin.id]: !p[admin.id],
                      }))
                    }
                    className="text-[11px] font-semibold text-primary"
                  >
                    {visiblePasswords[admin.id] ? "Hide" : "Show"}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {isController && admin.role !== "controller" && (
                  <button
                    type="button"
                    onClick={() => openPermissions(admin)}
                    className="admin-btn-secondary !px-2.5 !py-1.5 !text-[11px]"
                  >
                    {admin.allowed_tabs?.length || 0} tabs
                  </button>
                )}
                {canMutate && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        admin.role === "super_admin"
                          ? handleDemoteToAdmin(admin)
                          : handlePromoteToSuperAdmin(admin)
                      }
                      className="admin-btn-secondary !px-2.5 !py-1.5 !text-[11px] disabled:opacity-40"
                    >
                      {admin.role === "super_admin" ? "Demote" : "Promote"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleDisable(admin)}
                      className="admin-btn-secondary !px-2.5 !py-1.5 !text-[11px] disabled:opacity-40"
                    >
                      {admin.is_disabled ? "Enable" : "Disable"}
                    </button>
                    {admin.email !== "admin@finderb.com" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteAdmin(admin)}
                        className="admin-btn-danger !px-2.5 !py-1.5 !text-[11px] disabled:opacity-40"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="admin-card px-4 py-10 text-center text-sm text-slate-400">
            {admins.length === 0
              ? "No admins yet"
              : "No admins match your filters"}
          </div>
        )}
      </div>

      {permissionsAdmin && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setPermissionsAdmin(null)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] overflow-hidden rounded-t-xl sm:rounded-lg border border-slate-200 bg-white flex flex-col ">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Tab access
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 break-all">
                {permissionsAdmin.email}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                Choose None, Read, or Edit for each tab. Read can view but not
                change data. Edit includes full actions for that tab.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraftModes(
                      Object.fromEntries(
                        ASSIGNABLE_ADMIN_TABS.map((tab) => [tab, "edit"]),
                      ),
                    )
                  }
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  All edit
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setDraftModes(
                      Object.fromEntries(
                        ASSIGNABLE_ADMIN_TABS.map((tab) => [tab, "read"]),
                      ),
                    )
                  }
                  className="text-[11px] font-semibold text-slate-600 hover:underline"
                >
                  All read
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setDraftModes({})}
                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                >
                  Clear
                </button>
                <span className="ml-auto text-[11px] tabular-nums text-slate-400">
                  {grantedCount}/{ASSIGNABLE_ADMIN_TABS.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {ASSIGNABLE_ADMIN_TABS.map((tab) => {
                const mode = draftModes[tab] ?? "none";
                return (
                  <div
                    key={tab}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-md px-2.5 py-2 ${
                      mode !== "none" ? "bg-primary/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[13px] font-medium text-slate-800 sm:min-w-[10.5rem]">
                      {tab}
                    </span>
                    <div className="inline-flex rounded-md border border-slate-200 overflow-hidden ml-auto">
                      {(
                        [
                          ["none", "None"],
                          ["read", "Read"],
                          ["edit", "Edit"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDraftTabMode(tab, value)}
                          className={`px-2.5 py-1 text-[11px] font-semibold ${
                            mode === value
                              ? value === "edit"
                                ? "bg-teal-700 text-white"
                                : value === "read"
                                  ? "bg-slate-700 text-white"
                                  : "bg-slate-200 text-slate-700"
                              : "bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setPermissionsAdmin(null)}
                className="admin-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingTabs}
                onClick={handleSaveTabs}
                className="admin-btn-primary flex-1"
              >
                {savingTabs ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
