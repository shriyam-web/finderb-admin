import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readAdminChallenge, verifyTotp } from "../../../../../lib/adminTotp";
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
    const body = (await request.json()) as { challenge?: string; code?: string };
    const challenge = readAdminChallenge(body.challenge || "");
    const code = String(body.code || "").replace(/\D/g, "");
    if (!challenge || code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit code from your authenticator app." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select(
        "id, email, role, is_disabled, allowed_tabs, allowed_tab_modes, login_enabled, display_name, totp_secret, totp_confirmed_at",
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

    const storedSecret = String(admin.totp_secret || "");
    const alreadyEnrolled = Boolean(storedSecret && admin.totp_confirmed_at);
    const secret = challenge.mode === "enroll" ? challenge.pendingSecret || "" : storedSecret;
    if (challenge.mode === "enroll" && alreadyEnrolled) {
      return NextResponse.json(
        { success: false, error: "This authenticator is already set up. Enter the current code." },
        { status: 400 },
      );
    }
    if (!verifyTotp(secret, code)) {
      return NextResponse.json(
        { success: false, error: "That code is not valid. Use the current code from your authenticator app." },
        { status: 401 },
      );
    }

    if (challenge.mode === "enroll") {
      const { data: saved, error: saveError } = await supabase
        .from("admins")
        .update({
          totp_secret: secret,
          totp_confirmed_at: new Date().toISOString(),
        })
        .eq("id", admin.id)
        .is("totp_confirmed_at", null)
        .select("id");
      if (saveError || !saved?.length) {
        console.error("[admin totp] save failed:", saveError.message);
        return NextResponse.json(
          { success: false, error: "Could not save the authenticator. Try signing in again." },
          { status: 500 },
        );
      }
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
    console.error("[admin totp] unexpected:", error);
    return NextResponse.json(
      { success: false, error: "Could not finish two-factor sign-in." },
      { status: 500 },
    );
  }
}
