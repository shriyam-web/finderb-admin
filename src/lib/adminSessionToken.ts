import { createHmac, timingSafeEqual } from "crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_WITHIN_MS = 15 * 24 * 60 * 60 * 1000;

type AdminSession = { adminId: string; exp: number; purpose: "admin-session"; epoch: number };

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
export function signAdminSession(adminId: string, epoch = 0): string {
  const body = Buffer.from(
    JSON.stringify({
      adminId,
      exp: Date.now() + SESSION_TTL_MS,
      purpose: "admin-session",
      epoch: Number.isFinite(epoch) ? epoch : 0,
    } satisfies AdminSession),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function sessionNeedsRefresh(session: AdminSession): boolean {
  return session.exp - Date.now() < REFRESH_WITHIN_MS;
}

export function readAdminSession(token: string): AdminSession | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AdminSession>;
    if (parsed?.purpose !== "admin-session" || !parsed.adminId) return null;
    if (!Number.isFinite(parsed.exp) || Date.now() > Number(parsed.exp)) return null;
    const epoch = Number(parsed.epoch);
    return {
      adminId: parsed.adminId,
      exp: Number(parsed.exp),
      purpose: "admin-session",
      epoch: Number.isFinite(epoch) ? epoch : 0,
    };
  } catch {
    return null;
  }
}
