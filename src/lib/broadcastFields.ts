export const DEFAULT_BROADCAST_CTA_LABEL = "Open";
const CTA_LABEL_MAX = 40;
const CTA_URL_MAX = 2000;

export function sanitizeBroadcastCtaUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, CTA_URL_MAX);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeBroadcastCtaLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/\s+/g, " ").slice(0, CTA_LABEL_MAX);
  return value || null;
}

export function broadcastShowsDatetime(value: unknown): boolean {
  if (value === false || value === "false" || value === 0) return false;
  return true;
}

export function resolveBroadcastCta(input: {
  cta_url?: string | null;
  cta_label?: string | null;
}): { url: string; label: string } | null {
  const url = sanitizeBroadcastCtaUrl(input.cta_url);
  if (!url) return null;
  return {
    url,
    label:
      sanitizeBroadcastCtaLabel(input.cta_label) || DEFAULT_BROADCAST_CTA_LABEL,
  };
}
