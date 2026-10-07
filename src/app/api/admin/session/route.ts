import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      loginLogId?: string;
      action?: string;
    };
    const adminId = body.adminId?.trim() || "";
    const loginLogId = body.loginLogId?.trim() || "";
    const action = body.action === "end" ? "end" : "heartbeat";
    if (!adminId || !loginLogId) {
      return NextResponse.json({ success: false, error: "Missing session." }, { status: 400 });
    }

    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const patch =
      action === "end"
        ? { last_seen_at: nowIso, logout_at: nowIso }
        : { last_seen_at: nowIso };

    const { error } = await supabase
      .from("admin_login_logs")
      .update(patch)
      .eq("id", loginLogId)
      .eq("admin_id", adminId)
      .is("logout_at", null);

    if (error) {
      console.error("[admin session] update failed:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin session] failed", error);
    return NextResponse.json({ success: true });
  }
}
