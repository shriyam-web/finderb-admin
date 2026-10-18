"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import type { SiteMode } from "../lib/siteRuntime";
import {
  ADMIN_SESSION_ACTIVE_MS,
  formatDateTimeInr,
  formatDurationShort,
  parseFinderbTimestamp,
} from "../lib/formatDateTime";
import { PaginationControls, useClientPage } from "./AdminListControls";
import AdminChangePassword from "./AdminChangePassword";
import AdminOverlay from "./AdminOverlay";
import SiteModePanel from "./SiteModePanel";

export interface Settings {
  maintenance: boolean;
  imageCompression: boolean;
  [key: string]: boolean;
}

export interface LoginLog {
  id: string;
  admin_id?: string;
  admin_email: string;
  login_time: string;
  logout_at?: string | null;
  last_seen_at?: string | null;
}

function loginSessionView(log: LoginLog, now = Date.now()) {
  const loginAt = parseFinderbTimestamp(log.login_time)?.getTime() ?? null;
  const logoutAt = parseFinderbTimestamp(log.logout_at)?.getTime() ?? null;
  const lastSeenAt = parseFinderbTimestamp(log.last_seen_at)?.getTime() ?? null;

  if (logoutAt && loginAt) {
    return {
      status: "Signed out",
      statusClass: "admin-badge bg-slate-50 text-slate-600 border-slate-200",
      duration: formatDurationShort(logoutAt - loginAt),
    };
  }

  if (lastSeenAt && now - lastSeenAt <= ADMIN_SESSION_ACTIVE_MS && loginAt) {
    return {
      status: "Active",
      statusClass: "admin-badge bg-emerald-50 text-emerald-700 border-emerald-200",
      duration: formatDurationShort(now - loginAt),
    };
  }

  if (lastSeenAt && loginAt) {
    return {
      status: "Ended",
      statusClass: "admin-badge bg-slate-50 text-slate-600 border-slate-200",
      duration: formatDurationShort(lastSeenAt - loginAt),
    };
  }

  return {
    status: "Successful",
    statusClass: "admin-badge bg-emerald-50 text-emerald-700 border-emerald-200",
    duration: "—",
  };
}

export default function SettingsContent({
  settings,
  setSettings,
  loginLogs,
  canManage = false,
  canViewLoginLogs = false,
  isDeveloper = false,
  adminId = "",
  adminEmail = "",
  onSiteModeChange,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  loginLogs: LoginLog[];
  canManage?: boolean;
  canViewLoginLogs?: boolean;
  isDeveloper?: boolean;
  adminId?: string;
  adminEmail?: string;
  onSiteModeChange?: (mode: SiteMode) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [changingPassword, setChangingPassword] = useState(false);
  const loginPage = useClientPage(loginLogs, 10, String(loginLogs.length));

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const toggleSetting = async (key: string) => {
    if (!canManage) return;
    if (key === "imageCompression" && !settings.imageCompression) {
      alert(
        "Kindly switch to ImageKit CDN storage first to enable the image compression.",
      );
      return;
    }

    const newValue = !settings[key];
    const oldSettings = { ...settings };

    setSettings({ ...settings, [key]: newValue });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          { key, value: newValue, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );

      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error updating setting:", error);
      alert("Failed to update setting in database: " + message);
      setSettings(oldSettings);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="admin-page-title">Control Center</h1>
        <p className="admin-page-subtitle">
          Manage platform configurations and global system settings.
        </p>
        {!canManage && (
          <p className="text-xs text-amber-700 mt-1">
            View only — ask Controller for Edit on Settings.
          </p>
        )}
      </div>

      {adminId && adminEmail ? (
        <div className="admin-card max-w-xl p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Password</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Change the password for {adminEmail}. FinderB asks for your current password, then emails you a code, before the new password is saved.
            </p>
          </div>
          <button type="button" onClick={() => setChangingPassword(true)} className="admin-btn-primary shrink-0">
            Change password
          </button>
        </div>
      ) : null}

      {changingPassword && adminId && adminEmail ? (
        <AdminOverlay>
          <div className="admin-card w-full max-w-lg shadow-xl">
            <AdminChangePassword
              adminId={adminId}
              email={adminEmail}
              onClose={() => setChangingPassword(false)}
            />
          </div>
        </AdminOverlay>
      ) : null}

      {isDeveloper && adminId ? (
        <SiteModePanel adminId={adminId} onModeChange={onSiteModeChange} />
      ) : (
        <p className="text-xs text-slate-500 px-1">
          FinderB website mode (live, text only, maintenance) can only be changed by the Developer.
        </p>
      )}

      <div className="admin-card divide-y divide-slate-100 overflow-hidden max-w-xl">
        {[
          {
            key: "imageCompression",
            label: "Image Compression",
            desc: "Turning this on will store compressed images to ImageKit",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900">
                {item.label}
              </span>
              <span className="text-xs text-slate-500 mt-0.5">{item.desc}</span>
            </div>
            <button
              onClick={() => toggleSetting(item.key)}
              disabled={!canManage}
              className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 disabled:pointer-events-none ${settings[item.key] ? "bg-primary" : "bg-slate-200"}`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${settings[item.key] ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        ))}
      </div>

      {canViewLoginLogs && (
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5 px-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Login Activity
          </h2>
          <p className="admin-page-subtitle">
            Administrator sign-ins, session length, and when each session ended.
          </p>
        </div>

        <div className="admin-card space-y-3">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Admin email</th>
                  <th>Logged in</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loginLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty !py-10">
                      No login logs found. Sign out and sign in again — if logs
                      still don&apos;t appear, run{" "}
                      <code className="admin-mono">
                        db/admin_login_session_duration.sql
                      </code>{" "}
                      in Supabase.
                    </td>
                  </tr>
                ) : (
                  loginPage.pageItems.map((log) => {
                    const view = loginSessionView(log, now);
                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="admin-avatar">
                              {log.admin_email[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                              {log.admin_email}
                            </span>
                          </div>
                        </td>
                        <td>
                          <p className="text-sm text-slate-600 tabular-nums">
                            {formatDateTimeInr(log.login_time)}
                          </p>
                        </td>
                        <td>
                          <p className="text-sm font-medium text-slate-800 tabular-nums">
                            {view.duration}
                          </p>
                        </td>
                        <td>
                          <span className={view.statusClass}>{view.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <PaginationControls
              page={loginPage.page}
              totalPages={loginPage.totalPages}
              total={loginPage.total}
              pageSize={loginPage.pageSize}
              onPageChange={loginPage.setPage}
            />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
