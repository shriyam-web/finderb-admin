"use client";

import Image from "next/image";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  IndianRupee,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Newspaper,
  RotateCw,
  ShieldCheck,
  Store,
  UsersRound,
} from "lucide-react";
import AdminEntryScreen, { markAdminEntryHandoff } from "../components/AdminEntryScreen";
import { applyAdminConsoleTheme, readLaunchTheme } from "../lib/adminColorMode";
import OtpCodeBoxes from "../components/OtpCodeBoxes";
import PwaInstallButton from "../components/PwaInstallButton";

type AdminPayload = {
  id: string;
  email: string;
  role: string;
  allowed_tabs: string[] | null;
  allowed_tab_modes?: Record<string, string> | null;
  displayName?: string | null;
  loginEnabled?: boolean;
};

const HIGHLIGHTS = [
  { label: "Merchant ops", desc: "KYC, listings and plans", Icon: Store },
  { label: "Team access", desc: "Roles and permissions", Icon: UsersRound },
  { label: "Revenue", desc: "Subscriptions and Razorpay", Icon: IndianRupee },
  { label: "Content", desc: "Media, jobs and blogs", Icon: Newspaper },
];

const LINE_LABEL = "block text-[13px] font-medium text-slate-600";
const LINE_ICON =
  "pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600";
const LINE_INPUT =
  "peer block h-12 w-full rounded-none border-0 border-b border-slate-300! bg-transparent pl-7 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400! focus:ring-0 autofill:shadow-[inset_0_0_0_1000px_#fff]";
const LINE_FOCUS_BAR =
  "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-teal-600 transition-transform duration-300 peer-focus:scale-x-100";

const EMAIL_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "rediffmail.com",
  "finderb.com",
];

