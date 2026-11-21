import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readAdminSession, signAdminSession } from "../../../../lib/adminSessionToken";
import {
  consumeAdminPinCode,
  consumeAdminPinUnlockCode,
  consumePinChangeGrant,
  issuePinChangeGrant,
  sendAdminPinCode,
  sendAdminPinUnlockCode,
} from "../../../../lib/adminPasswordChange";
import { hashPassword, verifyPassword } from "../../../../lib/merchantPassword";

const PIN_LENGTH = 4;
const MAX_FAILS = 6;
const changeAttempts = new Map<string, number[]>();

function allowChange(adminId: string, limit: number) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const stamps = (changeAttempts.get(adminId) || []).filter((time) => now - time < windowMs);
  if (stamps.length >= limit) {
    changeAttempts.set(adminId, stamps);
    return false;
  }
  stamps.push(now);
  changeAttempts.set(adminId, stamps);
  return true;
}

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadAdmin(supabase: SupabaseClient, adminId: string, epoch: number) {
  const { data, error } = await supabase
    .from("admins")
    .select("id, is_disabled, session_epoch")
    .eq("id", adminId)
    .maybeSingle();
  if (error || !data || data.is_disabled) return null;
  const stored = Number(data.session_epoch || 0);
  if (Number.isFinite(stored) && stored !== epoch) return null;
  return data;
}

function digits(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(0, PIN_LENGTH);
}

