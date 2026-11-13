import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessTab, canEditTab } from "../../../../lib/adminTabAccess";
import { privateDownloadUrl } from "../../../../lib/privateMedia";
import { notifyAdApprovedOnSite } from "../../../../lib/notifyAdApproved";

const TAB = "Ads Request";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadAdmin(adminId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("admins")
    .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .maybeSingle();
  if (error || !data || data.is_disabled) return null;
  return data;
}

function denied() {
  return NextResponse.json({ error: "You do not have access to Ads Request." }, { status: 403 });
}

function hasVideo(row: Record<string, unknown>) {
  return Boolean(row.video_public_id || (typeof row.video_url === "string" && row.video_url.startsWith("https://")));
}

function reviewOf(row: Record<string, unknown>): "none" | "pending" | "approved" | "denied" {
  const stored = String(row.ad_review_status || "");
  if (stored === "pending" || stored === "approved" || stored === "denied") return stored;
  const unpaid = String(row.payment_status || "pending") !== "paid";
  const closed = ["rejected", "cancelled", "refund_pending", "refunded", "completed"].includes(String(row.campaign_status || ""));
  if (hasVideo(row) && unpaid && !closed) return "pending";
  return "none";
}

async function businessesFor(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const supabase = getSupabase();
  const { data } = await supabase
    .from("Business")
    .select("id, businessName, category, fullName, mobile, email, city, businessAddress")
    .in("id", unique);
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of data || []) map[String(row.id)] = row as Record<string, unknown>;
  return map;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = await loadAdmin(String(searchParams.get("adminId") || ""));
  if (!admin || !canAccessTab(admin, TAB)) return denied();
  const status = String(searchParams.get("status") || "pending");
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("promotion_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ((data || []) as Record<string, unknown>[]).filter((row) => {
    const review = reviewOf(row);
    if (review === "none") return false;
    if (status === "all") return true;
    return review === status;
  });
  const businesses = await businessesFor(rows.map((row) => String(row.business_id || "")));
  return NextResponse.json({
    success: true,
    rows: rows.map((row) => {
      const snap = (row.package_snapshot && typeof row.package_snapshot === "object"
        ? row.package_snapshot
        : {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        business: businesses[String(row.business_id)] || null,
        packageName: String(snap.name || row.package_id || ""),
        amountInr: Number(row.amount_inr) || 0,
        area: String(row.target_area || ""),
        pincode: String(row.target_pincode || ""),
        audience: String(snap.audience || ""),
        content: String(snap.content || ""),
        review: reviewOf(row),
        reason: String(row.ad_review_reason || ""),
        paymentStatus: String(row.payment_status || "pending"),
        createdAt: row.created_at || null,
        videoUrl: (typeof row.video_url === "string" && row.video_url.startsWith("https://") ? row.video_url : null)
          || (row.video_public_id
            ? privateDownloadUrl({
                publicId: String(row.video_public_id),
                resource: "video",
                format: String(row.video_format || ""),
              }, true)
            : null),
      };
    }),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const admin = await loadAdmin(String(body.adminId || ""));
  if (!admin || !canEditTab(admin, TAB)) return denied();
  const supabase = getSupabase();
  const id = String(body.id || "");
  const action = String(body.action || "");
  const { data: order, error: readError } = await supabase
    .from("promotion_orders")
    .select("id, payment_status, business_id, ad_review_status")
    .eq("id", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "That ad was not found." }, { status: 404 });
  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "This ad is already paid." }, { status: 400 });
  }
  const now = new Date().toISOString();

  if (action === "approve") {
    const { error } = await supabase.from("promotion_orders").update({
      ad_review_status: "approved",
      ad_review_reason: null,
      ad_reviewed_at: now,
      updated_at: now,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      order_id: id,
      business_id: order.business_id,
      actor_admin_id: admin.id,
      action: "ad_review_approved",
      from_status: order.ad_review_status,
      to_status: "approved",
    });
    if (String(order.ad_review_status || "") !== "approved") {
      await notifyAdApprovedOnSite(id);
    }
    return NextResponse.json({ success: true });
  }

  if (action === "deny") {
    const reason = String(body.reason || "").trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: "Write the reason, then deny it." }, { status: 400 });
    }
    const { error } = await supabase.from("promotion_orders").update({
      ad_review_status: "denied",
      ad_review_reason: reason.slice(0, 500),
      ad_reviewed_at: now,
      updated_at: now,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      order_id: id,
      business_id: order.business_id,
      actor_admin_id: admin.id,
      action: "ad_review_denied",
      from_status: order.ad_review_status,
      to_status: "denied",
      note: reason.slice(0, 500),
    });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { error } = await supabase.from("promotion_orders").delete().eq("id", id).neq("payment_status", "paid");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      order_id: id,
      business_id: order.business_id,
      actor_admin_id: admin.id,
      action: "ad_request_deleted",
      note: "Unpaid ad request deleted.",
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
