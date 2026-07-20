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

    // Look up by email only — never filter by password in SQL
    // (passwords may be scrypt-hashed; .single() caused HTTP 406 on 0 rows).
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, email, password, role, is_disabled, allowed_tabs")
      .ilike("email", email)
      .maybeSingle();

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

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        allowed_tabs: admin.allowed_tabs ?? null,
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
