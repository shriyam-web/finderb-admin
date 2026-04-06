"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin@boomb.in" && password === "boomb123") {
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
              src="/logo.png"
              alt="Boomb"
              width={40}
              height={40}
              className="rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/next.svg";
              }}
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-[#111827]">
            Sign in to Boomb Admin
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
                placeholder="admin@boomb.in"
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
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3.5 py-2.5 bg-white border border-[#d1d5db] rounded-lg text-[#111827] text-sm placeholder-[#9ca3af] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none transition-all shadow-sm"
                placeholder="••••••••"
              />
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
            &copy; {new Date().getFullYear()} Boomb Technologies Inc.
          </p>
        </div>
      </div>
    </div>
  );
}
