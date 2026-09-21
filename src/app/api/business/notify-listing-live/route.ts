import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canEditTab } from "../../../../lib/adminTabAccess";
import { notifyListingLiveOnSite } from "../../../../lib/notifyListingLive";

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

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client-safe proxy: after Admin sets Business.status = Active,
 * notify finderb.com to send the congratulations email.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      adminId?: string;
      businessId?: string;
    } | null;

    const adminId = String(body?.adminId || "").trim();
    const businessId = String(body?.businessId || "").trim();

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "businessId is required." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
      .eq("id", adminId)
      .single();

    if (error || !admin || (admin as AdminRow).is_disabled) {
      return NextResponse.json(
        { success: false, error: "Unauthorized admin session." },
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

    const allowed =
      canEditTab(session, "Merchants") ||
      canEditTab(session, "Dashboard") ||
      canEditTab(session, "Business Onboarding") ||
      canEditTab(session, "Quick Onboard");

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "No permission to activate listings." },
        { status: 403 },
      );
    }

    const result = await notifyListingLiveOnSite(businessId);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[notify-listing-live]", error);
    return NextResponse.json(
      { success: false, error: "Could not notify listing-live email." },
      { status: 500 },
    );
  }
}
