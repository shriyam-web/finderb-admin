import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminSiteModeCode } from "../../../../../lib/adminLoginOtp";
import { isDeveloperRole } from "../../../../../lib/adminTabAccess";
import { verifyPassword } from "../../../../../lib/merchantPassword";

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
      adminId?: string;
      password?: string;
    };
    const adminId = body.adminId?.trim() || "";
    const password = body.password ?? "";
    if (!adminId || !password) {
      return NextResponse.json(
        { success: false, error: "Admin password is required." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, email, role, password, is_disabled")
      .eq("id", adminId)
      .maybeSingle();

    if (error || !admin) {
      return NextResponse.json(
        { success: false, error: "Incorrect admin password." },
        { status: 401 },
      );
    }
    if (admin.is_disabled) {
      return NextResponse.json(
        { success: false, error: "This admin account is disabled." },
        { status: 403 },
      );
    }
    if (!isDeveloperRole(admin.role)) {
      return NextResponse.json(
        { success: false, error: "Only the Developer can turn on maintenance mode." },
        { status: 403 },
      );
    }

    const verification = await verifyPassword(password, String(admin.password || ""));
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: "Incorrect admin password." },
        { status: 401 },
      );
    }

    const sent = await sendAdminSiteModeCode(String(admin.email));
    if (!sent.ok) {
      return NextResponse.json({ success: false, error: sent.error }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: `We emailed a 6-digit code to ${admin.email}.`,
    });
  } catch (error) {
    console.error("[site-mode otp] failed", error);
    return NextResponse.json(
      { success: false, error: "Could not send the confirmation code." },
      { status: 500 },
    );
  }
}
