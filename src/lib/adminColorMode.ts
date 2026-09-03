export type AdminColorMode = "light" | "dark";

export const ADMIN_COLOR_MODE_KEY = "admin_color_mode";

export function readAdminColorMode(): AdminColorMode {
  try {
    return localStorage.getItem(ADMIN_COLOR_MODE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function writeAdminColorMode(mode: AdminColorMode) {
  try {
    localStorage.setItem(ADMIN_COLOR_MODE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}
