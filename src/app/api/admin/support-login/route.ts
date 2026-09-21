import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canEditTab } from "../../../../lib/adminTabAccess";
import { verifyPassword } from "../../../../lib/merchantPassword";
import {
  mintMerchantSupportLogin,
  searchMerchantsForSupportLogin,
} from "../../../../lib/merchantSupportLogin";

const TAB = "Merchant Support Login";

type AdminRow = {
  id: string;
  email?: string | null;
  password?: string | null;
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

async function loadAdmin(adminId: string) {
  const supabase = getSupabase();
  const { data: admin, error } = await supabase
    .from("admins")
    .select("id, email, password, role, is_disabled, allowed_tabs, allowed_tab_modes")
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
    const q = String(url.searchParams.get("q") || "").trim();

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }

    const { admin } = await loadAdmin(adminId);
    if (!admin || !canEditTab(sessionFromAdmin(admin), TAB)) {
      return NextResponse.json(
        { success: false, error: "No permission for Merchant Support Login." },
        { status: 403 },
      );
    }

    const result = await searchMerchantsForSupportLogin(q);
    return NextResponse.json(result, {
      status: result?.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[admin support-login search]", error);
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
      password?: string;
      businessId?: string;
      reason?: string;
    } | null;

    const adminId = String(body?.adminId || "").trim();
    const password = String(body?.password || "");
    const businessId = String(body?.businessId || "").trim();
    const reason = String(body?.reason || "").trim();

    if (!adminId || !password || !businessId) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin id, password, and businessId are required.",
        },
        { status: 400 },
      );
    }

    const { admin } = await loadAdmin(adminId);
    if (!admin || !canEditTab(sessionFromAdmin(admin), TAB)) {
      return NextResponse.json(
        { success: false, error: "No permission for Merchant Support Login." },
        { status: 403 },
      );
    }

    const verification = await verifyPassword(
      password,
      String(admin.password || ""),
    );
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: "Incorrect admin password." },
        { status: 401 },
      );
    }

    const result = await mintMerchantSupportLogin({
      businessId,
      adminId,
      adminEmail: admin.email ? String(admin.email) : undefined,
      reason: reason || undefined,
    });

    return NextResponse.json(result, {
      status: result?.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[admin support-login mint]", error);
    return NextResponse.json(
      { success: false, error: "Could not open merchant support session." },
      { status: 500 },
    );
  }
}
