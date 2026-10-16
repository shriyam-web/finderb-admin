import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessTab } from "../../../../../lib/adminTabAccess";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const adminId = params.get("adminId")?.trim() || "";
  const q = (params.get("q") || "").trim().replace(/[,()]/g, " ").slice(0, 80);
  if (!adminId) {
    return NextResponse.json({ success: false, error: "Admin session required." }, { status: 401 });
  }
  if (q.length < 2) return NextResponse.json({ success: true, users: [], businesses: [] });

  const supabase = getSupabase();
  const { data: admin } = await supabase
    .from("admins")
    .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .single();
  if (!admin || admin.is_disabled || !canAccessTab(admin, "Broadcasts")) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const like = `%${q}%`;
  const [users, businesses] = await Promise.all([
    supabase
      .from("User")
      .select("id, fullName, email, phone")
      .or(`id.eq.${q},fullName.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(8),
    supabase
      .from("Business")
      .select("id, businessName, displayName, email, mobile, city")
      .or(`id.eq.${q},businessName.ilike.${like},displayName.ilike.${like},email.ilike.${like},mobile.ilike.${like}`)
      .limit(8),
  ]);

  return NextResponse.json({
    success: true,
    users: (users.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.fullName || "User"),
      detail: [row.email, row.phone].filter(Boolean).join(" · "),
    })),
    businesses: (businesses.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.displayName || row.businessName || "Business"),
      detail: [row.city, row.email || row.mobile].filter(Boolean).join(" · "),
    })),
  });
}
