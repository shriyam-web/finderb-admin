"use client";

import { Dispatch, SetStateAction } from "react";
import { createClient } from "../../utils/supabase/client";

export interface Settings {
  maintenance: boolean;
  imageCompression: boolean;
  [key: string]: boolean;
}

export interface LoginLog {
  id: string;
  admin_email: string;
  login_time: string;
}

export default function SettingsContent({
  settings,
  setSettings,
  loginLogs,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  loginLogs: LoginLog[];
}) {
  const toggleSetting = async (key: string) => {
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
      </div>

      <div className="admin-card divide-y divide-slate-100 overflow-hidden max-w-xl">
        {[
          {
            key: "maintenance",
            label: "Maintenance Mode",
            desc: "Enable maintenance mode to restrict access to the platform.",
          },
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
              className={`w-11 h-6 rounded-full relative transition-colors ${settings[item.key] ? "bg-primary" : "bg-slate-200"}`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${settings[item.key] ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1.5 px-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Login Activity
          </h2>
          <p className="admin-page-subtitle">
            Recent administrator login history and system access logs.
          </p>
        </div>

        <div className="admin-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin email</th>
                <th>Login time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loginLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-empty !py-10">
                    No login logs found. Sign out and sign in again — if logs
                    still don&apos;t appear, run{" "}
                    <code className="admin-mono">
                      db/update_admin_login_logs_rls.sql
                    </code>{" "}
                    in Supabase.
                  </td>
                </tr>
              ) : (
                loginLogs.map((log) => (
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
                        {new Date(log.login_time).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                        {new Date(log.login_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </td>
                    <td>
                      <span className="admin-badge bg-emerald-50 text-emerald-700 border-emerald-200">
                        Successful
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
