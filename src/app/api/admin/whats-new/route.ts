import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDeveloperRole } from "../../../../lib/adminTabAccess";
import { readAdminSession } from "../../../../lib/adminSessionToken";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function DELETE(request: Request) {
  try {
    const session = readAdminSession(request.headers.get("x-admin-session") || "");
    if (!session) {
      return NextResponse.json({ error: "Sign in again to remove an update." }, { status: 401 });
    }

    const body = (await request.json()) as { id?: string };
    const id = String(body.id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Choose an update to remove." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, role, is_disabled")
      .eq("id", session.adminId)
      .maybeSingle();
    if (adminError || !admin || admin.is_disabled || !isDeveloperRole(admin.role)) {
      return NextResponse.json(
        { error: "Only a Developer can remove What's New updates." },
        { status: 403 },
      );
    }

    const { data: item, error: itemError } = await supabase
      .from("admin_whats_new")
      .select("id, title")
      .eq("id", id)
      .maybeSingle();
    if (itemError) {
      return NextResponse.json({ error: "That update could not be removed." }, { status: 500 });
    }
    if (!item) return NextResponse.json({ ok: true });

    const title = String(item.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "That update could not be removed." }, { status: 500 });
    }

    const { error: removedError } = await supabase.from("admin_whats_new_removed").upsert(
      {
        title,
        removed_at: new Date().toISOString(),
        removed_by: admin.id,
      },
      { onConflict: "title" },
    );
    if (removedError) {
      return NextResponse.json({ error: "That update could not be removed." }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from("admin_whats_new").delete().eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: "That update could not be removed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[whats-new] delete failed", error);
    return NextResponse.json({ error: "That update could not be removed." }, { status: 500 });
  }
}
