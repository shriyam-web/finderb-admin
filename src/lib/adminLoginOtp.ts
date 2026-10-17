import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

const OTP_TTL_MS = 15 * 60 * 1000;
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const PURPOSE = "admin-login";
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_CODE_SENDS = 5;
const MAX_CODE_GUESSES = 5;
const OTP_CHECK_MAX = 8;

type Challenge = { adminId: string; exp: number };

function signingSecret(): string {
  const secret =
    process.env.ADMIN_2FA_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Set ADMIN_2FA_SECRET or SUPABASE_SERVICE_ROLE_KEY for admin email codes.");
  }
  return secret;
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type WindowRow = { attempts: number; expiresAt: number };

const memoryWindows = new Map<string, WindowRow>();

export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function subjectHash(value: string): string {
  const secret =
    process.env.ADMIN_2FA_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const digest = secret
    ? createHmac("sha256", secret).update(`admin-rl:${value}`).digest("hex")
    : createHash("sha256").update(`admin-rl:${value}`).digest("hex");
  return digest.slice(0, 48);
}

function memoryDecide(
  purpose: string,
  keys: string[],
  limit: number,
  windowMs: number,
  commit: boolean,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const stored = keys.map((key) => memoryWindows.get(`${purpose}:${key}`));
  for (const row of stored) {
    if (row && row.expiresAt > now && row.attempts >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((row.expiresAt - now) / 1000)) };
    }
  }
  if (!commit) return { ok: true };
  keys.forEach((key, index) => {
    const row = stored[index];
    const fresh = !row || row.expiresAt <= now;
    memoryWindows.set(`${purpose}:${key}`, {
      attempts: fresh ? 1 : row.attempts + 1,
      expiresAt: fresh ? now + windowMs : row.expiresAt,
    });
  });
  return { ok: true };
}

async function dbDecide(
  purpose: string,
  keys: string[],
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfter: number } | null> {
  const client = db();
  if (!client) return null;
  const now = Date.now();
  const rows: WindowRow[] = [];
  for (const key of keys) {
    const { data, error } = await client
      .from("otp_challenges")
      .select("attempts, expires_at")
      .eq("purpose", purpose)
      .eq("subject", key)
      .maybeSingle();
    if (error) {
      console.error("[admin-login-rl] read failed", error.message);
      return null;
    }
    rows.push(
      data
        ? {
            attempts: Number(data.attempts || 0),
            expiresAt: Date.parse(String(data.expires_at || "")) || 0,
          }
        : { attempts: 0, expiresAt: 0 },
    );
  }
  for (const row of rows) {
    if (row.expiresAt > now && row.attempts >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((row.expiresAt - now) / 1000)) };
    }
  }
  for (let index = 0; index < keys.length; index += 1) {
    const row = rows[index];
    const fresh = row.expiresAt <= now;
    const { error } = await client.from("otp_challenges").upsert(
      {
        purpose,
        subject: keys[index],
        code_hash: "rate",
        attempts: fresh ? 1 : row.attempts + 1,
        send_count: 1,
        expires_at: new Date(fresh ? now + windowMs : row.expiresAt).toISOString(),
      },
      { onConflict: "purpose,subject" },
    );
    if (error) {
      console.error("[admin-login-rl] write failed", error.message);
      return null;
    }
  }
  return { ok: true };
}

async function takeWindow(purpose: string, keys: string[], limit: number, windowMs: number) {
  const local = memoryDecide(purpose, keys, limit, windowMs, false);
  if (!local.ok) return local;
  const remote = await dbDecide(purpose, keys, limit, windowMs);
  if (remote && !remote.ok) return remote;
  return memoryDecide(purpose, keys, limit, windowMs, true);
}

/** Five password attempts per minute, per network and per email. */
export async function takeLoginAttempt(ip: string, email: string) {
  return takeWindow(
    "admin-login-rl",
    [`ip:${subjectHash(ip || "unknown")}`, `em:${subjectHash(email)}`],
    LOGIN_MAX_ATTEMPTS,
    LOGIN_WINDOW_MS,
  );
}

/** Slows guessing of the emailed code from one network. */
export async function takeOtpCheck(ip: string) {
  return takeWindow("admin-otp-rl", [`ip:${subjectHash(ip || "unknown")}`], OTP_CHECK_MAX, LOGIN_WINDOW_MS);
}

