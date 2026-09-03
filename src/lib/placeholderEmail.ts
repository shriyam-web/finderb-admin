import { slugifyBusinessName } from "./businessSlug";

/**
 * Placeholder login emails for backend onboardings where the merchant's
 * real email is unavailable. They unblock account creation, but the
 * profile must surface "email missing" until a real address is collected.
 *
 * Always include a random numeric suffix so the address is not guessable
 * from the business name alone (default password is shared).
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "finderb.com";

/** 5-digit numeric token (10000–99999). */
export function randomPlaceholderEmailDigits(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function buildPlaceholderEmailCandidate(
  businessName: string,
  suffix?: string,
): string {
  const base = slugifyBusinessName(businessName) || "merchant";
  const token = (suffix?.trim() || randomPlaceholderEmailDigits()).replace(
    /[^0-9a-z-]/gi,
    "",
  );
  const local = token ? `${base}-${token}` : `${base}-${randomPlaceholderEmailDigits()}`;
  return `${local}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(
    email &&
      email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`),
  );
}
