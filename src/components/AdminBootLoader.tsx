"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./AdminBootLoader.module.css";

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
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <div className={styles.aurora} aria-hidden />
      <div className={styles.grid} aria-hidden />

      <div className={styles.card}>
        <div className={styles.orbit} aria-hidden>
          <span className={styles.ringA} />
          <span className={styles.ringB} />
          <span className={styles.ringC} />
          <span className={styles.pulse} />
          <div className={styles.logoWrap}>
            <Image
              src="/logo-white.png"
              alt="FinderB"
              width={72}
              height={20}
              className={styles.logo}
              priority
            />
          </div>
        </div>

        <p className={styles.kicker}>FinderB Admin</p>
        <h1 className={styles.title}>Opening your console</h1>
        <p key={stepIndex} className={styles.step}>
          {BOOT_STEPS[stepIndex]}
          <span className={styles.dots} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </p>

        <div className={styles.track} aria-hidden>
          <span className={styles.bar} />
        </div>

        <ul className={styles.checklist} aria-hidden>
          {BOOT_STEPS.map((label, i) => {
            const stateClass =
              i < stepIndex
                ? styles.done
                : i === stepIndex
                  ? styles.active
                  : undefined;
            return (
              <li
                key={label}
                className={[styles.checklistItem, stateClass]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={styles.check} />
                {label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
