export const FINDERB_TIMEZONE = "Asia/Kolkata";

/**
 * DB timestamps often arrive without timezone, e.g. `2026-06-24T18:03:51.885`.
 * FinderB stores these as UTC — parse as UTC, display in IST.
 */
export function parseFinderbTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/,
  );
  if (match) {
    const [, year, month, day, hour, minute, second, ms = "0"] = match;
    const utcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(ms.padEnd(3, "0").slice(0, 3)),
    );
    return new Date(utcMs);
  }

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const date = new Date(`${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDate(value: string | Date | null | undefined): Date | null {
  return parseFinderbTimestamp(value);
}

export function formatDateTimeInr(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  const formatted = date.toLocaleString("en-IN", {
    timeZone: FINDERB_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${formatted} IST`;
}

export function formatActivityDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    timeZone: FINDERB_TIMEZONE,
    month: "short",
    day: "numeric",
  });
}

export function formatActivityTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  const formatted = date.toLocaleTimeString("en-IN", {
    timeZone: FINDERB_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${formatted} IST`;
}

export const ADMIN_SESSION_ACTIVE_MS = 3 * 60 * 1000;

export function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 1) return "Under 1 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatSessionLength(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}
