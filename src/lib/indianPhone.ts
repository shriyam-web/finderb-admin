export const INDIAN_MOBILE_LENGTH = 10;

export function extractIndianMobileDigits(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  if (!text) return "";

  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > INDIAN_MOBILE_LENGTH) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, "");
  return digits.slice(0, INDIAN_MOBILE_LENGTH);
}

export function isValidIndianMobileDigits(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(extractIndianMobileDigits(digits));
}

export function normalizeIndianPhoneForStorage(value: string): string {
  return extractIndianMobileDigits(value);
}

export function indianMobileValidationError(
  value: string,
  options: { required?: boolean; label?: string } = {},
): string | null {
  const { required = true, label = "mobile number" } = options;
  const digits = extractIndianMobileDigits(value);

  if (!digits) {
    return required ? `Please enter a valid 10-digit ${label}.` : null;
  }
  if (digits.length < INDIAN_MOBILE_LENGTH) {
    return "Enter all 10 digits. Do not add 0, +91, or spaces.";
  }
  if (!isValidIndianMobileDigits(digits)) {
    return "Enter a valid 10-digit Indian mobile number (starts with 6–9).";
  }
  return null;
}
