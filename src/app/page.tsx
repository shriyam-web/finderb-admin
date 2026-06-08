"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem("admin_session");
    if (session) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('admins')
        .select('*')
        .ilike('email', username)
        .eq('password', password)
        .single();

      if (fetchError || !data) {
        setError("Incorrect email or password. Please try again.");
        setIsLoading(false);
        return;
      }

      if (data.is_disabled) {
        setError("Your account has been disabled. Please contact the Controller.");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("admin_session", JSON.stringify({
        email: data.email,
        role: data.role,
        id: data.id,
        allowed_tabs: data.allowed_tabs
      }));

      const { error: logError } = await supabase.from('admin_login_logs').insert([{
        admin_id: data.id,
        admin_email: data.email
      }]);

      if (logError) {
        console.error("Failed to record login activity:", logError.message);
      }

      router.push("/dashboard");
    } catch {
      setError("An error occurred during login.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0e17]">
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden">
        <div className="admin-platform-hero-grid absolute inset-0 opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e17] via-[#12334b] to-[#1a5276]" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
          <div>
            <Image src="/logo1.png" alt="FinderB" width={150} height={44} className="object-contain brightness-0 invert opacity-95" priority />
            <p className="mt-3 text-[11px] font-semibold tracking-[0.18em] text-slate-400">CONTROL CENTER</p>
          </div>

          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight">
                The nerve center of the FinderB platform
              </h2>
              <p className="text-slate-300 text-base leading-relaxed mt-4">
                Govern users, partners, content, and system operations for a platform built to scale to millions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "User operations", desc: "Accounts & access" },
                { label: "Partner network", desc: "KYC & verification" },
                { label: "Content pipeline", desc: "Media & listings" },
                { label: "System control", desc: "Settings & admins" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} FinderB Technologies · Authorized personnel only</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-[#eef0f4]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex flex-col items-center mb-10">
            <Image src="/logo1.png" alt="FinderB" width={150} height={44} className="object-contain" priority />
            <p className="mt-2 text-xs font-semibold tracking-widest text-slate-500">CONTROL CENTER</p>
          </div>

          <div className="admin-card p-8 shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
            <div className="mb-7">
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Sign in to console</h1>
              <p className="mt-1.5 text-sm text-slate-500">Use your authorized admin credentials</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && <div className="admin-alert-error">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="admin-label block mb-1.5">Email address</label>
                  <input id="username" name="username" type="email" required autoComplete="email" value={username} onChange={(e) => setUsername(e.target.value)} className="admin-input" placeholder="admin@finderb.com" />
                </div>
                <div>
                  <label htmlFor="password" className="admin-label block mb-1.5">Password</label>
                  <div className="relative">
                    <input id="password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="admin-input pr-11" placeholder="Enter your password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 admin-btn-ghost !p-2" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="admin-btn-primary w-full py-2.5">
                {isLoading ? "Authenticating..." : "Access control panel"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
