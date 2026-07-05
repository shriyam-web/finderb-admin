export const PASSWORD_HASHED_DISPLAY = "__HASHED__";

export function classifyStoredPassword(password: string | null | undefined): string | null {
  if (!password) return null;
  if (password.startsWith("scrypt:")) return PASSWORD_HASHED_DISPLAY;
  return password;
}

export function formatRevealedPassword(value: string): string {
  if (value === PASSWORD_HASHED_DISPLAY) {
    return "Securely hashed (not viewable)";
  }
  return value;
}
