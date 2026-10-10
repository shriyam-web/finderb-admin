import { createHmac, timingSafeEqual } from "crypto";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type AdminSession = { adminId: string; exp: number; purpose: "admin-session" };

function signingSecret(): string {
  const secret =
    process.env.ADMIN_2FA_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Set ADMIN_2FA_SECRET or SUPABASE_SERVICE_ROLE_KEY for admin sessions.");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(`admin-session:${body}`).digest("base64url");
}

/** Issued after the email code is accepted; the browser sends it with every database request. */
export function signAdminSession(adminId: string): string {
  const body = Buffer.from(
    JSON.stringify({
      adminId,
      exp: Date.now() + SESSION_TTL_MS,
      purpose: "admin-session",
    } satisfies AdminSession),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readAdminSession(token: string): AdminSession | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSession;
    if (parsed?.purpose !== "admin-session" || !parsed.adminId) return null;
    if (!Number.isFinite(parsed.exp) || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
