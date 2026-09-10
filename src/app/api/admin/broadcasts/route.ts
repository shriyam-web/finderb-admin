import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicSiteUrl } from "../../../../lib/site";
import { canAccessTab, canEditTab } from "../../../../lib/adminTabAccess";
import {
  DEFAULT_BROADCAST_CTA_LABEL,
  sanitizeBroadcastCtaLabel,
  sanitizeBroadcastCtaUrl,
} from "../../../../lib/broadcastFields";

type AdminRow = {
  id: string;
  role?: string | null;
  is_disabled?: boolean | null;
  allowed_tabs?: string[] | null;
  allowed_tab_modes?: Record<string, string> | null;
};

const BROADCAST_SELECT =
  "id, title, message, target_audience, created_at, cta_url, cta_label, show_datetime";
const BROADCAST_SELECT_FALLBACK =
  "id, title, message, target_audience, created_at";

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

function targetsUsers(audience: unknown): boolean {
  if (!Array.isArray(audience)) return false;
  return audience.some((item) => {
    const value = String(item).trim().toLowerCase();
    return value === "users" || value === "all";
  });
}

function isMissingColumnError(message?: string | null) {
  return Boolean(
    message &&
      /cta_url|cta_label|show_datetime|broadcast_reads|schema cache|does not exist/i.test(
        message,
      ),
  );
}

async function loadAdmin(adminId: string) {
  const supabase = getSupabase();
  const { data: admin, error } = await supabase
    .from("admins")
    .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .single();

  if (error || !admin || admin.is_disabled) {
    return { supabase, admin: null as AdminRow | null, unauthorized: true };
  }

  return { supabase, admin: admin as AdminRow, unauthorized: false };
}

function adminSession(admin: AdminRow) {
  return {
    role: admin.role,
    allowed_tabs: admin.allowed_tabs,
    allowed_tab_modes: admin.allowed_tab_modes as
      | Record<string, "none" | "read" | "edit">
      | null,
  };
}

async function readCountByBroadcast(
  supabase: ReturnType<typeof getSupabase>,
  ids: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = 0;
  if (!ids.length) return counts;

  const { data, error } = await supabase
    .from("broadcast_reads")
    .select("broadcast_id")
    .in("broadcast_id", ids);

  if (error) {
    if (!isMissingColumnError(error.message)) {
      console.error("[admin broadcasts] read counts", error);
    }
    return counts;
  }

  for (const row of data || []) {
    const id = String((row as { broadcast_id?: string }).broadcast_id || "");
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function parseCtaFromBody(body: {
  ctaUrl?: string;
  ctaLabel?: string;
}): { ok: true; url: string | null; label: string | null } | { ok: false; error: string } {
  const rawUrl = typeof body.ctaUrl === "string" ? body.ctaUrl.trim() : "";
  if (!rawUrl) {
    return { ok: true, url: null, label: null };
  }

  const url = sanitizeBroadcastCtaUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error: "Link must be a valid http or https URL.",
    };
  }

  return {
    ok: true,
    url,
    label: sanitizeBroadcastCtaLabel(body.ctaLabel) || DEFAULT_BROADCAST_CTA_LABEL,
  };
}