export async function POST(request: Request) {
  const session = readAdminSession(request.headers.get("x-admin-session") || "");
  if (!session) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }
  const supabase = database();
  if (!supabase) {
    return NextResponse.json({ error: "The panel lock is not available right now." }, { status: 503 });
  }
  const admin = await loadAdmin(supabase, session.adminId, session.epoch);
  if (!admin) {
    return NextResponse.json({ error: "Sign in again to continue.", logout: true }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    pin?: string;
    confirm?: string;
    password?: string;
    code?: string;
    pinToken?: string;
  } | null;
  const action = String(body?.action || "");
  const { data: pinRow } = await supabase
    .from("admin_panel_pins")
    .select("pin_hash, fail_count")
    .eq("admin_id", session.adminId)
    .maybeSingle();

  if (action === "status") {
    return NextResponse.json({
      hasPin: Boolean(pinRow?.pin_hash),
      triesLeft: Math.max(0, MAX_FAILS - Number(pinRow?.fail_count || 0)),
    });
  }

  if (action === "set") {
    const pin = digits(body?.pin);
    const confirm = digits(body?.confirm);
    if (pin.length !== PIN_LENGTH || confirm.length !== PIN_LENGTH) {
      return NextResponse.json({ error: "Use a 4-digit PIN." }, { status: 400 });
    }
    if (pin !== confirm) {
      return NextResponse.json({ error: "Those PINs do not match." }, { status: 400 });
    }
    if (pinRow?.pin_hash) {
      return NextResponse.json({ error: "A PIN is already set for this account." }, { status: 400 });
    }
    const pinHash = await hashPassword(pin);
    const { error } = await supabase.from("admin_panel_pins").insert({
      admin_id: session.adminId,
      pin_hash: pinHash,
      fail_count: 0,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: "Could not save the PIN." }, { status: 500 });
    }
    return NextResponse.json({ success: true, sessionToken: signAdminSession(session.adminId, session.epoch) });
  }

  if (action === "verify") {
    if (!pinRow?.pin_hash) {
      return NextResponse.json({ needsSetup: true });
    }
    const pin = digits(body?.pin);
    if (pin.length !== PIN_LENGTH) {
      return NextResponse.json({ error: "Enter your 4-digit PIN." }, { status: 400 });
    }
    const checked = await verifyPassword(pin, String(pinRow.pin_hash));
    if (checked.valid) {
      await supabase
        .from("admin_panel_pins")
        .update({ fail_count: 0, updated_at: new Date().toISOString() })
        .eq("admin_id", session.adminId);
      return NextResponse.json({
        success: true,
        sessionToken: signAdminSession(session.adminId, session.epoch),
      });
    }
    const fails = Number(pinRow.fail_count || 0) + 1;
    if (fails > 5) {
      await supabase
        .from("admins")
        .update({ session_epoch: Number(admin.session_epoch || 0) + 1 })
        .eq("id", session.adminId);
      await supabase
        .from("admin_panel_pins")
        .update({ fail_count: 0, updated_at: new Date().toISOString() })
        .eq("admin_id", session.adminId);
      return NextResponse.json({
        logout: true,
        error: "Too many wrong PINs. Sign in again with your password and email code.",
      });
    }
    await supabase
      .from("admin_panel_pins")
      .update({ fail_count: fails, updated_at: new Date().toISOString() })
      .eq("admin_id", session.adminId);
    return NextResponse.json({
      success: false,
      triesLeft: MAX_FAILS - fails,
      error: "That PIN is not right.",
    });
  }

  if (action === "change-start") {
    if (!allowChange(`${session.adminId}:password`, 8)) {
      return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
    }
    const { data: account } = await supabase
      .from("admins")
      .select("email, password")
      .eq("id", session.adminId)
      .maybeSingle();
    const password = String(body?.password || "");
    if (!password) return NextResponse.json({ error: "Enter your password." }, { status: 400 });
    const checked = await verifyPassword(password, String(account?.password || ""));
    if (!checked.valid) {
      return NextResponse.json({ error: "That password is not right." }, { status: 401 });
    }
    const email = String(account?.email || "").trim().toLowerCase();
    const sent = await sendAdminPinCode(email);
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: sent.retryAfter ? 429 : 503 });
    }
    return NextResponse.json({ success: true, message: "We emailed a 6-digit code." });
  }

  if (action === "change-code") {
    if (!allowChange(`${session.adminId}:code`, 8)) {
      return NextResponse.json({ error: "Too many code attempts. Start again in a few minutes." }, { status: 429 });
    }
    const { data: account } = await supabase
      .from("admins")
      .select("email")
      .eq("id", session.adminId)
      .maybeSingle();
    const email = String(account?.email || "").trim().toLowerCase();
    const ok = await consumeAdminPinCode(email, String(body?.code || ""));
    if (!ok) {
      return NextResponse.json({ error: "That code is incorrect or has expired." }, { status: 401 });
    }
    const pinToken = await issuePinChangeGrant(session.adminId);
    if (!pinToken) {
      return NextResponse.json({ error: "Could not open the new PIN step. Request a new code." }, { status: 503 });
    }
    return NextResponse.json({ success: true, pinToken });
  }

  if (action === "change") {
    const pin = digits(body?.pin);
    const confirm = digits(body?.confirm);
    if (pin.length !== PIN_LENGTH || pin !== confirm) {
      return NextResponse.json({ error: "Enter the same 4-digit PIN twice." }, { status: 400 });
    }
    const allowed = await consumePinChangeGrant(session.adminId, String(body?.pinToken || ""));
    if (!allowed) {
      return NextResponse.json({ error: "Confirm your password and email code again." }, { status: 401 });
    }
    const pinHash = await hashPassword(pin);
    const saved = pinRow?.pin_hash
      ? await supabase
          .from("admin_panel_pins")
          .update({ pin_hash: pinHash, fail_count: 0, updated_at: new Date().toISOString() })
          .eq("admin_id", session.adminId)
      : await supabase.from("admin_panel_pins").insert({
          admin_id: session.adminId,
          pin_hash: pinHash,
          fail_count: 0,
          updated_at: new Date().toISOString(),
        });
    if (saved.error) return NextResponse.json({ error: "Could not save the new PIN." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "forgot") {
    if (!allowChange(`${session.adminId}:forgot`, 5)) {
      return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
    }
    const { data: account } = await supabase
      .from("admins")
      .select("email")
      .eq("id", session.adminId)
      .maybeSingle();
    const email = String(account?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "This account has no email address." }, { status: 400 });
    const sent = await sendAdminPinUnlockCode(email);
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: sent.retryAfter ? 429 : 503 });
    }
    return NextResponse.json({ success: true, message: "We emailed a 6-digit code." });
  }

  if (action === "forgot-code") {
    if (!allowChange(`${session.adminId}:forgot-code`, 8)) {
      return NextResponse.json({ error: "Too many code attempts. Start again in a few minutes." }, { status: 429 });
    }
    const { data: account } = await supabase
      .from("admins")
      .select("email")
      .eq("id", session.adminId)
      .maybeSingle();
    const email = String(account?.email || "").trim().toLowerCase();
    const ok = await consumeAdminPinUnlockCode(email, String(body?.code || ""));
    if (!ok) {
      return NextResponse.json({ error: "That code is incorrect or has expired." }, { status: 401 });
    }
    if (pinRow?.pin_hash) {
      await supabase
        .from("admin_panel_pins")
        .update({ fail_count: 0, updated_at: new Date().toISOString() })
        .eq("admin_id", session.adminId);
    }
    return NextResponse.json({
      success: true,
      sessionToken: signAdminSession(session.adminId, session.epoch),
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
