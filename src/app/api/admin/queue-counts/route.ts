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

async function pendingAnonymousReviews(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("review_moderation")
    .select("id", { count: "exact", head: true })
    .eq("anonymity_status", "pending")
    .not("deleted", "eq", true);
  if (error) return 0;
  return count || 0;
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
    const [anonymousReviews, openFlags, changeRequests, ownershipRequests, jobReports] =
      await Promise.all([
        allowed("Reviews") ? pendingAnonymousReviews(supabase) : 0,
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
      ]);

    return NextResponse.json({
      success: true,
      counts: {
        reviews: anonymousReviews + openFlags,
        changeRequests,
        ownershipRequests,
        jobReports,
      },
    });
  } catch (error) {
    console.error("[admin queue-counts]", error);
    return NextResponse.json(
      { success: false, error: "Could not load pending counts." },
      { status: 500 },
    );
  }
}
