/** Client-safe rules for an admin's own password. No Node crypto. */

export const ADMIN_PASSWORD_MIN = 8;
export const ADMIN_PASSWORD_MAX = 128;

const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "p@ssword",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "qwertyui",
  "asdfghjk",
  "asdfghjkl",
  "zxcvbnm",
  "admin",
  "admin123",
  "admin1234",
  "administrator",
  "letmein",
  "letmein1",
  "welcome",
  "welcome1",
  "welcome123",
  "iloveyou",
  "abc12345",
  "changeme",
  "trustno1",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "monkey",
  "dragon",
  "master",
  "shadow",
  "login",
  "login123",
  "finderb",
  "finderb1",
  "finderb123",
]);

const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

export type AdminPasswordCheck = {
  id: string;
  label: string;
  met: boolean;
};

function normalize(password: string): string {
  return password
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
}

function isRepeated(password: string): boolean {
  return /^(.)\1+$/.test(password);
}

function isSequential(password: string): boolean {
  const lower = password.toLowerCase();
  if (lower.length < 6) return false;
  return SEQUENCES.some((sequence) => {
    for (let start = 0; start <= lower.length - 6; start += 1) {
      const slice = lower.slice(start, start + 6);
      if (sequence.includes(slice)) return true;
      const reversed = slice.split("").reverse().join("");
      if (sequence.includes(reversed)) return true;
    }
    return false;
  });
}

function isPopular(password: string, email?: string): boolean {
  const compact = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  const folded = normalize(password);
  if (COMMON.has(compact) || COMMON.has(folded)) return true;
  if ([...COMMON].some((word) => word.length >= 5 && (compact === word || folded === word))) return true;
  if (
    [...COMMON].some(
      (word) =>
        word.length >= 5 &&
        (compact.startsWith(word) || folded.startsWith(word)) &&
        compact.length <= word.length + 3,
    )
  ) {
    return true;
  }
  const local = email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  if (local.length >= 4 && compact.includes(local)) return true;
  return isRepeated(password) || isSequential(password);
}

function classes(password: string): number {
  let count = 0;
  if (/[a-z]/.test(password)) count += 1;
  if (/[A-Z]/.test(password)) count += 1;
  if (/\d/.test(password)) count += 1;
  if (/[^A-Za-z0-9]/.test(password)) count += 1;
  return count;
}

export function adminPasswordChecks(password: string, email?: string): AdminPasswordCheck[] {
  const value = password ?? "";
  return [
    {
      id: "length",
      label: "At least 8 characters",
      met: value.length >= ADMIN_PASSWORD_MIN && value.length <= ADMIN_PASSWORD_MAX,
    },
    {
      id: "mix",
      label: "Uppercase or a symbol, plus letters and a number",
      met: classes(value) >= 3 && /[A-Za-z]/.test(value) && /\d/.test(value),
    },
    {
      id: "common",
      label: "Not a common or easy-to-guess pattern",
      met: value.length > 0 && !isPopular(value, email),
    },
  ];
}

export function validateAdminPassword(password: string, email?: string): string | null {
  if (!password || typeof password !== "string") return "Enter a new password.";
  if (password.length < ADMIN_PASSWORD_MIN) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > ADMIN_PASSWORD_MAX) {
    return "Password must be at most 128 characters.";
  }
  if (classes(password) < 3 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use a mix of letters, a number, and an uppercase letter or symbol.";
  }
  if (isPopular(password, email)) {
    return "This password is too easy to guess. Choose something less common.";
  }
  return null;
}

export function validateAdminPasswordChange(input: {
  newPassword: string;
  confirmPassword: string;
  email?: string;
}): string | null {
  const strength = validateAdminPassword(input.newPassword, input.email);
  if (strength) return strength;
  if (!input.confirmPassword) return "Type the new password again.";
  if (input.newPassword !== input.confirmPassword) return "The two passwords do not match.";
  return null;
}
