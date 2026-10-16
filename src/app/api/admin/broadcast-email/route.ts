import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canEditTab } from "../../../../lib/adminTabAccess";
import { getPublicSiteUrl } from "../../../../lib/site";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function emails(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/);
  return raw.map((item) => String(item || "").trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    adminId?: string;
    to?: unknown;
    cc?: unknown;
    bcc?: unknown;
    subject?: string;
    body?: string;
  } | null;

  const adminId = String(body?.adminId || "").trim();
  if (!adminId) {
    return NextResponse.json({ success: false, error: "Admin session required." }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data: admin } = await supabase
    .from("admins")
    .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .single();
  if (!admin || admin.is_disabled || !canEditTab(admin, "Broadcasts")) {
    return NextResponse.json({ success: false, error: "You cannot send email." }, { status: 403 });
  }

  const to = emails(body?.to);
  const cc = emails(body?.cc);
  const bcc = emails(body?.bcc);
  const subject = String(body?.subject || "").trim();
  const message = String(body?.body || "").trim();
  const bad = [...to, ...cc, ...bcc].find((item) => !EMAIL.test(item));
  if (!to.length || !subject || !message) {
    return NextResponse.json(
      { success: false, error: "Add a recipient, a subject, and a message." },
      { status: 400 },
    );
  }
  if (bad) {
    return NextResponse.json({ success: false, error: `${bad} is not a valid email.` }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const secret = process.env.FINDERB_DISPATCH_SECRET?.trim();
  if (secret) headers["x-finderb-dispatch"] = secret;

  const res = await fetch(`${getPublicSiteUrl()}/api/admin/outbound-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, cc, bcc, subject, body: message }),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!res.ok || !json?.success) {
    return NextResponse.json(
      { success: false, error: json?.error || "The email was not delivered." },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true });
}
