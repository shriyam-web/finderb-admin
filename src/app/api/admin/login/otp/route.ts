import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  consumeAdminLoginCode,
  readLoginChallenge,
  sendAdminLoginCode,
  signLoginChallenge,
} from "../../../../../lib/adminLoginOtp";
import { isConsoleLoginUnlocked, normalizeAccessFields } from "../../../../../lib/adminTabAccess";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      challenge?: string;
      code?: string;
      resend?: boolean;
    };
    const challenge = readLoginChallenge(body.challenge || "");
    if (!challenge) {
      return NextResponse.json(
        { success: false, error: "This sign-in step expired. Enter your password again." },
        { status: 401 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select(
        "id, email, role, is_disabled, allowed_tabs, allowed_tab_modes, login_enabled, display_name",
      )
      .eq("id", challenge.adminId)
      .maybeSingle();

    if (error || !admin) {
      return NextResponse.json(
        { success: false, error: "This sign-in step expired. Enter your password again." },
        { status: 401 },
      );
    }
    if (admin.is_disabled) {
      return NextResponse.json(
        { success: false, error: "Your account has been disabled. Please contact a Developer." },
        { status: 403 },
      );
    }

    if (body.resend) {
      const sent = await sendAdminLoginCode(admin.email);
      if (!sent.ok) {
        return NextResponse.json({ success: false, error: sent.error }, { status: 503 });
      }
      return NextResponse.json({
        success: true,
        step: "email",
        challenge: signLoginChallenge(admin.id),
      });
    }

    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit code from your email." },
        { status: 400 },
      );
    }
    if (!(await consumeAdminLoginCode(admin.email, code))) {
      return NextResponse.json(
        { success: false, error: "That code is invalid or expired. Request a new one." },
        { status: 401 },
      );
    }

    const { error: logError } = await supabase.from("admin_login_logs").insert([
      { admin_id: admin.id, admin_email: admin.email },
    ]);
    if (logError) console.error("[admin login] log failed:", logError.message);

    const access = normalizeAccessFields(admin.allowed_tabs, admin.allowed_tab_modes);
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        allowed_tabs: access.allowed_tabs,
        allowed_tab_modes: access.allowed_tab_modes,
        displayName: admin.display_name?.trim() || null,
        loginEnabled: isConsoleLoginUnlocked(admin.role, admin.login_enabled),
      },
    });
  } catch (error) {
    console.error("[admin email otp] unexpected:", error);
    return NextResponse.json(
      { success: false, error: "Could not finish email sign-in." },
      { status: 500 },
    );
  }
}
