"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export interface Settings {
  maintenance: boolean;
  imageCompression: boolean;
  [key: string]: boolean;
}

interface LoginLog {
  id: string;
  admin_email: string;
  login_time: string;
}

export default function SettingsContent({ settings, setSettings }: { 
  settings: Settings, 
  setSettings: Dispatch<SetStateAction<Settings>> 
}) {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('admin_login_logs')
        .select('*')
        .order('login_time', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (key: string) => {
    if (key === 'imageCompression' && !settings.imageCompression) {
      alert("Kindly switch to ImageKit CDN storage first to enable the image compression.");
      return;
    }
    
    const newValue = !settings[key];
    const oldSettings = { ...settings };
    
    // Optimistic update
    setSettings({ ...settings, [key]: newValue });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key, value: newValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating setting:', error);
      alert("Failed to update setting in database: " + error.message);
      // Rollback on error
      setSettings(oldSettings);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="text-xl font-medium text-slate-900 tracking-tight uppercase">Control Center</h1>
        <p className="text-[10px] text-slate-500 font-normal uppercase tracking-widest opacity-70">Manage platform configurations and global system settings.</p>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm divide-y divide-slate-50/80 overflow-hidden max-w-xl">
        {[
          { key: 'maintenance', label: 'Maintenance Mode', desc: 'Enable maintenance mode to restrict access to the platform.' },
          { key: 'imageCompression', label: 'Image Compression', desc: 'Turning this on will store compressed images to ImageKit' },
        ].map((item) => (
          <div key={item.key} className="p-5 flex items-center justify-between hover:bg-primary/[0.01] transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-900 capitalize tracking-tight">{item.label}</span>
              <span className="text-[9px] text-secondary font-medium uppercase tracking-widest mt-0.5">
                {item.desc}
              </span>
            </div>
            <button
              onClick={() => toggleSetting(item.key)}
              className={`w-11 h-6 rounded-full relative transition-all duration-300 ${settings[item.key] ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${settings[item.key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1.5 px-1">
          <h2 className="text-xl font-medium text-slate-900 tracking-tight uppercase">Login Activity</h2>
          <p className="text-[10px] text-slate-500 font-normal uppercase tracking-widest opacity-70">Recent administrator login history and system access logs.</p>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Admin Email</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Login Time</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[11px] text-slate-400 uppercase tracking-widest animate-pulse">
                    Loading access logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[11px] text-slate-400 uppercase tracking-widest">
                    No login logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-primary/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200 group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all uppercase">
                          {log.admin_email[0]}
                        </div>
                        <span className="text-[11px] font-medium text-slate-900 tracking-tight">{log.admin_email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-600 tabular-nums">
                          {new Date(log.login_time).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                        <span className="text-[9px] text-slate-400 tabular-nums mt-0.5 uppercase">
                          {new Date(log.login_time).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-medium uppercase tracking-widest">
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
