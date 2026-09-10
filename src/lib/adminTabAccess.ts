/** Per-tab access modes for admin / super_admin accounts. */

export type TabAccessMode = "none" | "read" | "edit";

export type AdminAccessSession = {
  role?: string | null;
  allowed_tabs?: string[] | null;
  allowed_tab_modes?: Record<string, TabAccessMode> | null;
};

export function isDeveloperRole(role?: string | null): boolean {
  return role === "developer";
}

export function isControllerRole(role?: string | null): boolean {
  return role === "controller";
}

/** Developer is the platform owner: every tab, including Manage Admins. */
export function canManageAdmins(role?: string | null): boolean {
  return isDeveloperRole(role);
}

/** Gold premium console: developer and controller. */
export function isPremiumConsoleRole(role?: string | null): boolean {
  return isDeveloperRole(role) || isControllerRole(role);
}

export const TAB_ACCESS_MODES: Exclude<TabAccessMode, "none">[] = [
  "read",
  "edit",
];

export function normalizeAdminTabName(tab: string): string {
  if (tab === "Merchant Registration") return "Business Onboarding";
  return tab;
}

export function isTabAccessMode(value: unknown): value is TabAccessMode {
  return value === "none" || value === "read" || value === "edit";
}

/** Strip invalid / none entries. Missing key = no access. */
export function sanitizeTabModes(
  input: unknown,
): Record<string, TabAccessMode> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, TabAccessMode> = {};
  for (const [rawKey, rawMode] of Object.entries(
    input as Record<string, unknown>,
  )) {
    const key = normalizeAdminTabName(rawKey);
    if (!isTabAccessMode(rawMode) || rawMode === "none") continue;
    out[key] = rawMode;
  }
  return out;
}

/** Build modes map from legacy string[] (all edit). */
export function modesFromAllowedTabs(
  tabs: string[] | null | undefined,
): Record<string, TabAccessMode> {
  const out: Record<string, TabAccessMode> = {};
  for (const raw of tabs || []) {
    const tab = normalizeAdminTabName(raw);
    // Coming-soon placeholders must never expand a restricted allow-list.
    if (tab === "News" || tab === "FinderB E-commerce") continue;
    out[tab] = "edit";
  }
  return out;
}

/** Derive allowed_tabs list from modes (keys with read/edit). */
export function allowedTabsFromModes(
  modes: Record<string, TabAccessMode>,
): string[] {
  return Object.entries(modes)
    .filter(([, mode]) => mode === "read" || mode === "edit")
    .map(([tab]) => tab);
}

export function countGrantedTabs(modes: Record<string, TabAccessMode>): number {
  return allowedTabsFromModes(modes).length;
}

/**
 * Authoritative allow-list for a session.
 * - If allowed_tab_modes is present (including {}), it is the source of truth.
 *   An explicit empty object means zero tabs — never fall back to a fat
 *   allowed_tabs array (that was the "gave 2 tabs, sees all" leak).
 * - If allowed_tab_modes is null/undefined, derive edit grants from legacy
 *   allowed_tabs (pre-modes accounts only).
 */
export function effectiveTabModes(
  session: AdminAccessSession | null | undefined,
): Record<string, TabAccessMode> {
  if (!session) return {};
  const raw = session.allowed_tab_modes;
  if (raw !== null && raw !== undefined) {
    return sanitizeTabModes(raw);
  }
  return modesFromAllowedTabs(session.allowed_tabs);
}

/**
 * Normalize DB/session fields into a consistent allow-list pair.
 * Always keeps allowed_tabs in sync with the effective modes map.
 */
export function normalizeAccessFields(
  allowed_tabs: string[] | null | undefined,
  allowed_tab_modes: unknown,
): {
  allowed_tabs: string[];
  allowed_tab_modes: Record<string, TabAccessMode>;
} {
  // null/undefined → legacy; object (even {}) → modes are authoritative
  const hasModesColumn =
    allowed_tab_modes !== null && allowed_tab_modes !== undefined;
  const modes = effectiveTabModes({
    allowed_tabs,
    allowed_tab_modes: hasModesColumn
      ? (allowed_tab_modes as Record<string, TabAccessMode>)
      : null,
  });
  return {
    allowed_tabs: allowedTabsFromModes(modes),
    allowed_tab_modes: modes,
  };
}

function modeFromAllowList(
  modes: Record<string, TabAccessMode>,
  tab: string,
): TabAccessMode {
  if (!Object.keys(modes).length) return "none";

  const normalized = normalizeAdminTabName(tab);
  const direct = modes[normalized] ?? modes[tab];
  if (direct === "read" || direct === "edit") return direct;

  // Legacy alias only — do not inherit unrelated tabs.
  if (
    normalized === "Business Onboarding" &&
    (modes["Merchant Registration"] === "read" ||
      modes["Merchant Registration"] === "edit")
  ) {
    return modes["Merchant Registration"];
  }

  return "none";
}

/**
 * Resolve access for a tab.
 * Developer always gets edit (including Manage Admins).
 * Controller gets edit on every tab except Manage Admins.
 * Everyone else is an explicit allow-list (modes, or legacy tabs as edit).
 * Missing tab ⇒ none. No inheritance between Merchants / Onboarding / Quick Onboard.
 */
export function resolveTabAccess(
  session: AdminAccessSession | null | undefined,
  tab: string,
): TabAccessMode {
  if (!session) return "none";
  if (isDeveloperRole(session.role)) return "edit";
  if (tab === "Manage Admins") return "none";
  if (isControllerRole(session.role)) return "edit";
  if (tab === "News" || tab === "FinderB E-commerce") return "none";

  return modeFromAllowList(effectiveTabModes(session), tab);
}

export function canAccessTab(
  session: AdminAccessSession | null | undefined,
  tab: string,
): boolean {
  return resolveTabAccess(session, tab) !== "none";
}

export function canEditTab(
  session: AdminAccessSession | null | undefined,
  tab: string,
): boolean {
  return resolveTabAccess(session, tab) === "edit";
}
