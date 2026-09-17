export const INDIAN_MOBILE_LENGTH = 10;
/** Max national digits kept after stripping +91 / trunk 0 (landlines can be 8–11). */
export const INDIAN_PHONE_MAX_LENGTH = 11;
export const INDIAN_LANDLINE_MIN_LENGTH = 8;

/**
 * Normalize Indian phone digit input.
 * Strips +91 / 91 and a single trunk-prefix 0 *before* length capping so a pasted
 * `09876543210` keeps all 10 mobile digits instead of losing the last one.
 */
export function extractIndianMobileDigits(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  if (!text) return "";

  let digits = text.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("91") && digits.length > INDIAN_MOBILE_LENGTH) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  while (digits.length > INDIAN_MOBILE_LENGTH && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, INDIAN_PHONE_MAX_LENGTH);
}

export function formatIndianMobileDisplay(digits: string): string {
  const normalized = extractIndianMobileDigits(digits);
  if (!normalized) return "";
  if (normalized.length <= 5) return normalized;
  return `${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

export function isValidIndianMobileDigits(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(extractIndianMobileDigits(digits));
}

export function isValidIndianLandlineDigits(digits: string): boolean {
  const normalized = extractIndianMobileDigits(digits);
  if (isValidIndianMobileDigits(normalized)) return false;
  if (
    normalized.length < INDIAN_LANDLINE_MIN_LENGTH ||
    normalized.length > INDIAN_PHONE_MAX_LENGTH
  ) {
    return false;
  }
  return /^\d+$/.test(normalized) && !/^0+$/.test(normalized);
}

export function isValidIndianPhoneDigits(
  digits: string,
  options: { allowLandline?: boolean } = {},
): boolean {
  if (isValidIndianMobileDigits(digits)) return true;
  if (options.allowLandline && isValidIndianLandlineDigits(digits)) return true;
  return false;
}

export function normalizeIndianPhoneForStorage(value: string): string {
  return extractIndianMobileDigits(value);
}

export function indianMobileValidationError(
  value: string,
  options: {
    required?: boolean;
    allowLandline?: boolean;
    label?: string;
  } = {},
): string | null {
  const { required = true, allowLandline = false, label } = options;
  const digits = extractIndianMobileDigits(value);
  const fieldLabel = label || (allowLandline ? "phone number" : "mobile number");

  if (!digits) {
    return required ? `Please enter a valid ${fieldLabel}.` : null;
  }

  if (isValidIndianPhoneDigits(digits, { allowLandline })) {
    return null;
  }

  if (allowLandline) {
    if (digits.length < INDIAN_LANDLINE_MIN_LENGTH) {
      return "Enter a valid mobile (10 digits) or landline number.";
    }
    return "Enter a valid Indian mobile or landline number.";
  }

  if (digits.length < INDIAN_MOBILE_LENGTH) {
    return "Enter all 10 digits. A leading 0 or +91 is fine — we remove it automatically.";
  }

  return "Enter a valid 10-digit Indian mobile number (starts with 6–9).";
}
