"use client";

import { useEffect } from "react";

export const ADMIN_PANEL_REFRESH = "admin-panel-refresh";

/** Ask the dashboard to reload queues, tables, and the open tab. */
export function requestAdminPanelRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_PANEL_REFRESH));
}

/** Reload this tab whenever the floating refresh button is used. */
export function useAdminPanelRefresh(onRefresh: () => void) {
  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener(ADMIN_PANEL_REFRESH, handler);
    return () => window.removeEventListener(ADMIN_PANEL_REFRESH, handler);
  }, [onRefresh]);
}