export async function GET(request: Request) {
  try {
    const adminId = new URL(request.url).searchParams.get("adminId")?.trim();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }

    const { supabase, admin, unauthorized } = await loadAdmin(adminId);
    if (unauthorized || !admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized admin session." },
        { status: 401 },
      );
    }

    if (!canAccessTab(adminSession(admin), "Broadcasts")) {
      return NextResponse.json(
        { success: false, error: "You do not have access to Broadcasts." },
        { status: 403 },
      );
    }

    const full = await supabase
      .from("broadcasts")
      .select(BROADCAST_SELECT)
      .order("created_at", { ascending: false })
      .limit(40);

    const used =
      full.error && isMissingColumnError(full.error.message)
        ? await supabase
            .from("broadcasts")
            .select(BROADCAST_SELECT_FALLBACK)
            .order("created_at", { ascending: false })
            .limit(40)
        : full;

    if (used.error) {
      return NextResponse.json(
        { success: false, error: used.error.message },
        { status: 500 },
      );
    }

    const rows = (used.data || []) as Array<{
      id: string;
      title?: string | null;
      message?: string | null;
      target_audience?: string[] | null;
      created_at?: string | null;
      cta_url?: string | null;
      cta_label?: string | null;
      show_datetime?: boolean | null;
    }>;
    const counts = await readCountByBroadcast(
      supabase,
      rows.map((row) => row.id),
    );

    return NextResponse.json({
      success: true,
      broadcasts: rows.map((row) => ({
        ...row,
        read_count: counts[row.id] || 0,
      })),
    });
  } catch (error) {
    console.error("[admin broadcasts get]", error);
    return NextResponse.json(
      { success: false, error: "Could not load broadcasts." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      message?: string;
      audiences?: string[];
      adminId?: string;
      ctaUrl?: string;
      ctaLabel?: string;
      showDatetime?: boolean;
    };

    if (!body.adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }

    const { supabase, admin, unauthorized } = await loadAdmin(body.adminId);
    if (unauthorized || !admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized admin session." },
        { status: 401 },
      );
    }

    if (!canEditTab(adminSession(admin), "Broadcasts")) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have edit permission for Broadcasts.",
        },
        { status: 403 },
      );
    }

    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const audiences = Array.isArray(body.audiences)
      ? body.audiences.filter((item) => item === "Users" || item === "Merchants")
      : [];

    if (!title || !message || audiences.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Add a title, message, and at least one audience.",
        },
        { status: 400 },
      );
    }

    const cta = parseCtaFromBody(body);
    if (!cta.ok) {
      return NextResponse.json(
        { success: false, error: cta.error },
        { status: 400 },
      );
    }

    const showDatetime = body.showDatetime !== false;
    const payload = {
      title,
      message,
      target_audience: audiences,
      cta_url: cta.url,
      cta_label: cta.label,
      show_datetime: showDatetime,
    };

    const inserted = await supabase
      .from("broadcasts")
      .insert(payload)
      .select(BROADCAST_SELECT)
      .single();

    const insert =
      inserted.error && isMissingColumnError(inserted.error.message)
        ? await supabase
            .from("broadcasts")
            .insert({ title, message, target_audience: audiences })
            .select(BROADCAST_SELECT_FALLBACK)
            .single()
        : inserted;

    if (insert.error || !insert.data) {
      return NextResponse.json(
        {
          success: false,
          error: insert.error?.message || "Failed to save broadcast.",
        },
        { status: 500 },
      );
    }

    const data = insert.data as {
      id: string;
      title?: string | null;
      message?: string | null;
      target_audience?: string[] | null;
      created_at?: string | null;
    };

    let pushSent = 0;
    let pushNote: string | null = null;

    if (targetsUsers(audiences)) {
      try {
        const dispatchHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        const secret = process.env.FINDERB_DISPATCH_SECRET?.trim();
        if (secret) {
          dispatchHeaders["x-finderb-dispatch"] = secret;
        }

        const dispatchRes = await fetch(
          `${getPublicSiteUrl()}/api/notifications/dispatch`,
          {
            method: "POST",
            headers: dispatchHeaders,
            body: JSON.stringify({ broadcastId: data.id }),
          },
        );
        const dispatchJson = (await dispatchRes.json().catch(() => null)) as {
          success?: boolean;
          sent?: number;
          skipped?: string;
          error?: string;
        } | null;

        if (dispatchJson?.success) {
          pushSent = Number(dispatchJson.sent || 0);
          if (dispatchJson.skipped === "no-token-table") {
            pushNote =
              "Saved. Run supabase/user_notifications.sql so app push tokens can be stored.";
          } else if (pushSent === 0) {
            pushNote =
              "Saved and visible in the FinderB app. Push alerts go out after users open the app once while signed in.";
          }
        } else {
          pushNote =
            dispatchJson?.error ||
            "Saved. The app inbox will show it; push dispatch did not complete.";
        }
      } catch (dispatchError) {
        console.error("[admin broadcasts] dispatch", dispatchError);
        pushNote =
          "Saved. The app inbox will show it; live site push dispatch could not be reached.";
      }
    }

    return NextResponse.json({
      success: true,
      broadcast: { ...data, read_count: 0 },
      pushSent,
      message:
        pushNote ||
        (targetsUsers(audiences)
          ? `Broadcast sent. ${pushSent} app device${pushSent === 1 ? "" : "s"} notified.`
          : "Broadcast sent to merchants."),
    });
  } catch (error) {
    console.error("[admin broadcasts]", error);
    return NextResponse.json(
      { success: false, error: "Could not dispatch broadcast." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      adminId?: string;
    } | null;

    const adminId = String(body?.adminId || "").trim();
    const id = String(body?.id || "").trim();

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Broadcast id required." },
        { status: 400 },
      );
    }

    const { supabase, admin, unauthorized } = await loadAdmin(adminId);
    if (unauthorized || !admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized admin session." },
        { status: 401 },
      );
    }

    if (!canEditTab(adminSession(admin), "Broadcasts")) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have edit permission for Broadcasts.",
        },
        { status: 403 },
      );
    }

    const { error } = await supabase.from("broadcasts").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || "Failed to delete." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin broadcasts delete]", error);
    return NextResponse.json(
      { success: false, error: "Could not delete broadcast." },
      { status: 500 },
    );
  }
}
