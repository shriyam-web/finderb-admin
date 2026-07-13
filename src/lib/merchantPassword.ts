import { scrypt, randomBytes } from "crypto";
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
