import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword } from "../../../../lib/merchantPassword";
import {
  changeAdminPassword,
  consumeAdminPasswordCode,
  issuePasswordChangeGrant,
  sendAdminPasswordCode,
} from "../../../../lib/adminPasswordChange";

const attempts = new Map<string, number[]>();

function allow(adminId: string, limit: number) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const stamps = (attempts.get(adminId) || []).filter((time) => now - time < windowMs);
  if (stamps.length >= limit) {
    attempts.set(adminId, stamps);
    return false;
  }
  stamps.push(now);
  attempts.set(adminId, stamps);
  return true;
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadAdmin(adminId: string) {
  const supabase = service();
  if (!supabase) return { error: "Password storage is not available.", status: 503 as const };
  const { data, error } = await supabase
    .from("admins")
    .select("id, email, password, is_disabled")
    .eq("id", adminId)
    .maybeSingle();
  if (error || !data) return { error: "Could not verify this admin account.", status: 401 as const };
  if (data.is_disabled) return { error: "This admin account is disabled.", status: 403 as const };
  return { admin: data };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      adminId?: string;
      currentPassword?: string;
      code?: string;
      changeToken?: string;
      newPassword?: string;
      confirmPassword?: string;
    } | null;
    const adminId = String(body?.adminId || "").trim();
    const action = String(body?.action || "");
    if (!adminId || !action) {
      return NextResponse.json(
        { success: false, error: "Admin session is required." },
        { status: 400 },
      );
    }

    const loaded = await loadAdmin(adminId);
    if ("error" in loaded) {
      return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status });
    }
    const admin = loaded.admin;
    const email = String(admin.email || "").trim().toLowerCase();

    if (action === "verify") {
      if (!allow(`verify:${adminId}`, 8)) {
        return NextResponse.json(
          { success: false, error: "Too many attempts. Wait a few minutes and try again." },
          { status: 429 },
        );
      }
      const currentPassword = String(body?.currentPassword || "");
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Enter your current password." },
          { status: 400 },
        );
      }
      const verification = await verifyPassword(currentPassword, String(admin.password || ""));
      if (!verification.valid) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect." },
          { status: 401 },
        );
      }
      const sent = await sendAdminPasswordCode(email);
      if (!sent.ok) {
        return NextResponse.json(
          { success: false, error: sent.error, retryAfter: sent.retryAfter },
          { status: sent.retryAfter ? 429 : 503 },
        );
      }
      return NextResponse.json({
        success: true,
        message: `We emailed a 6-digit code to ${email}.`,
      });
    }

    if (action === "confirm") {
      if (!allow(`otp:${adminId}`, 8)) {
        return NextResponse.json(
          { success: false, error: "Too many code attempts. Start again in a few minutes." },
          { status: 429 },
        );
      }
      const ok = await consumeAdminPasswordCode(email, String(body?.code || ""));
      if (!ok) {
        return NextResponse.json(
          { success: false, error: "That code is incorrect or has expired." },
          { status: 401 },
        );
      }
      const changeToken = await issuePasswordChangeGrant(adminId);
      if (!changeToken) {
        return NextResponse.json(
          { success: false, error: "Could not open the new password step. Request a new code." },
          { status: 503 },
        );
      }
      return NextResponse.json({ success: true, changeToken });
    }

    if (action === "change") {
      const result = await changeAdminPassword({
        adminId,
        changeToken: String(body?.changeToken || ""),
        newPassword: String(body?.newPassword || ""),
        confirmPassword: String(body?.confirmPassword || ""),
        email,
        currentHash: String(admin.password || ""),
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: result.emailed
          ? "Password updated. A confirmation email is on its way."
          : "Password updated. The confirmation email could not be sent.",
      });
    }

    return NextResponse.json({ success: false, error: "Unknown password action." }, { status: 400 });
  } catch (error) {
    console.error("[admin password] failed", error instanceof Error ? error.message : "error");
    return NextResponse.json(
      { success: false, error: "Could not change the password." },
      { status: 500 },
    );
  }
}
