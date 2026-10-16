export const REFRESH_FAB_POS_KEY = "admin-refresh-fab";
export const WHATS_NEW_FAB_POS_KEY = "admin_whats_new_pos";

const KEYS = [REFRESH_FAB_POS_KEY, WHATS_NEW_FAB_POS_KEY];

export type FabPos = { x: number; y: number };

export function readFabPosition(key: string): FabPos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabPos;
    if (typeof parsed?.x !== "number" || typeof parsed?.y !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFabPosition(key: string, pos: FabPos) {
  sessionStorage.setItem(key, JSON.stringify(pos));
}

/** Drop dragged spots so the next login starts at the default corners. */
export function clearAdminFloatingPositions() {
  if (typeof window === "undefined") return;
  for (const key of KEYS) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}
