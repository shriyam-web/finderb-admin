import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword } from "../../../../lib/merchantPassword";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

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
        { success: false, error: "Admin id and password are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, password, is_disabled")
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

    const verification = await verifyPassword(password, String(admin.password || ""));
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: "Incorrect admin password." },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin verify] unexpected:", error);
    return NextResponse.json(
      { success: false, error: "Verification failed." },
      { status: 500 },
    );
  }
}
