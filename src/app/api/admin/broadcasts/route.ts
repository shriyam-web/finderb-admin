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
  "id, title, message, target_audience, created_at, cta_url, cta_label, show_datetime, status, scheduled_at, target_user_id, target_business_id, target_label, recipient_count";
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
      /cta_url|cta_label|show_datetime|broadcast_reads|status|scheduled_at|target_user_id|target_business_id|target_label|recipient_count|schema cache|does not exist/i.test(
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

async function dispatchBroadcast(id: string): Promise<{ sent: number; note: string | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const secret = process.env.FINDERB_DISPATCH_SECRET?.trim();
  if (secret) headers["x-finderb-dispatch"] = secret;
  const res = await fetch(`${getPublicSiteUrl()}/api/notifications/dispatch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ broadcastId: id }),
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    sent?: number;
    skipped?: string;
    error?: string;
  } | null;
  if (!json?.success) {
    return {
      sent: 0,
      note: json?.error || "Saved. The inbox will show it; push dispatch did not complete.",
    };
  }
  const sent = Number(json.sent || 0);
  if (json.skipped === "scheduled") return { sent: 0, note: "It is still waiting for its scheduled time." };
  if (json.skipped === "no-token-table") {
    return { sent: 0, note: "Saved. Run supabase/user_notifications.sql so app push tokens can be stored." };
  }
  return { sent, note: null };
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
      status?: string | null;
      scheduled_at?: string | null;
      target_user_id?: string | null;
      target_business_id?: string | null;
      target_label?: string | null;
      recipient_count?: number | null;
    }>;
    const now = Date.now();
    for (const row of rows) {
      if (String(row.status || "").toLowerCase() !== "scheduled") continue;
      const at = Date.parse(String(row.scheduled_at || ""));
      if (!Number.isFinite(at) || at > now) continue;
      await dispatchBroadcast(row.id);
      row.status = "sent";
    }

    const counts = await readCountByBroadcast(
      supabase,
      rows.map((row) => row.id),
    );

    const needsEstimate = rows.some(
      (row) =>
        row.recipient_count == null &&
        !row.target_user_id &&
        !row.target_business_id,
    );
    let userCount = 0;
    let businessCount = 0;
    if (needsEstimate) {
      const [users, businesses] = await Promise.all([
        supabase.from("User").select("id", { count: "exact", head: true }),
        supabase.from("Business").select("id", { count: "exact", head: true }),
      ]);
      userCount = users.count || 0;
      businessCount = businesses.count || 0;
    }

    return NextResponse.json({
      success: true,
      broadcasts: rows.map((row) => ({
        ...row,
        read_count: counts[row.id] || 0,
        recipient_count:
          row.recipient_count ??
          (row.target_user_id || row.target_business_id
            ? 1
            : (targetsUsers(row.target_audience) ? userCount : 0) +
              (Array.isArray(row.target_audience) &&
              row.target_audience.some((item) => String(item).toLowerCase() === "merchants")
                ? businessCount
                : 0)),
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
      action?: string;
      id?: string;
      title?: string;
      message?: string;
      audiences?: string[];
      adminId?: string;
      ctaUrl?: string;
      ctaLabel?: string;
      showDatetime?: boolean;
      targetUserId?: string;
      targetBusinessId?: string;
      targetLabel?: string;
      scheduledAt?: string;
      saveAs?: "send" | "queue" | "schedule";
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

    if (body.action === "send-now" || body.action === "cancel") {
      const id = String(body.id || "").trim();
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Choose a notification." },
          { status: 400 },
        );
      }
      if (body.action === "cancel") {
        const { error } = await supabase.from("broadcasts").delete().eq("id", id);
        if (error) {
          return NextResponse.json(
            { success: false, error: error.message || "Could not remove it." },
            { status: 500 },
          );
        }
        return NextResponse.json({ success: true });
      }
      await supabase
        .from("broadcasts")
        .update({ status: "sent", scheduled_at: null })
        .eq("id", id);
      await supabase.from("broadcasts").update({ push_sent_at: null }).eq("id", id);
      const sent = await dispatchBroadcast(id);
      return NextResponse.json({
        success: true,
        message: sent.note || "Notification sent.",
      });
    }

    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const targetUserId = String(body.targetUserId || "").trim();
    const targetBusinessId = String(body.targetBusinessId || "").trim();
    const audiences = targetUserId || targetBusinessId
      ? []
      : Array.isArray(body.audiences)
        ? body.audiences.filter((item) => item === "Users" || item === "Merchants")
        : [];

    if (!title || !message || (!audiences.length && !targetUserId && !targetBusinessId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Add a title, a message, and who should receive it.",
        },
        { status: 400 },
      );
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    const scheduledOk = Boolean(scheduledAt && !Number.isNaN(scheduledAt.getTime()));
    const saveAs = body.saveAs || "send";
    if (saveAs === "schedule" && (!scheduledOk || scheduledAt!.getTime() <= Date.now())) {
      return NextResponse.json(
        { success: false, error: "Pick a future date and time to schedule this." },
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
    const hold = saveAs === "queue" || saveAs === "schedule";
    const status = saveAs === "queue" ? "queued" : saveAs === "schedule" ? "scheduled" : "sent";
    let recipientCount = targetUserId || targetBusinessId ? 1 : 0;
    if (!recipientCount) {
      if (audiences.includes("Users")) {
        const users = await supabase.from("User").select("id", { count: "exact", head: true });
        recipientCount += users.count || 0;
      }
      if (audiences.includes("Merchants")) {
        const businesses = await supabase
          .from("Business")
          .select("id", { count: "exact", head: true });
        recipientCount += businesses.count || 0;
      }
    }
    const payload = {
      title,
      message,
      target_audience: targetUserId
        ? ["direct-user"]
        : targetBusinessId
          ? ["direct-business"]
          : audiences,
      cta_url: cta.url,
      cta_label: cta.label,
      show_datetime: showDatetime,
      status,
      scheduled_at: saveAs === "schedule" && scheduledAt ? scheduledAt.toISOString() : null,
      target_user_id: targetUserId || null,
      target_business_id: targetBusinessId || null,
      target_label: String(body.targetLabel || "").trim() || null,
      recipient_count: recipientCount,
    };

    const inserted = await supabase
      .from("broadcasts")
      .insert(payload)
      .select(BROADCAST_SELECT)
      .single();

    const missingColumns = Boolean(
      inserted.error && isMissingColumnError(inserted.error.message),
    );
    if (missingColumns && (hold || targetUserId || targetBusinessId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Run supabase/broadcast_schedule.sql once in Supabase, then try again.",
        },
        { status: 400 },
      );
    }

    const insert = missingColumns
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

    if (hold) {
      return NextResponse.json({
        success: true,
        broadcast: { ...data, read_count: 0, recipient_count: recipientCount },
        message:
          saveAs === "schedule"
            ? "Scheduled. It will send at the time you picked."
            : "Added to the queue.",
      });
    }

    let pushSent = 0;
    let pushNote: string | null = null;

    try {
      const sent = await dispatchBroadcast(data.id);
      pushSent = sent.sent;
      pushNote = sent.note;
      if (!pushNote && pushSent === 0) {
        pushNote = targetsUsers(audiences)
          ? "Saved and visible in the FinderB app. Push alerts go out after users open the app once while signed in."
          : "Saved and visible in the merchant panel. Push alerts go out once merchants open the latest app while signed in.";
      }
    } catch (dispatchError) {
      console.error("[admin broadcasts] dispatch", dispatchError);
      pushNote =
        "Saved. The app inbox will show it; live site push dispatch could not be reached.";
    }

    return NextResponse.json({
      success: true,
      broadcast: { ...data, read_count: 0 },
      pushSent,
      message:
        pushNote ||
        `Broadcast sent. ${pushSent} app device${pushSent === 1 ? "" : "s"} notified.`,
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
