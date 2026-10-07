import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeAdminSiteModeCode } from "../../../../lib/adminLoginOtp";
import { isDeveloperRole } from "../../../../lib/adminTabAccess";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  SITE_RUNTIME_ID,
  effectiveSiteMode,
  isSiteMode,
  parseSiteRuntime,
  type SiteMode,
} from "../../../../lib/siteRuntime";

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

async function loadRuntime() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("site_runtime")
    .select("id, mode, message, until, started_at, updated_at")
    .eq("id", SITE_RUNTIME_ID)
    .maybeSingle();
  const runtime = parseSiteRuntime((data as Record<string, unknown> | null) ?? undefined);
  return {
    ...runtime,
    effectiveMode: effectiveSiteMode(runtime),
  };
}

export async function GET() {
  try {
    return NextResponse.json({ success: true, runtime: await loadRuntime() });
  } catch (error) {
    console.error("[site-mode] get failed", error);
    return NextResponse.json(
      { success: false, error: "Could not load website mode." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      adminId?: string;
      mode?: string;
      message?: string;
      until?: string;
      code?: string;
    };

    const adminId = body.adminId?.trim() || "";
    const mode = body.mode;
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session is required." },
        { status: 400 },
      );
    }
    if (!isSiteMode(mode)) {
      return NextResponse.json(
        { success: false, error: "Choose live, text only, or maintenance." },
        { status: 400 },
      );
    }

    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit email code to change website mode." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, email, role, is_disabled")
      .eq("id", adminId)
      .maybeSingle();

    if (error || !admin) {
      return NextResponse.json(
        { success: false, error: "Could not verify this admin account." },
        { status: 401 },
      );
    }
    if (admin.is_disabled) {
      return NextResponse.json(
        { success: false, error: "This admin account is disabled." },
        { status: 403 },
      );
    }
    if (!isDeveloperRole(admin.role)) {
      return NextResponse.json(
        { success: false, error: "Only the Developer can change FinderB website mode." },
        { status: 403 },
      );
    }

    if (!(await consumeAdminSiteModeCode(String(admin.email), code))) {
      return NextResponse.json(
        { success: false, error: "That code is invalid or expired. Request a new one." },
        { status: 401 },
      );
    }

    let message = String(body.message || "").trim();
    let until: string | null = null;
    let startedAt: string | null = null;
    const nowIso = new Date().toISOString();

    if (mode === "maintenance") {
      if (!message) message = DEFAULT_MAINTENANCE_MESSAGE;
      if (message.length > 500) {
        return NextResponse.json(
          { success: false, error: "Keep the public message under 500 characters." },
          { status: 400 },
        );
      }
      const untilRaw = String(body.until || "").trim();
      const untilTime = Date.parse(untilRaw);
      if (!untilRaw || !Number.isFinite(untilTime) || untilTime <= Date.now()) {
        return NextResponse.json(
          { success: false, error: "Choose a future time for when maintenance should end." },
          { status: 400 },
        );
      }
      until = new Date(untilTime).toISOString();
      startedAt = nowIso;
    }

    const payload = {
      id: SITE_RUNTIME_ID,
      mode: mode as SiteMode,
      message: mode === "maintenance" ? message : null,
      until,
      started_at: startedAt,
      updated_at: nowIso,
      updated_by: admin.id,
    };

    const { error: writeError } = await supabase
      .from("site_runtime")
      .upsert(payload, { onConflict: "id" });
    if (writeError) {
      console.error("[site-mode] write failed", writeError.message);
      return NextResponse.json(
        { success: false, error: "Could not save website mode." },
        { status: 500 },
      );
    }

    await supabase.from("system_settings").upsert(
      {
        key: "maintenance",
        value: mode === "maintenance",
        updated_at: nowIso,
      },
      { onConflict: "key" },
    );

    return NextResponse.json({ success: true, runtime: await loadRuntime() });
  } catch (error) {
    console.error("[site-mode] post failed", error);
    return NextResponse.json(
      { success: false, error: "Could not update website mode." },
      { status: 500 },
    );
  }
}
