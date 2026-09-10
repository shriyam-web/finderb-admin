export type AdminColorMode = "light" | "dark";

export const ADMIN_COLOR_MODE_KEY = "admin_color_mode";

export function readAdminColorMode(
  role?: string | null,
): AdminColorMode {
  try {
    const stored = localStorage.getItem(ADMIN_COLOR_MODE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    // Controllers default to the premium dark console.
    return role === "developer" || role === "controller" ? "dark" : "light";
  } catch {
    return role === "developer" || role === "controller" ? "dark" : "light";
  }
}

export function writeAdminColorMode(mode: AdminColorMode) {
  try {
    localStorage.setItem(ADMIN_COLOR_MODE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}
