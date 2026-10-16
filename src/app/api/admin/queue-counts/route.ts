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
      ...reportRows.map((row) => ({
        id: `job-report-${row.id}`,
        tab: "Job Reports",
        title: clip(row.job_title) || "Reported job",
        detail: clip(row.reason) || "Waiting for a decision",
        targetId: String(row.id || ""),
        waitingSince: when(row),
        kind: "job-report",
      })),
    ];

    return NextResponse.json({
      success: true,
      counts: {
        reviews: openFlags,
        changeRequests,
        ownershipRequests,
        jobReports,
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
