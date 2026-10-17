import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessTab, canEditTab } from "../../../../lib/adminTabAccess";
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

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

async function loadAdmin(adminId: string) {
  const supabase = getSupabase();
  const { data: admin } = await supabase
    .from("admins")
    .select("id, email, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .single();
  return { supabase, admin };
}

async function rememberEmail(
  supabase: ReturnType<typeof getSupabase>,
  admin: { id: string; email?: string | null; role?: string | null },
  sent: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string },
) {
  const inserted = await supabase.from("admin_outbound_emails").insert({
    admin_id: admin.id,
    subject: sent.subject,
    body: sent.body,
    to_emails: sent.to,
    cc_emails: sent.cc,
    bcc_emails: sent.bcc,
  });
  if (!inserted.error) return true;

  const audit = await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_email: admin.email || "admin@finderb.com",
    admin_role: admin.role || "admin",
    action: "create",
    resource_type: "broadcast_email",
    summary: sent.subject.slice(0, 240),
    metadata: sent,
  });
  return !audit.error;
}

export async function GET(request: Request) {
  const adminId = String(new URL(request.url).searchParams.get("adminId") || "").trim();
  if (!adminId) {
    return NextResponse.json({ success: false, error: "Admin session required." }, { status: 401 });
  }

  const { supabase, admin } = await loadAdmin(adminId);
  if (!admin || admin.is_disabled || !canAccessTab(admin, "Broadcast Email")) {
    return NextResponse.json({ success: false, error: "You cannot view email history." }, { status: 403 });
  }

  const emailsOut: {
    id: string;
    subject: string;
    to: string[];
    cc: string[];
    bcc: string[];
    createdAt: string;
  }[] = [];

  const stored = await supabase
    .from("admin_outbound_emails")
    .select("id, subject, to_emails, cc_emails, bcc_emails, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  if (!stored.error) {
    for (const row of stored.data || []) {
      emailsOut.push({
        id: String(row.id),
        subject: String(row.subject || ""),
        to: asList(row.to_emails),
        cc: asList(row.cc_emails),
        bcc: asList(row.bcc_emails),
        createdAt: String(row.created_at || ""),
      });
    }
  }

  const audit = await supabase
    .from("admin_audit_logs")
    .select("id, summary, metadata, created_at")
    .eq("resource_type", "broadcast_email")
    .order("created_at", { ascending: false })
    .limit(80);
  if (!audit.error) {
    for (const row of audit.data || []) {
      const meta = (row.metadata || {}) as { to?: unknown; cc?: unknown; bcc?: unknown; subject?: string };
      const createdAt = String(row.created_at || "");
      const subject = String(meta.subject || row.summary || "");
      const to = asList(meta.to);
      const already = emailsOut.some(
        (item) => item.subject === subject && item.createdAt === createdAt && item.to.join(",") === to.join(","),
      );
      if (already) continue;
      emailsOut.push({
        id: `audit-${row.id}`,
        subject,
        to,
        cc: asList(meta.cc),
        bcc: asList(meta.bcc),
        createdAt,
      });
    }
  }

  emailsOut.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ success: true, emails: emailsOut.slice(0, 80) });
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

  const { supabase, admin } = await loadAdmin(adminId);
  if (!admin || admin.is_disabled || !canEditTab(admin, "Broadcast Email")) {
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
  const persisted = await rememberEmail(supabase, admin, {
    to,
    cc,
    bcc,
    subject,
    body: message,
  });
  return NextResponse.json({ success: true, persisted });
}
