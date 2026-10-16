export type OnboardSource = "self" | "admin";

export function normalizeOnboardSource(value: unknown): OnboardSource | null {
  const source = String(value || "").trim().toLowerCase();
  if (source === "self" || source === "admin") return source;
  return null;
}

export function onboardSourceLabel(value: unknown): string {
  const source = normalizeOnboardSource(value);
  if (source === "self") return "Self registered";
  if (source === "admin") return "Added by admin";
  return "Origin not recorded";
}
