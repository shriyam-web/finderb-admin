"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: username.trim(),
          password,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        admin?: {
          id: string;
          email: string;
          role: string;
          allowed_tabs: string[] | null;
          displayName?: string | null;
        };
      };

      if (!response.ok || !result.success || !result.admin) {
        setError(result.error || "Incorrect email or password. Please try again.");
        setIsLoading(false);
        return;
      }

      localStorage.setItem(
        "admin_session",
        JSON.stringify({
          email: result.admin.email,
          role: result.admin.role,
          id: result.admin.id,
          allowed_tabs: result.admin.allowed_tabs,
          displayName: result.admin.displayName ?? null,
        }),
      );

      router.push("/dashboard");
    } catch {
      setError("An error occurred during login.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden border-r border-slate-800 bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(45,212,191,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <Image
              src="/logo1.png"
              alt="FinderB"
              width={168}
              height={48}
              className="object-contain drop-shadow-[0_0_24px_rgba(45,212,191,0.3)]"
              priority
            />
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-1 text-[11px] font-medium text-teal-200">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />
              Control deck · secure access
            </div>
          </div>

          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="text-3xl xl:text-4xl font-semibold leading-tight tracking-tight text-white">
                Operate FinderB with clarity and speed.
              </h2>
              <p className="text-slate-300 text-base leading-relaxed mt-4">
                Merchants, teams, payments, and content — one high-signal
                console for your ops team.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Merchant ops", desc: "KYC · listings · plans" },
                { label: "Team access", desc: "Roles · permissions" },
                { label: "Revenue", desc: "Subs · Razorpay" },
                { label: "Content", desc: "Media · jobs · blogs" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} FinderB Technologies · Authorized
            personnel only
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex flex-col items-center mb-10 rounded-2xl bg-slate-950 px-6 py-5 border border-slate-800">
            <Image
              src="/logo1.png"
              alt="FinderB"
              width={150}
              height={44}
              className="object-contain"
              priority
            />
            <p className="mt-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-teal-200/80">
              Control deck
            </p>
          </div>

          <div className="admin-card p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign in
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 font-medium">
                Use your authorized admin credentials
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && <div className="admin-alert-error">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="username"
                    className="admin-label block mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="email"
                    required
                    autoComplete="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="admin-input"
                    placeholder="admin@finderb.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="admin-label block mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="admin-input pr-11"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
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
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                          />
                        </svg>
                      ) : (
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="admin-btn-primary w-full py-2.5"
              >
                {isLoading ? "Authenticating..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
