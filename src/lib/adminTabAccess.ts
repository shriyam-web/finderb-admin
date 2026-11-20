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

/**
 * Non-developer accounts stay locked until a Developer enables login.
 * Locked accounts can still authenticate, then get the 30s logout modal.
 */
export function isConsoleLoginUnlocked(
  role?: string | null,
  loginEnabled?: boolean | null,
): boolean {
  if (isDeveloperRole(role)) return true;
  return loginEnabled === true;
}

/** Gold premium console: Developer only. Controller uses the silver console. */
export function isPremiumConsoleRole(role?: string | null): boolean {
  return isDeveloperRole(role);
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

  // Renamed tab only. A grant on one tab never opens a different tab.
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
 * Developer always gets edit, including Manage Admins.
 * A controller with no saved list keeps the operational console.
 * Once a Developer saves that controller's tabs, only those tabs remain.
 * Admin and super_admin never see a tab that was not saved for them.
 * A grant on one tab does not open a different tab.
 */
export function resolveTabAccess(
  session: AdminAccessSession | null | undefined,
  tab: string,
): TabAccessMode {
  if (!session) return "none";
  if (isDeveloperRole(session.role)) return "edit";
  if (tab === "Manage Admins") return "none";
  const explicitOnly =
    tab === "Merchant Support Login" ||
    tab === "Reviews" ||
    tab === "Reported Businesses" ||
    tab === "Change Requests" ||
    tab === "Ownership Requests" ||
    tab === "Job Reports" ||
    tab === "Site Configurations";
  if (explicitOnly) return modeFromAllowList(effectiveTabModes(session), tab);
  if (isControllerRole(session.role)) {
    if (session.allowed_tab_modes === null || session.allowed_tab_modes === undefined) {
      return "edit";
    }
    return modeFromAllowList(effectiveTabModes(session), tab);
  }
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

const OPT_IN_SIDEBAR_TABS = new Set([
  "Merchant Support Login",
  "Reviews",
  "Reported Businesses",
  "Change Requests",
  "Ownership Requests",
  "Job Reports",
  "Site Configurations",
]);

const COMING_SOON_SIDEBAR_TABS = new Set(["News", "FinderB E-commerce"]);

/** Tabs this account would actually see in the sidebar. */
export function visibleSidebarTabs(
  session: AdminAccessSession | null | undefined,
  tabNames: readonly string[],
): string[] {
  if (!session) return [];
  const unrestrictedController =
    isControllerRole(session.role) && session.allowed_tab_modes == null;
  return tabNames.filter((name) => {
    if (isDeveloperRole(session.role)) return true;
    if (unrestrictedController) {
      return name !== "Manage Admins" && !OPT_IN_SIDEBAR_TABS.has(name);
    }
    if (isControllerRole(session.role)) {
      if (name === "Manage Admins") return false;
      return canAccessTab(session, name);
    }
    if (name === "Manage Admins" || COMING_SOON_SIDEBAR_TABS.has(name)) return false;
    return canAccessTab(session, name);
  });
}

export type TabAccessCheck = {
  ok: boolean;
  developerSeesEverything: boolean;
  assigned: { tab: string; mode: "read" | "edit" }[];
  visible: { tab: string; mode: Exclude<TabAccessMode, "none"> }[];
  assignedButHidden: string[];
  visibleButNotAssigned: string[];
  modeMismatch: { tab: string; assigned: "read" | "edit"; actual: "read" | "edit" }[];
};

/** Compare a draft assignment with the sidebar that account would open. */
export function checkAssignedTabAccess(input: {
  role?: string | null;
  modes: Record<string, TabAccessMode>;
  sidebarTabs: readonly string[];
}): TabAccessCheck {
  const modes = sanitizeTabModes(input.modes);
  const session: AdminAccessSession = {
    role: input.role,
    allowed_tabs: allowedTabsFromModes(modes),
    allowed_tab_modes: modes,
  };
  const assigned = allowedTabsFromModes(modes).map((tab) => ({
    tab,
    mode: modes[tab] as "read" | "edit",
  }));
  const developerSeesEverything = isDeveloperRole(input.role);
  const visibleNames = visibleSidebarTabs(session, input.sidebarTabs);
  const assignedNames = new Set(assigned.map((item) => item.tab));
  const assignedButHidden = assigned
    .map((item) => item.tab)
    .filter((tab) => !visibleNames.includes(tab));
  const visibleButNotAssigned = visibleNames.filter((tab) => !assignedNames.has(tab));
  const modeMismatch = assigned.flatMap((item) => {
    const actual = resolveTabAccess(session, item.tab);
    if (actual === "none" || actual === item.mode) return [];
    return [{ tab: item.tab, assigned: item.mode, actual }];
  });
  const visible = visibleNames.map((tab) => ({
    tab,
    mode: resolveTabAccess(session, tab) as Exclude<TabAccessMode, "none">,
  }));
  return {
    ok:
      !developerSeesEverything &&
      assignedButHidden.length === 0 &&
      visibleButNotAssigned.length === 0 &&
      modeMismatch.length === 0,
    developerSeesEverything,
    assigned,
    visible,
    assignedButHidden,
    visibleButNotAssigned,
    modeMismatch,
  };
}
