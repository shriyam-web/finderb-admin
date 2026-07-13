export const PASSWORD_MIN_LENGTH_MERCHANT = 6;
export const PASSWORD_MAX_LENGTH = 128;

export function validateRegistrationPassword(password: string): string | null {
  if (!password || typeof password !== "string") {
    return "Password is required.";
  }
  if (password.length < PASSWORD_MIN_LENGTH_MERCHANT) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH_MERCHANT} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }

  const hasVariety =
    /[A-Z]/.test(password) ||
    /[a-z]/.test(password) ||
    /\d/.test(password) ||
    /[^A-Za-z0-9]/.test(password);

  if (!hasVariety) {
    return "Add letters, numbers, or symbols for a stronger password.";
  }

  return null;
}