function hashCode(email: string, code: string): string {
  return createHmac("sha256", signingSecret())
    .update(`admin-login:${email}:${code}`)
    .digest("hex");
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signLoginChallenge(adminId: string): string {
  const body = Buffer.from(
    JSON.stringify({ adminId, exp: Date.now() + CHALLENGE_TTL_MS } satisfies Challenge),
  ).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readLoginChallenge(token: string): Challenge | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  if (!same(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Challenge;
    if (!parsed?.adminId || !Number.isFinite(parsed.exp) || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function storeCode(email: string, code: string, sendCount: number): Promise<void> {
  const client = db();
  if (!client) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().lt("expires_at", new Date().toISOString());
  await client.from("otp_challenges").delete().eq("purpose", PURPOSE).eq("subject", subject);
  const row = {
    purpose: PURPOSE,
    subject,
    code_hash: hashCode(subject, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    send_count: sendCount,
    attempts: 0,
  };
  const inserted = await client.from("otp_challenges").insert(row);
  if (!inserted.error) return;
  if (!/send_count|attempts/i.test(inserted.error.message || "")) {
    throw new Error("Could not store the sign-in code.");
  }
  const fallback = await client.from("otp_challenges").insert({
    purpose: row.purpose,
    subject: row.subject,
    code_hash: row.code_hash,
    expires_at: row.expires_at,
  });
  if (fallback.error) throw new Error("Could not store the sign-in code.");
}

type LoginCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string;
  created_at?: string;
  send_count?: number;
  attempts?: number;
};

async function loadLoginCode(subject: string): Promise<LoginCodeRow | null> {
  const client = db();
  if (!client) return null;
  const full = await client
    .from("otp_challenges")
    .select("id, code_hash, expires_at, created_at, send_count, attempts")
    .eq("purpose", PURPOSE)
    .eq("subject", subject)
    .maybeSingle();
  const data = (full.error ? null : full.data) as LoginCodeRow | null;
  const row =
    data ||
    ((
      await client
        .from("otp_challenges")
        .select("id, code_hash, expires_at, created_at")
        .eq("purpose", PURPOSE)
        .eq("subject", subject)
        .maybeSingle()
    ).data as LoginCodeRow | null);
  if (!row?.id) return null;
  const expiresAt = Date.parse(String(row.expires_at || ""));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    await client.from("otp_challenges").delete().eq("id", row.id);
    return null;
  }
  return row;
}

export type LoginCodeResult = "ok" | "bad" | "locked" | "missing";

export async function consumeAdminLoginCode(email: string, code: string): Promise<LoginCodeResult> {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 6) return "bad";
  const client = db();
  if (!client) return "missing";
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().lt("expires_at", new Date().toISOString());
  const data = await loadLoginCode(subject);
  if (!data?.id) return "missing";
  const attempts = Number(data.attempts || 0);
  if (attempts >= MAX_CODE_GUESSES) {
    await client.from("otp_challenges").delete().eq("id", data.id);
    return "locked";
  }
  if (!same(String(data.code_hash || ""), hashCode(subject, digits))) {
    const next = attempts + 1;
    if (next >= MAX_CODE_GUESSES) {
      await client.from("otp_challenges").delete().eq("id", data.id);
      return "locked";
    }
    await client.from("otp_challenges").update({ attempts: next }).eq("id", data.id);
    return "bad";
  }
  const { data: removed } = await client
    .from("otp_challenges")
    .delete()
    .eq("id", data.id)
    .eq("code_hash", data.code_hash)
    .select("id");
  return removed?.length ? "ok" : "bad";
}

const SITE_MODE_PURPOSE = "admin-site-mode";

function hashSiteModeCode(email: string, code: string): string {
  return createHmac("sha256", signingSecret())
    .update(`admin-site-mode:${email}:${code}`)
    .digest("hex");
}

async function storeSiteModeCode(email: string, code: string): Promise<void> {
  const client = db();
  if (!client) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().lt("expires_at", new Date().toISOString());
  await client.from("otp_challenges").delete().eq("purpose", SITE_MODE_PURPOSE).eq("subject", subject);
  const { error } = await client.from("otp_challenges").insert({
    purpose: SITE_MODE_PURPOSE,
    subject,
    code_hash: hashSiteModeCode(subject, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) throw new Error("Could not store the confirmation code.");
}

export async function consumeAdminSiteModeCode(email: string, code: string): Promise<boolean> {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 6) return false;
  const client = db();
  if (!client) return false;
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().lt("expires_at", new Date().toISOString());
  const { data } = await client
    .from("otp_challenges")
    .select("id, code_hash, expires_at")
    .eq("purpose", SITE_MODE_PURPOSE)
    .eq("subject", subject)
    .maybeSingle();
  if (!data?.id) return false;
  const expiresAt = Date.parse(String(data.expires_at || ""));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    await client.from("otp_challenges").delete().eq("id", data.id);
    return false;
  }
  if (!same(String(data.code_hash || ""), hashSiteModeCode(subject, digits))) return false;
  const { data: removed } = await client
    .from("otp_challenges")
    .delete()
    .eq("id", data.id)
    .eq("code_hash", data.code_hash)
    .select("id");
  return Boolean(removed?.length);
}

async function sendSiteModeCodeEmail(to: string, code: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "FinderB <support@finderb.com>";
  if (!key) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} is your FinderB website mode code`,
      text: [
        "FinderB Admin",
        "",
        "Enter this code to change FinderB website mode.",
        "",
        code,
        "",
        "It expires in 15 minutes. If you did not request this, ignore this email.",
      ].join("\n"),
    }),
  });
  return response.ok;
}

export async function sendAdminSiteModeCode(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await storeSiteModeCode(normalized, code);
  } catch (error) {
    console.error("[admin-site-mode-otp] store failed", error instanceof Error ? error.message : "error");
    return { ok: false, error: "Could not prepare the confirmation code. Please try again." };
  }
  const sent = await sendSiteModeCodeEmail(normalized, code);
  if (!sent) {
    const client = db();
    await client
      ?.from("otp_challenges")
      .delete()
      .eq("purpose", SITE_MODE_PURPOSE)
      .eq("subject", normalized);
    return {
      ok: false,
      error: "Could not email the confirmation code. Add RESEND_API_KEY on the admin server and try again.",
    };
  }
  return { ok: true };
}

async function sendLoginCodeEmail(to: string, code: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "FinderB <support@finderb.com>";
  if (!key) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} is your FinderB Admin code`,
      text: [
        "FinderB Admin",
        "",
        "Enter this code to finish signing in.",
        "",
        code,
        "",
        "It expires in 15 minutes. If you did not try to sign in, ignore this email.",
      ].join("\n"),
    }),
  });
  return response.ok;
}