function SlideToContinue({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: (form: HTMLFormElement | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const drag = useRef<{ pointer: number; origin: number } | null>(null);
  const [x, setX] = useState(0);

  const limit = () => Math.max(0, (trackRef.current?.clientWidth ?? 0) - 48);

  useEffect(() => {
    if (busy) return;
    xRef.current = 0;
    setX(0);
  }, [busy]);

  const moveTo = (value: number) => {
    const next = Math.min(limit(), Math.max(0, value));
    xRef.current = next;
    setX(next);
  };

  return (
    <div
      ref={trackRef}
      className="admin-slide relative mt-9 h-12 w-full touch-none overflow-hidden rounded-full bg-stone-100"
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-8 text-sm font-medium text-stone-500">
        {busy ? "Checking…" : "Slide to continue"}
      </span>
      <button
        type="button"
        disabled={busy}
        aria-label="Slide to continue"
        onPointerDown={(event) => {
          if (busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointer: event.clientX, origin: xRef.current };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          moveTo(drag.current.origin + event.clientX - drag.current.pointer);
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current = null;
          if (xRef.current >= limit() - 8) {
            const form = trackRef.current?.closest("form") ?? null;
            if (form && !form.checkValidity()) {
              form.reportValidity();
              moveTo(0);
              return;
            }
            moveTo(limit());
            onConfirm(form);
            return;
          }
          moveTo(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          moveTo(0);
        }}
        className="absolute top-1 left-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#ea580c] text-white disabled:opacity-60"
        style={{ transform: `translateX(${x}px)` }}
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

function emailDomainSuggestions(value: string): string[] {
  const at = value.lastIndexOf("@");
  if (at <= 0) return [];
  const local = value.slice(0, at);
  if (!local.trim() || /\s/.test(local)) return [];
  const typed = value.slice(at + 1).toLowerCase();
  return EMAIL_DOMAINS.filter((domain) => domain.startsWith(typed) && domain !== typed).map(
    (domain) => `${local}@${domain}`,
  );
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [emailHint, setEmailHint] = useState(0);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"password" | "email">("password");
  const [challenge, setChallenge] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [gate, setGate] = useState<"entry" | "form">("entry");
  const router = useRouter();

  useLayoutEffect(() => {
    if (new URLSearchParams(window.location.search).get("form") === "1") {
      window.history.replaceState(null, "", "/");
      setGate("form");
    }
    applyAdminConsoleTheme(readLaunchTheme());
  }, [gate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

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
        step?: "email";
        challenge?: string;
        retryAfter?: number;
      };

      if (!response.ok || !result.success) {
        setError(result.error || "Incorrect email or password. Please try again.");
        setIsLoading(false);
        return;
      }
      if (result.step !== "email" || !result.challenge) {
        setError("Could not start email verification.");
        setIsLoading(false);
        return;
      }
      setChallenge(result.challenge);
      setOtpCode("");
      setCodeInvalid(false);
      setResendIn(typeof result.retryAfter === "number" ? result.retryAfter : 60);
      setStep("email");
      setIsLoading(false);
    } catch {
      setError("An error occurred during login.");
      setIsLoading(false);
    }
  };

  const finishSession = (
    admin: AdminPayload,
    loginLogId?: string | null,
    token?: string,
  ) => {
    localStorage.setItem(
      "admin_session",
      JSON.stringify({
        token: token || "",
        email: admin.email,
        role: admin.role,
        id: admin.id,
        allowed_tabs: admin.allowed_tabs,
        allowed_tab_modes: admin.allowed_tab_modes ?? null,
        displayName: admin.displayName ?? null,
        loginEnabled: admin.loginEnabled === true,
        loginLogId: loginLogId || null,
        startedAt: new Date().toISOString(),
      }),
    );
    router.push("/dashboard?from=login");
  };

  const verifyCode = async (code: string) => {
    if (isLoading || code.length !== 6) return;
    setError("");
    setCodeInvalid(false);
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, code }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        loginLogId?: string | null;
        sessionToken?: string;
        admin?: AdminPayload;
      };
      if (!response.ok || !result.success || !result.admin) {
        if (result.error?.toLowerCase().includes("password again")) {
          setStep("password");
          setChallenge("");
          setOtpCode("");
          setCodeInvalid(false);
        } else {
          setCodeInvalid(true);
          setOtpCode("");
        }
        setError(result.error || "That code was not accepted.");
        setIsLoading(false);
        return;
      }
      finishSession(result.admin, result.loginLogId, result.sessionToken);
    } catch {
      setError("Could not check that code.");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || isLoading) return;
    setError("");
    setCodeInvalid(false);
    setIsLoading(true);
    setOtpCode("");
    try {
      const response = await fetch("/api/admin/login/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, resend: true }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        challenge?: string;
        retryAfter?: number;
      };
      if (!response.ok || !result.success || !result.challenge) {
        if (typeof result.retryAfter === "number") setResendIn(result.retryAfter);
        if (result.error?.toLowerCase().includes("password again")) {
          setStep("password");
          setChallenge("");
          setOtpCode("");
        }
        setError(result.error || "Could not resend the code.");
        setIsLoading(false);
        return;
      }
      setChallenge(result.challenge);
      setResendIn(typeof result.retryAfter === "number" ? result.retryAfter : 60);
      setIsLoading(false);
    } catch {
      setError("Could not resend the code.");
      setIsLoading(false);
    }
  };

  const backToPassword = () => {
    setStep("password");
    setChallenge("");
    setOtpCode("");
    setCodeInvalid(false);
    setResendIn(0);
    setError("");
  };

  const isEmailStep = step === "email";
  const emailSuggestions = emailDomainSuggestions(username);

  if (gate === "entry") {
    return (
      <AdminEntryScreen
        onResolved={(destination) => {
          if (destination === "dashboard") {
            markAdminEntryHandoff();
            router.push("/dashboard");
            return;
          }
          setGate("form");
        }}
      />
    );
  }

  return (
    <div className="admin-login flex min-h-screen bg-[#f5f7fa]">
      <aside className="admin-login-hero relative hidden w-[46%] overflow-hidden border-r border-white/10 bg-[#0c0a09] text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(253,186,116,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(253,186,116,0.14) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)",
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-6 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-orange-400/10 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-[0.4em] text-xl font-normal leading-none tracking-tight text-white">
            <Image src="/fb-mark.png" alt="" width={20} height={20} className="h-[1em] w-[1em] object-contain" priority />
            <span>Admin</span>
          </div>

          <div className="max-w-md space-y-10">
            <div>
              <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
                Operate FinderB with{" "}
                <span className="text-orange-200">
                  clarity and speed.
                </span>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Merchants, teams, payments, and content — one high-signal console for your ops team.
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map(({ label, desc, Icon }) => (
                <li
                  key={label}
                  className="admin-login-card rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 backdrop-blur-sm transition-colors hover:border-teal-400/30 hover:bg-white/[0.08]"
                >
                  <span className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
                </li>
              ))}
            </ul>

            <div className="admin-login-card flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-teal-300" aria-hidden />
              <p className="text-xs leading-relaxed text-slate-300">
                Every sign-in needs your password and a one-time email code. Console activity is logged.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Maagaa Connect Private Limited · Authorized personnel only
          </p>
        </div>
      </aside>

      <main className="admin-login-panel flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-[0.4em] text-lg font-normal leading-none tracking-tight text-slate-800">
              <Image src="/fb-mark.png" alt="" width={18} height={18} className="h-[1em] w-[1em] object-contain" priority />
              <span>Admin</span>
            </div>
            <PwaInstallButton />
          </div>

          <div>
            <div className="mb-9">
              <h1 className="text-[1.75rem] font-normal tracking-tight text-slate-900">
                {isEmailStep ? "Check your email" : "Welcome back"}
              </h1>
              {isEmailStep ? (
                <p className="mt-1.5 text-sm text-slate-500">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-slate-800">{username.trim() || "your email"}</span>
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-slate-500">Sign in with your authorized admin credentials.</p>
              )}
            </div>

            {error && (
              <div className="admin-alert-error mb-5 flex items-start gap-2.5 py-3" role="alert">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {isEmailStep ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyCode(otpCode);
                }}
                className="space-y-6"
              >
                <OtpCodeBoxes
                  value={otpCode}
                  onChange={(value) => {
                    setOtpCode(value);
                    if (codeInvalid) setCodeInvalid(false);
                    if (error) setError("");
                  }}
                  onComplete={(code) => void verifyCode(code)}
                  disabled={isLoading}
                  invalid={codeInvalid}
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="admin-btn-primary h-11 w-full text-[15px] font-semibold"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify and continue
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between border-t border-slate-100! pt-5 text-sm">
                  <button
                    type="button"
                    onClick={backToPassword}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-slate-900"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Change account
                  </button>
                  <button
                    type="button"
                    disabled={isLoading || resendIn > 0}
                    onClick={() => void handleResend()}
                    className="inline-flex items-center gap-1.5 font-semibold text-teal-700 transition-colors hover:text-teal-900 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <RotateCw className="h-3.5 w-3.5" aria-hidden />
                    {resendIn > 0
                      ? `Resend in ${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, "0")}`
                      : "Resend code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-7">
                <div>
                  <label htmlFor="username" className={LINE_LABEL}>
                    Email address
                  </label>
                  <div className="group relative">
                    <Mail className={LINE_ICON} aria-hidden />
                    <input
                      id="username"
                      name="username"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setEmailHint(0);
                      }}
                      onKeyDown={(event) => {
                        if (!emailSuggestions.length) return;
                        if (emailHint < 0) {
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setEmailHint(0);
                          }
                          return;
                        }
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setEmailHint((index) => (index + 1) % emailSuggestions.length);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setEmailHint((index) => (index - 1 + emailSuggestions.length) % emailSuggestions.length);
                        } else if (event.key === "Enter" || event.key === "Tab") {
                          event.preventDefault();
                          setUsername(emailSuggestions[emailHint] ?? emailSuggestions[0]);
                          setEmailHint(0);
                        } else if (event.key === "Escape") {
                          setEmailHint(-1);
                        }
                      }}
                      className={`${LINE_INPUT} pr-2`}
                      placeholder="Enter your email"
                      role="combobox"
                      aria-expanded={emailSuggestions.length > 0 && emailHint >= 0}
                      aria-autocomplete="list"
                    />
                    <span className={LINE_FOCUS_BAR} aria-hidden />
                    {emailSuggestions.length > 0 && emailHint >= 0 && (
                      <ul
                        className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
                        role="listbox"
                      >
                        {emailSuggestions.map((suggestion, index) => (
                          <li key={suggestion}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={index === emailHint}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setUsername(suggestion);
                                setEmailHint(0);
                              }}
                              className={`block w-full px-3 py-2 text-left text-sm ${
                                index === emailHint
                                  ? "bg-slate-100 text-slate-900"
                                  : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {suggestion}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="password" className={LINE_LABEL}>
                    Password
                  </label>
                  <div className="group relative">
                    <LockKeyhole className={LINE_ICON} aria-hidden />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${LINE_INPUT} pr-10`}
                      placeholder="Enter your password"
                    />
                    <span className={LINE_FOCUS_BAR} aria-hidden />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </div>

                <SlideToContinue
                  busy={isLoading}
                  onConfirm={(form) => form?.requestSubmit()}
                />
              </form>
            )}
          </div>

          <p className="mt-10 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Protected by 2-step email verification
          </p>
        </div>
      </main>
    </div>
  );
}
