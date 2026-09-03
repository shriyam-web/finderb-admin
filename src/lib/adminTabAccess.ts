/** Per-tab access modes for admin / super_admin accounts. */

export type TabAccessMode = "none" | "read" | "edit";

export type AdminAccessSession = {
  role?: string | null;
  allowed_tabs?: string[] | null;
  allowed_tab_modes?: Record<string, TabAccessMode> | null;
};

export const TAB_ACCESS_MODES: Exclude<TabAccessMode, "none">[] = [
  "read",
  "edit",
];

export function normalizeAdminTabName(tab: string): string {
  if (tab === "Merchant Registration") return "Business Onboarding";
  return tab;
}

function legacyTabsInclude(
  tabs: string[] | null | undefined,
  tab: string,
): boolean {
  const list = tabs ?? [];
  const normalized = normalizeAdminTabName(tab);
  if (list.includes(normalized) || list.includes(tab)) return true;
  if (
    normalized === "Business Onboarding" &&
    list.includes("Merchant Registration")
  ) {
    return true;
  }
  if (
    normalized === "Quick Onboard" &&
    (list.includes("Quick Onboard") ||
      list.includes("Business Onboarding") ||
      list.includes("Merchant Registration"))
  ) {
    return true;
  }
  return false;
}

function modeFromMap(
  modes: Record<string, TabAccessMode> | null | undefined,
  tab: string,
): TabAccessMode | null {
  if (!modes || typeof modes !== "object") return null;
  const keys = Object.keys(modes);
  if (!keys.length) return null;

  const normalized = normalizeAdminTabName(tab);
  const direct = modes[normalized] ?? modes[tab];
  if (direct === "read" || direct === "edit") return direct;
  if (direct === "none") return "none";

  if (
    normalized === "Business Onboarding" &&
    (modes["Merchant Registration"] === "read" ||
      modes["Merchant Registration"] === "edit")
  ) {
    return modes["Merchant Registration"];
  }

  // Quick Onboard inherits Business Onboarding when not explicitly set.
  if (normalized === "Quick Onboard") {
    const qo = modes["Quick Onboard"];
    if (qo === "read" || qo === "edit") return qo;
    const onboard =
      modes["Business Onboarding"] ?? modes["Merchant Registration"];
    if (onboard === "read" || onboard === "edit") return onboard;
  }

  return "none";
}

/**
 * Resolve access for a tab.
 * Controllers always get edit.
 * If allowed_tab_modes is present and non-empty, it wins.
 * Otherwise legacy allowed_tabs presence means edit.
 */
export function resolveTabAccess(
  session: AdminAccessSession | null | undefined,
  tab: string,
): TabAccessMode {
  if (!session) return "none";
  if (session.role === "controller") return "edit";
  if (tab === "Manage Admins") return "none";

  const fromModes = modeFromMap(session.allowed_tab_modes, tab);
  if (fromModes !== null) return fromModes;

  return legacyTabsInclude(session.allowed_tabs, tab) ? "edit" : "none";
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

/** Build modes map from legacy string[] (all edit). */
export function modesFromAllowedTabs(
  tabs: string[] | null | undefined,
): Record<string, TabAccessMode> {
  const out: Record<string, TabAccessMode> = {};
  for (const raw of tabs || []) {
    const tab = normalizeAdminTabName(raw);
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

export function isTabAccessMode(value: unknown): value is TabAccessMode {
  return value === "none" || value === "read" || value === "edit";
}

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
