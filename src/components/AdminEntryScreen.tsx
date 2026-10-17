"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import styles from "./AdminEntryScreen.module.css";

export type EntryDestination = "dashboard" | "login";

const HANDOFF_KEY = "finderb-admin-entry-handoff";
const GREET_MS = 1450;
const OUT_MS = 420;
const WELCOME_MS = GREET_MS + OUT_MS + 700;
const CHECK_MS = 900;
const RESULT_MS = 1400;
const LINE_WORDS = ["Control.", "Update.", "Manage."] as const;

type Phase = "welcome" | "checking" | "result";
type TitleBeat = "greet" | "out" | "line";

async function probeSession(): Promise<EntryDestination> {
  try {
    const raw = localStorage.getItem("admin_session");
    if (!raw) return "login";
    const session = JSON.parse(raw) as { id?: string };
    if (!session?.id) {
      localStorage.removeItem("admin_session");
      return "login";
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admins")
      .select("id, is_disabled")
      .eq("id", session.id)
      .maybeSingle();
    if (error || !data || data.is_disabled) {
      localStorage.removeItem("admin_session");
      return "login";
    }
    return "dashboard";
  } catch {
    localStorage.removeItem("admin_session");
    return "login";
  }
}

export function markAdminEntryHandoff() {
  sessionStorage.setItem(HANDOFF_KEY, String(Date.now()));
}

export default function AdminEntryScreen({
  status,
  respectHandoff = false,
  loaderOnly = false,
  onResolved,
}: {
  /** When omitted, this screen checks the saved session itself. */
  status?: "checking" | EntryDestination;
  respectHandoff?: boolean;
  /** Spinner only. Used after a welcome screen already played. */
  loaderOnly?: boolean;
  onResolved: (destination: EntryDestination) => void;
}) {
  const [selfStatus, setSelfStatus] = useState<"checking" | EntryDestination>("checking");
  const [tick, setTick] = useState(0);
  const origin = useRef(0);
  const continued = useRef(false);
  const finished = useRef(false);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  const liveStatus = status ?? selfStatus;

  useEffect(() => {
    if (loaderOnly || status !== undefined) return;
    let cancelled = false;
    void probeSession().then((next) => {
      if (!cancelled) setSelfStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loaderOnly, status]);

  useEffect(() => {
    if (loaderOnly) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let handoff = false;
    if (respectHandoff) {
      const at = Number(sessionStorage.getItem(HANDOFF_KEY) || 0);
      handoff = Date.now() - at < 20000;
      if (handoff) sessionStorage.removeItem(HANDOFF_KEY);
    }
    continued.current = handoff;
    const welcomeMs = reduced ? 400 : WELCOME_MS;
    origin.current = handoff ? Date.now() - welcomeMs - 200 : Date.now();
    const id = window.setInterval(() => setTick((value) => value + 1), 200);
    return () => window.clearInterval(id);
  }, [loaderOnly, respectHandoff]);

  const reducedNow =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const welcomeMs = reducedNow ? 400 : WELCOME_MS;
  const checkMs = reducedNow ? 300 : CHECK_MS;
  const resultMs = continued.current ? 700 : reducedNow ? 600 : RESULT_MS;
  const elapsed = origin.current ? Date.now() - origin.current : 0;
  void tick;

  let phase: Phase = "welcome";
  if (elapsed >= welcomeMs + checkMs && liveStatus !== "checking") phase = "result";
  else if (elapsed >= welcomeMs) phase = "checking";

  const titleBeat: TitleBeat =
    reducedNow || continued.current || elapsed >= GREET_MS + OUT_MS
      ? "line"
      : elapsed >= GREET_MS
        ? "out"
        : "greet";

  const destination: EntryDestination | null =
    phase === "result" && liveStatus !== "checking" ? liveStatus : null;

  useEffect(() => {
    if (loaderOnly || phase !== "result" || !destination || finished.current) return;
    if (continued.current && liveStatus === "checking") return;
    const timer = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onResolvedRef.current(destination);
    }, resultMs);
    return () => window.clearTimeout(timer);
  }, [loaderOnly, phase, destination, liveStatus, resultMs]);

  if (loaderOnly) {
    return (
      <div className={styles.root} role="status" aria-live="polite" data-phase="checking">
        <div className={styles.brand}>
          <Image
            src="/fb-mark.png"
            alt=""
            width={20}
            height={20}
            className={styles.mark}
            priority
          />
          <span>Admin</span>
        </div>
        <div className={styles.stage}>
          <p className={styles.statusLine}>
            <span className={styles.spinner} aria-hidden />
            Checking your session
          </p>
        </div>
        <p className={styles.legal}>&copy; 2026 Maagaa Connect Private Limited</p>
      </div>
    );
  }

  const resultCopy =
    destination === "dashboard"
      ? "You're being redirected to the dashboard."
      : "You don't have any active session. Please login first.";

  return (
    <div className={styles.root} role="status" aria-live="polite" data-phase={phase}>
      <div className={styles.atmosphere} aria-hidden>
        <span className={styles.glow} />
      </div>

      <div className={styles.brand}>
        <Image
          src="/fb-mark.png"
          alt=""
          width={20}
          height={20}
          className={styles.mark}
          priority
        />
        <span>Admin</span>
      </div>
      <div className={styles.stage}>
        {titleBeat === "line" ? (
          <h1 className={styles.line}>
            {LINE_WORDS.map((word, index) => (
              <span key={word} className={styles.word} style={{ animationDelay: `${index * 160}ms` }}>
                {word}
              </span>
            ))}
          </h1>
        ) : (
          <h1 className={titleBeat === "out" ? styles.headlineOut : styles.headline}>Welcome Back</h1>
        )}
        <div className={styles.statusSlot}>
          {phase === "checking" ? (
            <p className={styles.statusLine}>
              <span className={styles.spinner} aria-hidden />
              Checking your session
            </p>
          ) : phase === "result" ? (
            <p className={destination === "dashboard" ? styles.resultOk : styles.resultIdle}>
              {resultCopy}
            </p>
          ) : null}
        </div>
      </div>
      <p className={styles.legal}>&copy; 2026 Maagaa Connect Private Limited</p>
    </div>
  );
}
