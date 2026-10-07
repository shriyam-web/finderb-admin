import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

const OTP_TTL_MS = 15 * 60 * 1000;
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const PURPOSE = "admin-login";

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

async function storeCode(email: string, code: string): Promise<void> {
  const client = db();
  if (!client) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().lt("expires_at", new Date().toISOString());
  await client.from("otp_challenges").delete().eq("purpose", PURPOSE).eq("subject", subject);
  const { error } = await client.from("otp_challenges").insert({
    purpose: PURPOSE,
    subject,
    code_hash: hashCode(subject, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) throw new Error("Could not store the sign-in code.");
}

export async function consumeAdminLoginCode(email: string, code: string): Promise<boolean> {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 6) return false;
  const client = db();
  if (!client) return false;
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().lt("expires_at", new Date().toISOString());
  const { data } = await client
    .from("otp_challenges")
    .select("id, code_hash, expires_at")
    .eq("purpose", PURPOSE)
    .eq("subject", subject)
    .maybeSingle();
  if (!data?.id) return false;
  const expiresAt = Date.parse(String(data.expires_at || ""));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    await client.from("otp_challenges").delete().eq("id", data.id);
    return false;
  }
  if (!same(String(data.code_hash || ""), hashCode(subject, digits))) return false;
  const { data: removed } = await client
    .from("otp_challenges")
    .delete()
    .eq("id", data.id)
    .eq("code_hash", data.code_hash)
    .select("id");
  return Boolean(removed?.length);
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
export async function sendAdminLoginCode(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await storeCode(normalized, code);
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
