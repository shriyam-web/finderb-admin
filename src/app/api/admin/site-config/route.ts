import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessTab, canEditTab } from "../../../../lib/adminTabAccess";
import {
  DEFAULT_SITE_CONFIG_FORM,
  SITE_CONFIG_ID,
  parseSiteConfigForm,
  type SiteConfigForm,
} from "../../../../lib/siteConfigAdmin";

const TAB = "Site Configurations";

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

async function loadAdmin(adminId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("admins")
    .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .maybeSingle();
  if (error || !data || data.is_disabled) return null;
  return data;
}

async function loadStoredConfig(): Promise<{ form: SiteConfigForm; billing: { razorpayMonthlyPlanId: string | null } }> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("site_config")
    .select("config")
    .eq("id", SITE_CONFIG_ID)
    .maybeSingle();
  const raw = (data as { config?: unknown } | null)?.config;
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const billing = stored.billing && typeof stored.billing === "object"
    ? (stored.billing as Record<string, unknown>)
    : {};
  const planId = String(billing.razorpayMonthlyPlanId || "").trim();
  return {
    form: raw ? parseSiteConfigForm(raw) : DEFAULT_SITE_CONFIG_FORM,
    billing: { razorpayMonthlyPlanId: planId || null },
  };
}

export async function GET(request: Request) {
  try {
    const adminId = new URL(request.url).searchParams.get("adminId")?.trim() || "";
    if (!adminId) {
      return NextResponse.json({ success: false, error: "Admin session is required." }, { status: 400 });
    }
    const admin = await loadAdmin(adminId);
    if (!admin || !canAccessTab(admin, TAB)) {
      return NextResponse.json({ success: false, error: "You cannot open Site Configurations." }, { status: 403 });
    }
    const stored = await loadStoredConfig();
    return NextResponse.json({ success: true, config: stored.form });
  } catch (error) {
    console.error("[site-config] get failed", error);
    return NextResponse.json(
      { success: false, error: "Could not load site configuration." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { adminId?: string; config?: unknown };
    const adminId = body.adminId?.trim() || "";
    if (!adminId) {
      return NextResponse.json({ success: false, error: "Admin session is required." }, { status: 400 });
    }
    const admin = await loadAdmin(adminId);
    if (!admin || !canEditTab(admin, TAB)) {
      return NextResponse.json(
        { success: false, error: "You cannot change Site Configurations." },
        { status: 403 },
      );
    }

    const form = parseSiteConfigForm(body.config);
    const stored = await loadStoredConfig();
    const next = { ...form, billing: stored.billing };
    const supabase = getSupabase();
    const { error } = await supabase.from("site_config").upsert(
      {
        id: SITE_CONFIG_ID,
        config: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      return NextResponse.json(
        { success: false, error: "Site configuration could not be saved. The storage table may be missing." },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, config: form });
  } catch (error) {
    console.error("[site-config] save failed", error);
    return NextResponse.json(
      { success: false, error: "Could not save site configuration." },
      { status: 500 },
    );
  }
}
