import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessTab, canEditTab } from "../../../../lib/adminTabAccess";
import {
  fetchAdminReviews,
  postAdminReviewAction,
} from "../../../../lib/reviewModerationAdmin";

const TAB = "Reviews";

type AdminRow = {
  id: string;
  email?: string | null;
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

async function loadAdmin(adminId: string) {
  const supabase = getSupabase();
  const { data: admin, error } = await supabase
    .from("admins")
    .select("id, email, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .single();
  if (error || !admin || admin.is_disabled) {
    return { admin: null as AdminRow | null };
  }
  return { admin: admin as AdminRow };
}

function sessionFromAdmin(admin: AdminRow) {
  return {
    role: admin.role,
    allowed_tabs: admin.allowed_tabs,
    allowed_tab_modes: admin.allowed_tab_modes as
      | Record<string, "none" | "read" | "edit">
      | null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminId = String(url.searchParams.get("adminId") || "").trim();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }
    const { admin } = await loadAdmin(adminId);
    if (!admin || !canAccessTab(sessionFromAdmin(admin), TAB)) {
      return NextResponse.json(
        { success: false, error: "No permission for Reviews." },
        { status: 403 },
      );
    }
    const params: Record<string, string> = {};
    for (const key of ["kind", "q", "status"]) {
      const value = url.searchParams.get(key);
      if (value) params[key] = value;
    }
    const result = await fetchAdminReviews(params);
    return NextResponse.json(result, {
      status: result?.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[admin reviews GET]", error);
    return NextResponse.json(
      { success: false, error: "Search failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      adminId?: string;
      action?: string;
      businessId?: string;
      reviewId?: string;
      reportId?: string;
      adminNote?: string;
    } | null;

    const adminId = String(body?.adminId || "").trim();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }
    const { admin } = await loadAdmin(adminId);
    if (!admin || !canEditTab(sessionFromAdmin(admin), TAB)) {
      return NextResponse.json(
        { success: false, error: "No permission to moderate reviews." },
        { status: 403 },
      );
    }

    const result = await postAdminReviewAction({
      ...body,
      adminId,
    });
    return NextResponse.json(result, {
      status: result?.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[admin reviews POST]", error);
    return NextResponse.json(
      { success: false, error: "Could not update this review." },
      { status: 500 },
    );
  }
}
