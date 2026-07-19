import { slugifyBusinessName } from "./businessSlug";

/**
 * Placeholder login emails for backend onboardings where the merchant's
 * real email is unavailable. They unblock account creation, but the
 * profile must surface "email missing" until a real address is collected.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "finderb.com";

export function buildPlaceholderEmailCandidate(
  businessName: string,
  suffix?: string,
): string {
  const base = slugifyBusinessName(businessName) || "merchant";
  const local = suffix ? `${base}-${suffix}` : base;
  return `${local}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(
    email &&
    email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`),
  );
}
