"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const BOOT_STEPS = [
  "Verifying your session",
  "Checking role & permissions",
  "Preparing your console",
  "Almost ready",
];

export default function AdminBootLoader() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % BOOT_STEPS.length);
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="admin-boot" role="status" aria-live="polite">
      <div className="admin-boot-aurora" aria-hidden />
      <div className="admin-boot-grid" aria-hidden />

      <div className="admin-boot-card">
        <div className="admin-boot-orbit" aria-hidden>
          <span className="admin-boot-ring admin-boot-ring-a" />
          <span className="admin-boot-ring admin-boot-ring-b" />
          <span className="admin-boot-ring admin-boot-ring-c" />
          <span className="admin-boot-pulse" />
        </div>

        <div className="admin-boot-logo-wrap">
          <Image
            src="/logo-white.png"
            alt="FinderB"
            width={148}
            height={40}
            className="admin-boot-logo object-contain"
            priority
          />
        </div>

        <p className="admin-boot-kicker">FinderB Admin</p>
        <h1 className="admin-boot-title">Opening your console</h1>
        <p key={stepIndex} className="admin-boot-step">
          {BOOT_STEPS[stepIndex]}
          <span className="admin-boot-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </p>

        <div className="admin-boot-track" aria-hidden>
          <span className="admin-boot-bar" />
        </div>

        <ul className="admin-boot-checklist" aria-hidden>
          {BOOT_STEPS.map((label, i) => (
            <li
              key={label}
              className={
                i < stepIndex
                  ? "is-done"
                  : i === stepIndex
                    ? "is-active"
                    : undefined
              }
            >
              <span className="admin-boot-check" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
