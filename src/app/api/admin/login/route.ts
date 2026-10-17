import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, verifyPassword } from "../../../../lib/merchantPassword";
import {
  requestIp,
  sendAdminLoginCode,
  signLoginChallenge,
  takeLoginAttempt,
} from "../../../../lib/adminLoginOtp";

let unknownPasswordHash: Promise<string> | null = null;

async function spendUnknownPasswordTime(password: string) {
  unknownPasswordHash ||= hashPassword("finderb-admin-unknown-account");
  await verifyPassword(password, await unknownPasswordHash);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password ?? "";
    if (email && password) {
      const gate = await takeLoginAttempt(requestIp(request), email);
      if (!gate.ok) {
        return NextResponse.json(
          {
            success: false,
            error: "Too many sign-in attempts. Wait a minute and try again.",
            retryAfter: gate.retryAfter,
          },
          { status: 429 },
        );
      }
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    const baseFields =
      "id, email, password, role, is_disabled, allowed_tabs, allowed_tab_modes, login_enabled";

    type AdminLoginRow = {
      id: string;
      email: string;
      password: string;
      role: string;
      is_disabled: boolean | null;
      allowed_tabs: string[] | null;
      allowed_tab_modes?: Record<string, string> | null;
      display_name?: string | null;
      login_enabled?: boolean | null;
    };

    // Prefer display_name when the column exists (db/add_admin_display_name.sql).
    let admin: AdminLoginRow | null = null;
    let error: { message: string } | null = null;

    {
      const primary = await supabase
        .from("admins")
        .select(`${baseFields}, display_name`)
        .ilike("email", email)
        .maybeSingle();
      admin = primary.data as AdminLoginRow | null;
      error = primary.error;
    }

    if (error && /login_enabled/i.test(error.message || "")) {
      const withoutLogin = await supabase
        .from("admins")
        .select(
          "id, email, password, role, is_disabled, allowed_tabs, allowed_tab_modes, display_name",
        )
        .ilike("email", email)
        .maybeSingle();
      admin = withoutLogin.data as AdminLoginRow | null;
      error = withoutLogin.error;
    }

    if (error && /allowed_tab_modes/i.test(error.message || "")) {
      const withoutModes = await supabase
        .from("admins")
        .select("id, email, password, role, is_disabled, allowed_tabs, display_name")
        .ilike("email", email)
        .maybeSingle();
      admin = withoutModes.data as AdminLoginRow | null;
      error = withoutModes.error;
    }

    if (error && /display_name/i.test(error.message || "")) {
      const fallback = await supabase
        .from("admins")
        .select(baseFields)
        .ilike("email", email)
        .maybeSingle();
      admin = fallback.data as AdminLoginRow | null;
      error = fallback.error;
    }

    if (error && /allowed_tab_modes/i.test(error.message || "")) {
      const bare = await supabase
        .from("admins")
        .select("id, email, password, role, is_disabled, allowed_tabs")
        .ilike("email", email)
        .maybeSingle();
      admin = bare.data as AdminLoginRow | null;
      error = bare.error;
    }

    if (error) {
      console.error("[admin login] lookup failed:", error.message);
      return NextResponse.json(
        { success: false, error: "Unable to sign in right now. Please try again." },
        { status: 500 },
      );
    }

    if (!admin) {
      await spendUnknownPasswordTime(password);
      return NextResponse.json(
        { success: false, error: "Incorrect email or password. Please try again." },
        { status: 401 },
      );
    }

    const verification = await verifyPassword(password, String(admin.password || ""));
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: "Incorrect email or password. Please try again." },
        { status: 401 },
      );
    }

    if (admin.is_disabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account has been disabled. Please contact a Developer.",
        },
        { status: 403 },
      );
    }

    if (verification.needsRehash) {
      const hashed = await hashPassword(password);
      const { error: rehashError } = await supabase
        .from("admins")
        .update({ password: hashed })
        .eq("id", admin.id);
      if (rehashError) {
        console.error("[admin login] rehash failed:", rehashError.message);
      }
    }

    const sent = await sendAdminLoginCode(admin.email);
    if (!sent.ok && !sent.retryAfter && !sent.locked) {
      return NextResponse.json({ success: false, error: sent.error }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      step: "email",
      challenge: signLoginChallenge(admin.id),
      retryAfter: sent.ok ? 60 : sent.retryAfter ?? 60,
    });
  } catch (error) {
    console.error("[admin login] unexpected:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during login." },
      { status: 500 },
    );
  }
}
