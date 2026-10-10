"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
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
import OtpCodeBoxes from "../components/OtpCodeBoxes";

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

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"password" | "email">("password");
  const [challenge, setChallenge] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Login must stay light — clear leftover dark/controller theme from prior session.
    const root = document.documentElement;
    root.removeAttribute("data-admin-theme");
    root.classList.remove(
      "admin-theme-controller",
      "admin-theme-dark",
      "admin-theme-silver",
    );
    document.body.classList.remove(
      "admin-theme-controller",
      "admin-theme-dark",
      "admin-theme-silver",
    );

    const session = localStorage.getItem("admin_session");
    if (session) {
      router.push("/dashboard");
    }
  }, [router]);

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
      setResendIn(90);
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
      }),
    );
    router.push("/dashboard");
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
        setError(result.error || "That code was not accepted.");
        setCodeInvalid(true);
        setOtpCode("");
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
      };
      if (!response.ok || !result.success || !result.challenge) {
        setError(result.error || "Could not resend the code.");
        setIsLoading(false);
        return;
      }
      setChallenge(result.challenge);
      setResendIn(90);
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

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <aside className="relative hidden w-[46%] overflow-hidden border-r border-slate-800! bg-slate-950 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(45,212,191,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)",
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-6 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-4">
            <Image src="/logo-white.png" alt="FinderB" width={151} height={34} className="object-contain" priority />
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30! bg-teal-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
              Control deck
            </span>
          </div>

          <div className="max-w-md space-y-10">
            <div>
              <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
                Operate FinderB with{" "}
                <span className="bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent">
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
                  className="rounded-xl border border-white/10! bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm transition-colors hover:border-teal-400/30! hover:bg-white/[0.07]"
                >
                  <span className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 rounded-xl border border-white/10! bg-white/[0.03] px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-teal-300" aria-hidden />
              <p className="text-xs leading-relaxed text-slate-300">
                Every sign-in needs your password and a one-time email code. Console activity is logged.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} FinderB Technologies · Authorized personnel only
          </p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-12 flex flex-col items-start lg:hidden">
            <Image src="/logo1.png" alt="FinderB" width={151} height={34} className="object-contain" priority />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
              Control deck
            </p>
          </div>

          <div>
            <div className="mb-8 flex items-center gap-1.5" aria-label={`Step ${isEmailStep ? 2 : 1} of 2`}>
              <span className="h-1 w-8 rounded-full bg-teal-600" />
              <span className={`h-1 w-8 rounded-full transition-colors duration-300 ${isEmailStep ? "bg-teal-600" : "bg-slate-200"}`} />
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Step {isEmailStep ? 2 : 1} of 2
              </span>
            </div>

            <div className="mb-9">
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-slate-900">
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
                      onChange={(e) => setUsername(e.target.value)}
                      className={`${LINE_INPUT} pr-2`}
                      placeholder="admin@finderb.com"
                    />
                    <span className={LINE_FOCUS_BAR} aria-hidden />
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="admin-btn-primary mt-9! h-11 w-full text-[15px] font-semibold"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                      Checking…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>
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
