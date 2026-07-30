import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, verifyPassword } from "../../../../lib/merchantPassword";

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
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    const baseFields =
      "id, email, password, role, is_disabled, allowed_tabs";

    type AdminLoginRow = {
      id: string;
      email: string;
      password: string;
      role: string;
      is_disabled: boolean | null;
      allowed_tabs: string[] | null;
      display_name?: string | null;
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

    if (error && /display_name/i.test(error.message || "")) {
      const fallback = await supabase
        .from("admins")
        .select(baseFields)
        .ilike("email", email)
        .maybeSingle();
      admin = fallback.data as AdminLoginRow | null;
      error = fallback.error;
    }

    if (error) {
      console.error("[admin login] lookup failed:", error.message);
      return NextResponse.json(
        { success: false, error: "Unable to sign in right now. Please try again." },
        { status: 500 },
      );
    }

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Incorrect email or password. Please try again." },
        { status: 401 },
      );
    }

    if (admin.is_disabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account has been disabled. Please contact the Controller.",
        },
        { status: 403 },
      );
    }

    const verification = await verifyPassword(password, String(admin.password || ""));
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: "Incorrect email or password. Please try again." },
        { status: 401 },
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

    const { error: logError } = await supabase.from("admin_login_logs").insert([
      {
        admin_id: admin.id,
        admin_email: admin.email,
      },
    ]);

    if (logError) {
      console.error("[admin login] log failed:", logError.message);
    }

    const displayName = admin.display_name?.trim() || null;

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        allowed_tabs: admin.allowed_tabs ?? null,
        displayName,
      },
    });
  } catch (error) {
    console.error("[admin login] unexpected:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during login." },
      { status: 500 },
    );
  }
}