/** Creates a one-time code, stores only its hash, and emails the digits. */
export async function sendAdminLoginCode(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string; retryAfter?: number; locked?: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await loadLoginCode(normalized);
  if (existing) {
    const createdAt = Date.parse(String(existing.created_at || ""));
    const age = Number.isFinite(createdAt) ? Date.now() - createdAt : RESEND_WAIT_MS;
    if (age >= 0 && age < RESEND_WAIT_MS) {
      return {
        ok: false,
        error: "Wait a minute before requesting another code.",
        retryAfter: Math.max(1, Math.ceil((RESEND_WAIT_MS - age) / 1000)),
      };
    }
    if (Number(existing.send_count || 1) >= MAX_CODE_SENDS) {
      return {
        ok: false,
        error: "Too many codes were sent. Enter your password again.",
        locked: true,
      };
    }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await storeCode(normalized, code, Number(existing?.send_count || 0) + 1);
  } catch (error) {
    console.error("[admin-login-otp] store failed", error instanceof Error ? error.message : "error");
    return { ok: false, error: "Could not prepare the sign-in code. Please try again." };
  }
  const sent = await sendLoginCodeEmail(normalized, code);
  if (!sent) {
    const client = db();
    await client?.from("otp_challenges").delete().eq("purpose", PURPOSE).eq("subject", normalized);
    return {
      ok: false,
      error: "Could not email the sign-in code. Add RESEND_API_KEY on the admin server and try again.",
    };
  }
  return { ok: true };
}
