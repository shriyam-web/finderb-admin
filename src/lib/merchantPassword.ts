import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const HASH_PREFIX = "scrypt:";
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Same format as FinderB: scrypt:<saltHex>:<hashHex> — server only. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return `${HASH_PREFIX}${salt.toString("hex")}:${derived.toString("hex")}`;
}

function isHashedPassword(stored: string): boolean {
  return stored.startsWith(HASH_PREFIX);
}

/**
 * Accepts legacy plaintext admin passwords and FinderB scrypt hashes.
 * Returns needsRehash when a plaintext match should be upgraded.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  const trimmed = password.trim();
  if (!stored) return { valid: false, needsRehash: false };

  if (!isHashedPassword(stored)) {
    const valid = stored === trimmed;
    return { valid, needsRehash: valid };
  }

  const payload = stored.slice(HASH_PREFIX.length);
  const colon = payload.indexOf(":");
  if (colon === -1) return { valid: false, needsRehash: false };

  const saltHex = payload.slice(0, colon);
  const hashHex = payload.slice(colon + 1);

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = (await scryptAsync(trimmed, salt, KEY_BYTES)) as Buffer;

    if (expected.length !== derived.length) {
      return { valid: false, needsRehash: false };
    }

    return {
      valid: timingSafeEqual(expected, derived),
      needsRehash: false,
    };
  } catch {
    return { valid: false, needsRehash: false };
  }
}
