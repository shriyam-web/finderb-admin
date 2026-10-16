/**
 * A sidebar tab shines for 30 days after it first appears, then the label is normal.
 *
 * Tabs shipped with a known date live in SIDEBAR_TAB_INTRODUCED_ON.
 * Any later tab name is stamped the first time this browser loads the panel
 * after the previous set was saved, and shines for the same 30 days.
 */

const SHINE_MS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "admin_sidebar_tab_shine_v1";

export const SIDEBAR_TAB_INTRODUCED_ON: Record<string, string> = {
  Reviews: "2026-10-16",
  "Change Requests": "2026-10-16",
  "Ownership Requests": "2026-10-16",
  "Job Reports": "2026-10-16",
};

type ShineStore = {
  baselined?: boolean;
  firstSeen?: Record<string, string>;
};

function startOfDayIst(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00+05:30`).getTime();
}

function todayIst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isTabShining(introducedOn: string, now = new Date()): boolean {
  const start = startOfDayIst(introducedOn);
  if (Number.isNaN(start)) return false;
  const time = now.getTime();
  return time >= start && time - start < SHINE_MS;
}

export function codeShiningTabs(now = new Date()): Set<string> {
  const shining = new Set<string>();
  for (const [name, introducedOn] of Object.entries(SIDEBAR_TAB_INTRODUCED_ON)) {
    if (isTabShining(introducedOn, now)) shining.add(name);
  }
  return shining;
}

/** Remember tabs that were not in the last snapshot. Returns names still inside the 30-day window. */
export function recordFutureShiningTabs(tabNames: string[], now = new Date()): string[] {
  if (typeof window === "undefined") return [];
  let stored: ShineStore = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as ShineStore;
  } catch {
    stored = {};
  }
  const firstSeen = { ...(stored.firstSeen || {}) };
  const today = todayIst(now);
  if (!stored.baselined) {
    for (const name of tabNames) {
      if (SIDEBAR_TAB_INTRODUCED_ON[name] || firstSeen[name]) continue;
      firstSeen[name] = "2000-01-01";
    }
  } else {
    for (const name of tabNames) {
      if (SIDEBAR_TAB_INTRODUCED_ON[name] || firstSeen[name]) continue;
      firstSeen[name] = today;
    }
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ baselined: true, firstSeen }),
  );
  return Object.entries(firstSeen)
    .filter(([name, date]) => !SIDEBAR_TAB_INTRODUCED_ON[name] && isTabShining(date, now))
    .map(([name]) => name);
}
