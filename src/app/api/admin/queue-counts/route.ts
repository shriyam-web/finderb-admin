import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canAccessTab } from "../../../../lib/adminTabAccess";

type AdminRow = {
  id: string;
  role?: string | null;
  is_disabled?: boolean | null;
  allowed_tabs?: string[] | null;
  allowed_tab_modes?: Record<string, string> | null;
};

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

export type QueueTodoItem = {
  id: string;
  tab: string;
  title: string;
  detail: string;
  targetId: string | null;
  waitingSince: string | null;
  kind: string;
};

const CHANGE_FIELD_LABEL: Record<string, string> = {
  category: "Category change",
  legal_business_name: "Legal name change",
  display_name: "Display name change",
};

function clip(value: unknown, max = 90): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function todoRows(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filters: Record<string, string | boolean>,
  excludeDeleted = false,
): Promise<Record<string, unknown>[]> {
  let query = supabase.from(table).select(columns).order("created_at", { ascending: true }).limit(20);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  if (excludeDeleted) query = query.not("deleted", "eq", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as Record<string, unknown>[];
}

const ENGAGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function audienceValues(audience: unknown): string[] {
  if (!Array.isArray(audience)) return [];
  return audience.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
}

function isEveryoneSend(row: Record<string, unknown>): boolean {
  const status = String(row.status || "sent").trim().toLowerCase();
  if (status === "queued" || status === "scheduled" || status === "cancelled") return false;
  if (row.target_user_id || row.target_business_id) return false;
  const audience = audienceValues(row.target_audience);
  if (audience.includes("direct-user") || audience.includes("direct-business")) return false;
  return true;
}

async function engagementTodos(supabase: SupabaseClient): Promise<QueueTodoItem[]> {
  const full = await supabase
    .from("broadcasts")
    .select("id, target_audience, target_user_id, target_business_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const fallback =
    full.error
      ? await supabase
          .from("broadcasts")
          .select("id, target_audience, created_at")
          .order("created_at", { ascending: false })
          .limit(200)
      : null;
  const rows = (full.error ? fallback?.data : full.data) || [];
  const now = Date.now();
  const latest = (matches: (audience: string[]) => boolean) => {
    for (const row of rows as Record<string, unknown>[]) {
      if (!isEveryoneSend(row)) continue;
      if (!matches(audienceValues(row.target_audience))) continue;
      const created = String(row.created_at || "");
      const at = new Date(created).getTime();
      if (Number.isNaN(at)) continue;
      return { created, age: now - at };
    }
    return null;
  };
  const users = latest((audience) => audience.some((value) => value === "users" || value === "all"));
  const businesses = latest((audience) =>
    audience.some((value) => value === "merchants" || value === "businesses" || value === "all"),
  );
  const items: QueueTodoItem[] = [];
  const overdue = (hit: { created: string; age: number } | null) => !hit || hit.age >= ENGAGE_AFTER_MS;
  if (overdue(users)) {
    items.push({
      id: "engage-users",
      tab: "Broadcasts",
      title: "Send a notification to users",
      detail: users
        ? "It's been 7 days since you have not sent any notification to the users. Send a notification to users now to keep them engaged with the app."
        : "No notification has gone to all users yet. Send a notification to users now to keep them engaged with the app.",
      targetId: null,
      waitingSince: users?.created || new Date(now - ENGAGE_AFTER_MS - 60_000).toISOString(),
      kind: "engagement",
    });
  }
  if (overdue(businesses)) {
    items.push({
      id: "engage-businesses",
      tab: "Broadcasts",
      title: "Send a notification to businesses",
      detail: businesses
        ? "It's been 7 days since you have not sent any notification to the businesses. Send a notification to businesses now to keep them engaged with the app."
        : "No notification has gone to all businesses yet. Send a notification to businesses now to keep them engaged with the app.",
      targetId: null,
      waitingSince: businesses?.created || new Date(now - ENGAGE_AFTER_MS - 60_000).toISOString(),
      kind: "engagement",
    });
  }
  return items;
}

function adRequestPending(row: Record<string, unknown>): boolean {
  if (String(row.payment_status || "pending") === "paid") return false;
  const closed = ["rejected", "cancelled", "refund_pending", "refunded", "completed"];
  if (closed.includes(String(row.campaign_status || ""))) return false;
  const stored = String(row.ad_review_status || "");
  if (stored === "approved" || stored === "denied") return false;
  if (stored === "pending") return true;
  return Boolean(
    row.video_public_id ||
      (typeof row.video_url === "string" && row.video_url.startsWith("https://")),
  );
}

async function exactCount(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string | boolean>,
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

export async function GET(request: Request) {
  try {
    const adminId = String(new URL(request.url).searchParams.get("adminId") || "").trim();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
      .eq("id", adminId)
      .single();
    if (error || !admin || admin.is_disabled) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }

    const session = {
      role: (admin as AdminRow).role,
      allowed_tabs: (admin as AdminRow).allowed_tabs,
      allowed_tab_modes: (admin as AdminRow).allowed_tab_modes as
        | Record<string, "none" | "read" | "edit">
        | null,
    };

    const allowed = (tab: string) => canAccessTab(session, tab);
    const [
      openFlags,
      changeRequests,
      ownershipRequests,
      jobReports,
      flagRows,
      changeRows,
      ownershipRows,
      reportRows,
    ] = await Promise.all([
      allowed("Reviews")
        ? exactCount(supabase, "review_reports", { status: "open" })
        : 0,
      allowed("Change Requests")
        ? exactCount(supabase, "business_change_requests", { status: "pending" })
        : 0,
      allowed("Ownership Requests")
        ? exactCount(supabase, "business_ownership_requests", { status: "pending" })
        : 0,
      allowed("Job Reports")
        ? exactCount(supabase, "job_reports", { status: "pending" })
        : 0,
      allowed("Reviews")
        ? todoRows(supabase, "review_reports", "id, reason, reporter_type, created_at", {
            status: "open",
          })
        : [],
      allowed("Change Requests")
        ? todoRows(
            supabase,
            "business_change_requests",
            "id, field, requested_value, created_at",
            { status: "pending" },
          )
        : [],
      allowed("Ownership Requests")
        ? todoRows(
            supabase,
            "business_ownership_requests",
            "id, requester_name, requester_email, created_at",
            { status: "pending" },
          )
        : [],
      allowed("Job Reports")
        ? todoRows(supabase, "job_reports", "id, job_title, reason, created_at", {
            status: "pending",
          })
        : [],
    ]);

    const when = (row: Record<string, unknown>) => {
      const value = row.created_at;
      return typeof value === "string" && value ? value : null;
    };
    const items: QueueTodoItem[] = [
      ...flagRows.map((row) => ({
        id: `flag-${row.id}`,
        tab: "Reviews",
        title: "Review report",
        detail: clip(row.reason) || `${clip(row.reporter_type) || "User"} reported a review`,
        targetId: String(row.id || ""),
        waitingSince: when(row),
        kind: String(row.reporter_type || "").toLowerCase() === "business" ? "business-flag" : "user-flag",
      })),
      ...changeRows.map((row) => ({
        id: `change-${row.id}`,
        tab: "Change Requests",
        title: CHANGE_FIELD_LABEL[String(row.field)] || "Change request",
        detail: clip(row.requested_value) || "Waiting for approval",
        targetId: String(row.id || ""),
        waitingSince: when(row),
        kind: "change",
      })),
      ...ownershipRows.map((row) => ({
        id: `own-${row.id}`,
        tab: "Ownership Requests",
        title: clip(row.requester_name) || "Ownership request",
        detail: clip(row.requester_email) || "Someone asked to own a listing",
        targetId: String(row.id || ""),
        waitingSince: when(row),
        kind: "ownership",
      })),
      ...      reportRows.map((row) => ({
        id: `job-report-${row.id}`,
        tab: "Job Reports",
        title: clip(row.job_title) || "Reported job",
        detail: clip(row.reason) || "Waiting for a decision",
        targetId: String(row.id || ""),
        waitingSince: when(row),
        kind: "job-report",
      })),
    ];

    let adsRequests = 0;
    if (allowed("Ads Request")) {
      const adRows = await supabase
        .from("promotion_orders")
        .select("id, package_snapshot, ad_review_status, video_public_id, video_url, payment_status, campaign_status, created_at, target_area")
        .neq("payment_status", "paid")
        .order("created_at", { ascending: true })
        .limit(200);
      const waiting = ((adRows.data || []) as unknown as Record<string, unknown>[]).filter(adRequestPending);
      adsRequests = waiting.length;
      for (const row of waiting.slice(0, 20)) {
        const snap = (row.package_snapshot && typeof row.package_snapshot === "object"
          ? row.package_snapshot
          : {}) as Record<string, unknown>;
        items.push({
          id: `ad-${row.id}`,
          tab: "Ads Request",
          title: String(snap.name || "Ad request"),
          detail: clip(row.target_area) || "Waiting for an ad decision",
          targetId: String(row.id || ""),
          waitingSince: when(row),
          kind: "ad-request",
        });
      }
    }

    if (allowed("Broadcasts")) {
      items.push(...(await engagementTodos(supabase)));
    }

    return NextResponse.json({
      success: true,
      counts: {
        reviews: openFlags,
        changeRequests,
        ownershipRequests,
        jobReports,
        adsRequests,
      },
      items,
    });
  } catch (error) {
    console.error("[admin queue-counts]", error);
    return NextResponse.json(
      { success: false, error: "Could not load pending counts." },
      { status: 500 },
    );
  }
}
