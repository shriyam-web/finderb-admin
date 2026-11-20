import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readAdminSession } from "@/lib/adminSessionToken";
import { amazonImageStorageActive } from "@/lib/mediaEnv";
import { finishIncomingImage, newIncomingKey, presignIncomingUpload, storeAdminAvatar } from "@/lib/mediaObject";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const session = readAdminSession(request.headers.get("x-admin-session") || "");
  if (!session) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }
  const supabase = database();
  if (!supabase) {
    return NextResponse.json({ error: "Photo storage is not available right now." }, { status: 503 });
  }

  const { data: admin, error } = await supabase
    .from("admins")
    .select("id, is_disabled")
    .eq("id", session.adminId)
    .maybeSingle();
  if (error || !admin || admin.is_disabled) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    bytes?: number;
    key?: string;
    image?: string;
  } | null;

  if (body?.action === "remove") {
    const removed = await supabase.from("admins").update({ avatar_url: null }).eq("id", session.adminId);
    if (removed.error) {
      return NextResponse.json({ error: "Could not remove the profile photo." }, { status: 500 });
    }
    return NextResponse.json({ success: true, url: null });
  }

  if (!(await amazonImageStorageActive())) {
    return NextResponse.json({ error: "Amazon storage is not the active photo store." }, { status: 409 });
  }

  if (body?.action === "save") {
    const raw = String(body.image || "");
    const encoded = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length < 32 || bytes.length > 2_000_000) {
      return NextResponse.json({ error: "This photo is too large. Choose a smaller one." }, { status: 400 });
    }
    const url = await storeAdminAvatar(bytes);
    if (!url) {
      return NextResponse.json({ error: "Choose a JPG, PNG, or WebP photo." }, { status: 400 });
    }
    const saved = await supabase.from("admins").update({ avatar_url: url }).eq("id", session.adminId);
    if (saved.error) {
      return NextResponse.json({ error: "Could not save the profile photo." }, { status: 500 });
    }
    return NextResponse.json({ success: true, url });
  }

  if (body?.action === "presign") {
    const bytes = Number(body.bytes);
    if (!Number.isInteger(bytes) || bytes < 32 || bytes > 2_000_000) {
      return NextResponse.json({ error: "This photo is too large. Choose a smaller one." }, { status: 400 });
    }
    const key = newIncomingKey();
    const signed = await presignIncomingUpload(key, bytes);
    if (!signed) {
      return NextResponse.json({ error: "Photo storage is not available right now." }, { status: 503 });
    }
    return NextResponse.json({ key, uploadUrl: signed.uploadUrl, contentType: signed.contentType });
  }

  if (body?.action === "complete") {
    const finished = await finishIncomingImage(String(body.key || ""));
    if (!finished.ok) return NextResponse.json({ error: finished.error }, { status: 400 });
    const saved = await supabase.from("admins").update({ avatar_url: finished.url }).eq("id", session.adminId);
    if (saved.error) {
      return NextResponse.json({ error: "Could not save the profile photo." }, { status: 500 });
    }
    return NextResponse.json({ success: true, url: finished.url });
  }

  return NextResponse.json({ error: "Choose an action." }, { status: 400 });
}
