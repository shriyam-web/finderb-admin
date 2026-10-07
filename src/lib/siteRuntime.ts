export const SITE_RUNTIME_ID = "finderb";

export type SiteMode = "normal" | "text_only" | "maintenance";

export type SiteRuntime = {
  id: string;
  mode: SiteMode;
  message: string;
  until: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

export const DEFAULT_MAINTENANCE_MESSAGE =
  "FinderB is temporarily unavailable while we finish a short update. Please check back soon.";

export function isSiteMode(value: unknown): value is SiteMode {
  return value === "normal" || value === "text_only" || value === "maintenance";
}

export function parseSiteRuntime(row: Record<string, unknown> | null | undefined): SiteRuntime {
  const until = row?.until ? String(row.until) : null;
  const mode = isSiteMode(row?.mode) ? row.mode : "normal";
  return {
    id: String(row?.id || SITE_RUNTIME_ID),
    mode,
    message: String(row?.message || "").trim() || DEFAULT_MAINTENANCE_MESSAGE,
    until,
    startedAt: row?.started_at ? String(row.started_at) : null,
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
  };
}

export function effectiveSiteMode(runtime: SiteRuntime, now = Date.now()): SiteMode {
  if (runtime.mode !== "maintenance") return runtime.mode;
  if (!runtime.until) return "maintenance";
  const until = Date.parse(runtime.until);
  if (Number.isFinite(until) && until <= now) return "normal";
  return "maintenance";
}

export function siteModeLabel(mode: SiteMode): string {
  if (mode === "maintenance") return "Maintenance";
  if (mode === "text_only") return "Text only";
  return "Live";
}
