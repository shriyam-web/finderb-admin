import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  resetForgottenAdminPassword,
  sendAdminResetCode,
} from "../../../../../lib/adminPasswordChange";
import { requestIp } from "../../../../../lib/adminLoginOtp";

const attempts = new Map<string, number[]>();

function allow(key: string, limit: number) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const stamps = (attempts.get(key) || []).filter((time) => now - time < windowMs);
  if (stamps.length >= limit) {
    attempts.set(key, stamps);
    return false;
  }
  stamps.push(now);
  attempts.set(key, stamps);
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

const GENERIC =
  "If this email belongs to an admin account, we sent a 6-digit code. It expires in 15 minutes.";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      email?: string;
      code?: string;
      newPassword?: string;
      confirmPassword?: string;
    } | null;
    const email = String(body?.email || "").trim().toLowerCase();
    const action = String(body?.action || "");
    if (!email || !email.includes("@") || (action !== "request" && action !== "reset")) {
      return NextResponse.json(
        { success: false, error: "Enter the email on your admin account." },
        { status: 400 },
      );
    }

    const ip = requestIp(request);
    if (!allow(`${action}:${ip}:${email}`, action === "request" ? 5 : 8)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Wait a few minutes and try again.", retryAfter: 60 },
        { status: 429 },
      );
    }

    const supabase = service();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Password reset is not available right now." },
        { status: 503 },
      );
    }

    const { data, error } = await supabase
      .from("admins")
      .select("id, email, password, is_disabled")
      .ilike("email", email)
      .maybeSingle();
    if (error) {
      console.error("[admin-reset] lookup failed", error.message);
      return NextResponse.json(
        { success: false, error: "Could not start the reset. Please try again." },
        { status: 500 },
      );
    }

    const admin = data as {
      id: string;
      email: string;
      password: string | null;
      is_disabled: boolean | null;
    } | null;

    if (action === "request") {
      if (!admin || admin.is_disabled) {
        return NextResponse.json({ success: true, message: GENERIC });
      }
      const sent = await sendAdminResetCode(String(admin.email || email));
      if (!sent.ok) {
        return NextResponse.json(
          { success: false, error: sent.error, retryAfter: sent.retryAfter },
          { status: sent.retryAfter ? 429 : 503 },
        );
      }
      return NextResponse.json({
        success: true,
        message: "We emailed a 6-digit code. It expires in 15 minutes.",
      });
    }

    if (!admin || admin.is_disabled) {
      return NextResponse.json(
        { success: false, error: "That code is incorrect or has expired." },
        { status: 401 },
      );
    }

    const saved = await resetForgottenAdminPassword({
      email: String(admin.email || email),
      code: String(body?.code || ""),
      newPassword: String(body?.newPassword || ""),
      confirmPassword: String(body?.confirmPassword || ""),
      currentHash: String(admin.password || ""),
      adminId: admin.id,
    });
    if (!saved.ok) {
      return NextResponse.json({ success: false, error: saved.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      message: "Password updated. Sign in with the new password.",
    });
  } catch (error) {
    console.error("[admin-reset] failed", error instanceof Error ? error.message : "error");
    return NextResponse.json(
      { success: false, error: "Could not reset the password. Please try again." },
      { status: 500 },
    );
  }
}
