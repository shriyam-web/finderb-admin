"use client";

export const PANEL_LOCK_KEY = "admin_panel_locked";
export const PANEL_IDLE_MS = 15 * 60 * 1000;

const TAB_KEY = "admin_panel_tab";
export const PANEL_ACTIVITY_KEY = "admin_panel_activity";

// sessionStorage survives a refresh and is dropped when the tab is closed.
// A missing flag means this visit is a new open, so the panel locks.
export function tabWasAlreadyOpen(): boolean {
  try {
    return sessionStorage.getItem(TAB_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPanelTab(): void {
  try {
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readPanelActivity(): number {
  try {
    const shared = Number(localStorage.getItem(PANEL_ACTIVITY_KEY) || 0);
    const local = Number(sessionStorage.getItem(PANEL_ACTIVITY_KEY) || 0);
    return Math.max(Number.isFinite(shared) ? shared : 0, Number.isFinite(local) ? local : 0);
  } catch {
    return 0;
  }
}

export function noteActivity(): void {
  const now = String(Date.now());
  try {
    localStorage.setItem(PANEL_ACTIVITY_KEY, now);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(PANEL_ACTIVITY_KEY, now);
  } catch {
    /* ignore */
  }
}

export function idleTooLong(now = Date.now()): boolean {
  const at = readPanelActivity();
  if (!at) return false;
  return now - at >= PANEL_IDLE_MS;
}

export function isPanelLocked(): boolean {
  try {
    return localStorage.getItem(PANEL_LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function lockPanel(): void {
  try {
    localStorage.setItem(PANEL_LOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function unlockPanel(): void {
  try {
    localStorage.removeItem(PANEL_LOCK_KEY);
  } catch {
    /* ignore */
  }
  markPanelTab();
  noteActivity();
}
