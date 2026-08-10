/** Shared payment-mode labels (Business.paymentModes string[]). */
export const PAYMENT_MODE_OPTIONS = [
  "Cash",
  "UPI",
  "Debit Card",
  "Credit Card",
  "Net Banking",
  "Wallets",
  "Cheque",
  "EMI",
] as const;

export type PaymentModeOption = (typeof PAYMENT_MODE_OPTIONS)[number];

/** Defaults for quick + merchant onboarding forms. */
export const DEFAULT_ONBOARDING_PAYMENT_MODES: string[] = [
  "Cash",
  "UPI",
  "Net Banking",
];

const ALLOWED = new Set<string>(PAYMENT_MODE_OPTIONS);

/**
 * Normalize an arbitrary payload into known payment-mode labels.
 * Missing / invalid input falls back to onboarding defaults.
 * Explicit empty array is preserved (no modes selected).
 */
export function normalizePaymentModes(input: unknown): string[] {
  if (input === undefined || input === null) {
    return [...DEFAULT_ONBOARDING_PAYMENT_MODES];
  }
  if (!Array.isArray(input)) {
    return [...DEFAULT_ONBOARDING_PAYMENT_MODES];
  }

  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const mode = item.trim();
    if (!ALLOWED.has(mode) || seen.has(mode)) continue;
    seen.add(mode);
    next.push(mode);
  }
  return next;
}

export function togglePaymentMode(
  selected: string[],
  mode: string,
): string[] {
  return selected.includes(mode)
    ? selected.filter((item) => item !== mode)
    : [...selected, mode];
}
