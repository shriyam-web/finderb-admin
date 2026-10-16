export const ADMIN_PANEL_REFRESH = "admin-panel-refresh";

/** Ask the dashboard to reload queues, tables, and the open tab. */
export function requestAdminPanelRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_PANEL_REFRESH));
}
