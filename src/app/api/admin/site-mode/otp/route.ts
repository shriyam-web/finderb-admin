import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminSiteModeCode } from "../../../../../lib/adminLoginOtp";
import { isDeveloperRole } from "../../../../../lib/adminTabAccess";

const otpWindow = new Map<string, number[]>();

function allowOtpSend(adminId: string) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const stamps = (otpWindow.get(adminId) || []).filter((time) => now - time < windowMs);
  if (stamps.length >= 5) {
    otpWindow.set(adminId, stamps);
    return false;
  }
  stamps.push(now);
  otpWindow.set(adminId, stamps);
  return true;
}

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
    };
    const adminId = body.adminId?.trim() || "";
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session is required." },
        { status: 400 },
      );
    }
    if (!allowOtpSend(adminId)) {
      return NextResponse.json(
        { success: false, error: "Please wait before requesting another code." },
        { status: 429 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, email, role, is_disabled")
      .eq("id", adminId)
      .maybeSingle();

    if (error || !admin) {
      return NextResponse.json(
        { success: false, error: "Could not verify this admin account." },
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
        { success: false, error: "Only the Developer can change FinderB website mode." },
        { status: 403 },
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
