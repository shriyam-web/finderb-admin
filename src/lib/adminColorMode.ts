export type AdminColorMode = "light" | "dark";

export const ADMIN_COLOR_MODE_KEY = "admin_color_mode";
const ADMIN_THEME_ROLE_KEY = "admin_color_role";

export function readAdminColorMode(
  role?: string | null,
): AdminColorMode {
  try {
    const stored = localStorage.getItem(ADMIN_COLOR_MODE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    // Developer and Controller default to dark (gold vs silver).
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

export type AdminConsoleTheme = "dark" | "controller" | "silver";

/** Developer dark is the gold console, controller dark is silver, everyone else is the gray dark console. */
export function resolveAdminConsoleTheme(
  role: string | null | undefined,
  mode: AdminColorMode,
): AdminConsoleTheme | null {
  if (mode !== "dark") return null;
  if (role === "developer") return "controller";
  if (role === "controller") return "silver";
  return "dark";
}

export function rememberAdminThemeRole(role: string | null | undefined) {
  if (!role) return;
  try {
    localStorage.setItem(ADMIN_THEME_ROLE_KEY, role);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Welcome and login follow a signed-in admin's theme, including role defaults.
 * After logout there is no session, so only an explicit dark choice is kept.
 */
export function readLaunchTheme(): AdminConsoleTheme | null {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const session = JSON.parse(raw) as { id?: string; role?: string };
      if (session?.id) {
        rememberAdminThemeRole(session.role);
        return resolveAdminConsoleTheme(session.role, readAdminColorMode(session.role));
      }
    }
    if (localStorage.getItem(ADMIN_COLOR_MODE_KEY) !== "dark") return null;
    return resolveAdminConsoleTheme(localStorage.getItem(ADMIN_THEME_ROLE_KEY), "dark");
  } catch {
    return null;
  }
}

const THEME_CLASSES = [
  "admin-theme-controller",
  "admin-theme-dark",
  "admin-theme-silver",
] as const;

export function applyAdminConsoleTheme(theme: AdminConsoleTheme | null) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  document.body?.classList.remove(...THEME_CLASSES);
  if (!theme) {
    root.removeAttribute("data-admin-theme");
    return;
  }
  root.setAttribute("data-admin-theme", theme);
  const className =
    theme === "controller"
      ? "admin-theme-controller"
      : theme === "silver"
        ? "admin-theme-silver"
        : "admin-theme-dark";
  root.classList.add(className);
  document.body?.classList.add(className);
}
