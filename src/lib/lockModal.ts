export const LOCK_MODAL_ROW_ID = "default";
export const DEFAULT_LOCKOUT_SECONDS = 60;

export type LockModalCopy = {
  eyebrow: string;
  title: string;
  body: string;
  footer: string;
  logoutSeconds: number;
};

export const DEFAULT_LOCK_MODAL_COPY: LockModalCopy = {
  eyebrow: "Security alert",
  title: "Suspicious activity detected",
  body: "You'll be auto logged out in {countdown}.",
  footer: "This session cannot continue. Contact a Developer to enable login.",
  logoutSeconds: DEFAULT_LOCKOUT_SECONDS,
};

export function clampLockoutSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOCKOUT_SECONDS;
  return Math.min(600, Math.max(10, Math.round(n)));
}

export function normalizeLockModalCopy(
  input: Partial<LockModalCopy> | null | undefined,
): LockModalCopy {
  return {
    eyebrow: (input?.eyebrow ?? DEFAULT_LOCK_MODAL_COPY.eyebrow).trim() || DEFAULT_LOCK_MODAL_COPY.eyebrow,
    title: (input?.title ?? DEFAULT_LOCK_MODAL_COPY.title).trim() || DEFAULT_LOCK_MODAL_COPY.title,
    body: (input?.body ?? DEFAULT_LOCK_MODAL_COPY.body).trim() || DEFAULT_LOCK_MODAL_COPY.body,
    footer: (input?.footer ?? DEFAULT_LOCK_MODAL_COPY.footer).trim() || DEFAULT_LOCK_MODAL_COPY.footer,
    logoutSeconds: clampLockoutSeconds(
      input?.logoutSeconds ?? DEFAULT_LOCK_MODAL_COPY.logoutSeconds,
    ),
  };
}

export function lockModalCopyFromRow(row: {
  eyebrow?: string | null;
  title?: string | null;
  body?: string | null;
  footer?: string | null;
  logout_seconds?: number | null;
} | null): LockModalCopy {
  if (!row) return DEFAULT_LOCK_MODAL_COPY;
  return normalizeLockModalCopy({
    eyebrow: row.eyebrow ?? undefined,
    title: row.title ?? undefined,
    body: row.body ?? undefined,
    footer: row.footer ?? undefined,
    logoutSeconds: row.logout_seconds ?? undefined,
  });
}

export function formatLockModalBody(body: string, secondsLeft: number): string {
  const countdown = `${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"}`;
  return body
    .replaceAll("{countdown}", countdown)
    .replaceAll("{seconds}", String(secondsLeft));
}
