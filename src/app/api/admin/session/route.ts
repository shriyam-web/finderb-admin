import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readAdminSession, sessionNeedsRefresh, signAdminSession } from "../../../../lib/adminSessionToken";

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
    const body = (await request.json().catch(() => null)) as {
      adminId?: string;
      loginLogId?: string;
      action?: string;
    } | null;
    if (!body) return NextResponse.json({ success: true });
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

    let sessionToken: string | undefined;
    if (action === "heartbeat") {
      try {
        const session = readAdminSession(request.headers.get("x-admin-session") || "");
        if (session && session.adminId === adminId && sessionNeedsRefresh(session)) {
          const epochRow = await supabase.from("admins").select("session_epoch").eq("id", adminId).maybeSingle();
          const epoch = !epochRow.error && epochRow.data ? Number(epochRow.data.session_epoch || 0) : session.epoch;
          if (epoch === session.epoch) sessionToken = signAdminSession(adminId, epoch);
        }
      } catch {
        sessionToken = undefined;
      }
    }

    return NextResponse.json({ success: true, sessionToken });
  } catch (error) {
    console.error("[admin session] failed", error);
    return NextResponse.json({ success: true });
  }
}
