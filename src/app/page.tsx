"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin@finderb.com" && password === "finderb123") {
      router.push("/dashboard");
    } else {
      setError("Incorrect email or password. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#f9fafb]">
      <div className="w-full max-w-[400px] space-y-8 bg-white p-8 rounded-xl shadow-sm border border-[#e5e7eb]">
        <div className="flex flex-col items-center">
          <div className="mb-6">
            <Image
              src="/logo1.png"
              alt="FinderB"
              width={200}
              height={60}
              className="rounded-lg object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/next.svg";
              }}
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-[#111827]">
            Sign in to FinderB Admin
          </h1>
          <p className="mt-2 text-sm text-[#6b7280]">
            Enter your credentials to access the portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="px-4 py-3 text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fee2e2] rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#374151] mb-1.5">
                Email Address
              </label>
              <input
                id="username"
                name="username"
                type="email"
                required
                autoComplete="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-white border border-[#d1d5db] rounded-lg text-[#111827] text-sm placeholder-[#9ca3af] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none transition-all shadow-sm"
                placeholder="admin@finderb.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-[#374151]">
                  Password
                </label>
                <a href="#" className="text-xs font-semibold text-[#2563eb] hover:underline">
                  Forgot?
                </a>
              </div>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-white border border-[#d1d5db] rounded-lg text-[#111827] text-sm placeholder-[#9ca3af] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none transition-all shadow-sm pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#9ca3af] hover:text-[#4b5563] transition-colors rounded-md hover:bg-[#f3f4f6]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#111827] hover:bg-[#1f2937] active:bg-[#030712] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#111827]"
          >
            Sign In
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-[#9ca3af]">
            &copy; {new Date().getFullYear()} FinderB Technologies Inc.
          </p>
        </div>
      </div>
    </div>
  );
}
