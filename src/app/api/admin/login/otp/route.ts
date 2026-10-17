import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  consumeAdminLoginCode,
  readLoginChallenge,
  requestIp,
  sendAdminLoginCode,
  signLoginChallenge,
  takeOtpCheck,
} from "../../../../../lib/adminLoginOtp";
import { signAdminSession } from "../../../../../lib/adminSessionToken";
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
        const status = sent.retryAfter || sent.locked ? 429 : 503;
        return NextResponse.json(
          { success: false, error: sent.error, retryAfter: sent.retryAfter ?? null },
          { status },
        );
      }
      return NextResponse.json({
        success: true,
        step: "email",
        challenge: signLoginChallenge(admin.id),
        retryAfter: 60,
      });
    }

    const pace = await takeOtpCheck(requestIp(request));
    if (!pace.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many code attempts. Wait a minute and try again.",
          retryAfter: pace.retryAfter,
        },
        { status: 429 },
      );
    }

    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit code from your email." },
        { status: 400 },
      );
    }
    const verdict = await consumeAdminLoginCode(admin.email, code);
    if (verdict === "locked") {
      return NextResponse.json(
        { success: false, error: "Too many incorrect codes. Enter your password again." },
        { status: 401 },
      );
    }
    if (verdict !== "ok") {
      return NextResponse.json(
        { success: false, error: "That code is invalid or expired." },
        { status: 401 },
      );
    }

    const forwarded = request.headers.get("x-forwarded-for") || "";
    const ipAddress = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent");
    const nowIso = new Date().toISOString();
    let logRow: { id: string } | null = null;
    const withDuration = await supabase
      .from("admin_login_logs")
      .insert([
        {
          admin_id: admin.id,
          admin_email: admin.email,
          login_time: nowIso,
          last_seen_at: nowIso,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      ])
      .select("id")
      .maybeSingle();
    if (withDuration.error && /last_seen_at|ip_address|user_agent/i.test(withDuration.error.message)) {
      const basic = await supabase
        .from("admin_login_logs")
        .insert([{ admin_id: admin.id, admin_email: admin.email }])
        .select("id")
        .maybeSingle();
      logRow = basic.data;
      if (basic.error) console.error("[admin login] log failed:", basic.error.message);
    } else if (withDuration.error) {
      console.error("[admin login] log failed:", withDuration.error.message);
    } else {
      logRow = withDuration.data;
    }

    const access = normalizeAccessFields(admin.allowed_tabs, admin.allowed_tab_modes);
    return NextResponse.json({
      success: true,
      loginLogId: logRow?.id ?? null,
      sessionToken: signAdminSession(admin.id),
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
