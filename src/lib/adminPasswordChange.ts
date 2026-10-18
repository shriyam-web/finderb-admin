import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashPassword, verifyPassword } from "./merchantPassword";
import { validateAdminPasswordChange } from "./adminPasswordPolicy";

const OTP_TTL_MS = 15 * 60 * 1000;
const GRANT_TTL_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const CODE_PURPOSE = "admin-password";
const GRANT_PURPOSE = "admin-password-grant";

type Grant = { adminId: string; exp: number };

function signingSecret(): string {
  const secret =
    process.env.ADMIN_2FA_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Set ADMIN_2FA_SECRET or SUPABASE_SERVICE_ROLE_KEY for admin email codes.");
  }
  return secret;
}

function service(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hashValue(label: string, subject: string, value: string): string {
  return createHmac("sha256", signingSecret()).update(`${label}:${subject}:${value}`).digest("hex");
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "FinderB <support@finderb.com>";
  if (!key) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  return response.ok;
}

async function storeCode(email: string, code: string): Promise<void> {
  const client = service();
  if (!client) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  const subject = email.trim().toLowerCase();
  await client.from("otp_challenges").delete().eq("purpose", CODE_PURPOSE).eq("subject", subject);
  const { error } = await client.from("otp_challenges").insert({
    purpose: CODE_PURPOSE,
    subject,
    code_hash: hashValue("admin-password", subject, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    send_count: 1,
  });
  if (!error) return;
  const fallback = await client.from("otp_challenges").insert({
    purpose: CODE_PURPOSE,
    subject,
    code_hash: hashValue("admin-password", subject, code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (fallback.error) throw new Error("Could not store the confirmation code.");
}

async function recentCodeAge(email: string): Promise<number | null> {
  const client = service();
  if (!client) return null;
  const { data } = await client
    .from("otp_challenges")
    .select("expires_at")
    .eq("purpose", CODE_PURPOSE)
    .eq("subject", email.trim().toLowerCase())
    .maybeSingle();
  const expiresAt = Date.parse(String(data?.expires_at || ""));
  if (!Number.isFinite(expiresAt)) return null;
  return OTP_TTL_MS - (expiresAt - Date.now());
}

export async function sendAdminPasswordCode(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string; retryAfter?: number }> {
  const normalized = email.trim().toLowerCase();
  const age = await recentCodeAge(normalized);
  if (age != null && age >= 0 && age < RESEND_WAIT_MS) {
    return {
      ok: false,
      error: "Please wait a minute before requesting another code.",
      retryAfter: Math.ceil((RESEND_WAIT_MS - age) / 1000),
    };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await storeCode(normalized, code);
  } catch (error) {
    console.error(
      "[admin-password-otp] store failed",
      error instanceof Error ? error.message : "error",
    );
    return { ok: false, error: "Could not prepare the confirmation code. Please try again." };
  }
  const sent = await sendEmail(
    normalized,
    `${code} is your FinderB password code`,
    [
      "FinderB Admin",
      "",
      "Enter this code to continue changing your admin password.",
      "",
      code,
      "",
      "It expires in 15 minutes. If you did not ask to change your password, ignore this email.",
    ].join("\n"),
  );
  if (!sent) {
    await service()
      ?.from("otp_challenges")
      .delete()
      .eq("purpose", CODE_PURPOSE)
      .eq("subject", normalized);
    return {
      ok: false,
      error: "Could not email the confirmation code. Try again in a moment.",
    };
  }
  return { ok: true };
}

export async function consumeAdminPasswordCode(email: string, code: string): Promise<boolean> {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 6) return false;
  const client = service();
  if (!client) return false;
  const subject = email.trim().toLowerCase();
  const { data } = await client
    .from("otp_challenges")
    .select("id, code_hash, expires_at, attempts")
    .eq("purpose", CODE_PURPOSE)
    .eq("subject", subject)
    .maybeSingle();
  if (!data?.id) return false;
  const expiresAt = Date.parse(String(data.expires_at || ""));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    await client.from("otp_challenges").delete().eq("id", data.id);
    return false;
  }
  const attempts = Number(data.attempts || 0);
  if (attempts >= 5) {
    await client.from("otp_challenges").delete().eq("id", data.id);
    return false;
  }
  if (!same(String(data.code_hash || ""), hashValue("admin-password", subject, digits))) {
    await client
      .from("otp_challenges")
      .update({ attempts: attempts + 1 })
      .eq("id", data.id);
    return false;
  }
  const { data: removed } = await client
    .from("otp_challenges")
    .delete()
    .eq("id", data.id)
    .eq("code_hash", data.code_hash)
    .select("id");
  return Boolean(removed?.length);
}

function signGrant(adminId: string): string {
  const body = Buffer.from(
    JSON.stringify({ adminId, exp: Date.now() + GRANT_TTL_MS } satisfies Grant),
  ).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(`grant:${body}`).digest("base64url");
  return `${body}.${sig}`;
}

function readGrant(token: string): Grant | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(`grant:${body}`).digest("base64url");
  if (!same(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Grant;
    if (!parsed?.adminId || !Number.isFinite(parsed.exp) || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function issuePasswordChangeGrant(adminId: string): Promise<string | null> {
  const client = service();
  if (!client) return null;
  const token = signGrant(adminId);
  await client.from("otp_challenges").delete().eq("purpose", GRANT_PURPOSE).eq("subject", adminId);
  const { error } = await client.from("otp_challenges").insert({
    purpose: GRANT_PURPOSE,
    subject: adminId,
    code_hash: hashValue("admin-password-grant", adminId, token),
    expires_at: new Date(Date.now() + GRANT_TTL_MS).toISOString(),
  });
  if (error) return null;
  return token;
}

async function consumeGrant(adminId: string, token: string): Promise<boolean> {
  const parsed = readGrant(token);
  if (!parsed || parsed.adminId !== adminId) return false;
  const client = service();
  if (!client) return false;
  const { data } = await client
    .from("otp_challenges")
    .select("id, code_hash, expires_at")
    .eq("purpose", GRANT_PURPOSE)
    .eq("subject", adminId)
    .maybeSingle();
  if (!data?.id) return false;
  const expiresAt = Date.parse(String(data.expires_at || ""));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    await client.from("otp_challenges").delete().eq("id", data.id);
    return false;
  }
  if (!same(String(data.code_hash || ""), hashValue("admin-password-grant", adminId, token))) {
    return false;
  }
  const { data: removed } = await client
    .from("otp_challenges")
    .delete()
    .eq("id", data.id)
    .eq("code_hash", data.code_hash)
    .select("id");
  return Boolean(removed?.length);
}

export async function changeAdminPassword(input: {
  adminId: string;
  changeToken: string;
  newPassword: string;
  confirmPassword: string;
  email: string;
  currentHash: string;
}): Promise<{ ok: true; emailed: boolean } | { ok: false; error: string }> {
  const next = input.newPassword.trim();
  const confirm = input.confirmPassword.trim();
  const policy = validateAdminPasswordChange({
    newPassword: next,
    confirmPassword: confirm,
    email: input.email,
  });
  if (policy) return { ok: false, error: policy };

  const sameAsCurrent = await verifyPassword(next, input.currentHash);
  if (sameAsCurrent.valid) {
    return { ok: false, error: "Choose a password that is different from your current one." };
  }

  const granted = await consumeGrant(input.adminId, input.changeToken);
  if (!granted) {
    return { ok: false, error: "This password change expired. Start again from your current password." };
  }

  const client = service();
  if (!client) return { ok: false, error: "Password storage is not available." };
  const hashed = await hashPassword(next);
  const { error } = await client
    .from("admins")
    .update({ password: hashed })
    .eq("id", input.adminId);
  if (error) {
    console.error("[admin-password] update failed", error.message);
    return { ok: false, error: "Could not save the new password." };
  }

  const emailed = await sendEmail(
    input.email,
    "Your FinderB admin password was changed",
    [
      "FinderB Admin",
      "",
      "The password for your admin account was just changed.",
      "",
      "If you made this change, no further action is needed.",
      "If you did not, contact the Developer and sign in to set a new password.",
      "",
      `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    ].join("\n"),
  );
  return { ok: true, emailed };
}
