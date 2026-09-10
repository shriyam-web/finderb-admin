"use client";

import { useEffect, useRef, useState } from "react";
import { AdminPortal } from "./AdminOverlay";

const LOCKOUT_SECONDS = 30;

type Props = {
  seconds?: number;
  onLogout: () => void;
};

export default function SuspiciousLoginModal({
  seconds = LOCKOUT_SECONDS,
  onLogout,
}: Props) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setInterval(() => {
      setLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => {
      window.clearInterval(id);
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (left > 0 || done.current) return;
    done.current = true;
    onLogout();
  }, [left, onLogout]);

  return (
    <AdminPortal>
      <div
        className="fixed inset-0 z-[400] flex items-center justify-center px-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="suspicious-login-title"
        aria-describedby="suspicious-login-copy"
      >
        <div className="absolute inset-0 bg-[#140608]/90 backdrop-blur-sm" />
        <div className="relative w-full max-w-[28rem] overflow-hidden rounded-2xl border border-rose-500/40 bg-[#1a0b0e] shadow-[0_24px_80px_rgba(127,29,29,0.55)]">
          <div className="h-1 w-full bg-gradient-to-r from-rose-700 via-amber-400 to-rose-700" />
          <div className="px-6 py-7 sm:px-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/10 text-rose-300">
              <svg
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-300">
              Security alert
            </p>
            <h2
              id="suspicious-login-title"
              className="mt-2 text-2xl font-bold tracking-tight text-white"
            >
              Suspicious activity detected
            </h2>
            <p
              id="suspicious-login-copy"
              className="mt-3 text-sm leading-relaxed text-rose-100/80"
            >
              You&apos;ll be auto logged out in{" "}
              <span className="font-semibold tabular-nums text-amber-300">
                {left} {left === 1 ? "second" : "seconds"}
              </span>
              .
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${(left / seconds) * 100}%` }}
              />
            </div>
            <p className="mt-4 text-[11px] text-rose-200/50">
              This session cannot continue. Contact a Developer to enable login.
            </p>
          </div>
        </div>
      </div>
    </AdminPortal>
  );
}
