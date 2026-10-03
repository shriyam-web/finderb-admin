import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import QRCode from "qrcode";

const STEP_MS = 30_000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type AdminTotpChallenge = {
  adminId: string;
  mode: "enroll" | "verify";
  exp: number;
  pendingSecret?: string;
};

function challengeSecret(): string {
  const secret =
    process.env.ADMIN_2FA_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Set ADMIN_2FA_SECRET before admin two-factor login can run.");
  }
  return secret;
}

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function currentTotp(secret: string, now = Date.now()): string {
  return hotp(secret, Math.floor(now / STEP_MS));
}

export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const digits = String(code || "").replace(/\D/g, "");
  if (!secret || digits.length !== 6) return false;
  const counter = Math.floor(now / STEP_MS);
  for (const step of [counter - 1, counter, counter + 1]) {
    if (step < 0) continue;
    const expected = hotp(secret, step);
    const left = Buffer.from(expected);
    const right = Buffer.from(digits);
    if (left.length === right.length && timingSafeEqual(left, right)) return true;
  }
  return false;
}

export function signAdminChallenge(input: {
  adminId: string;
  mode: "enroll" | "verify";
  pendingSecret?: string;
}): string {
  const payload: AdminTotpChallenge = {
    adminId: input.adminId,
    mode: input.mode,
    exp: Date.now() + CHALLENGE_TTL_MS,
    ...(input.pendingSecret ? { pendingSecret: input.pendingSecret } : {}),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", challengeSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readAdminChallenge(token: string): AdminTotpChallenge | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", challengeSecret()).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminTotpChallenge;
    if (!parsed?.adminId || (parsed.mode !== "enroll" && parsed.mode !== "verify")) return null;
    if (!Number.isFinite(parsed.exp) || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function totpQrDataUrl(email: string, secret: string): Promise<string> {
  const label = encodeURIComponent(`FinderB Admin:${email}`);
  const issuer = encodeURIComponent("FinderB Admin");
  const url = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  return QRCode.toDataURL(url, { margin: 1, width: 220 });
}
