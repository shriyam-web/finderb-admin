import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessTab, canEditTab } from "../../../../lib/adminTabAccess";
import { PROMO_TAB, canMoveCampaign } from "../../../../lib/promotionOps";
import { privateDownloadUrl, readStoredAssets } from "../../../../lib/privateMedia";

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
  return NextResponse.json({ error: "You do not have access to Business Promotions." }, { status: 403 });
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
  const adminId = String(searchParams.get("adminId") || "");
  const admin = await loadAdmin(adminId);
  if (!admin || !canAccessTab(admin, PROMO_TAB)) return denied();
  const supabase = getSupabase();
  const [ordersRes, verificationsRes, packagesRes, auditRes, customRes] = await Promise.all([
    supabase.from("promotion_orders").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("business_verifications").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("promotion_packages").select("*").order("sort_order"),
    supabase.from("promotion_audit").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("promotion_custom_requests").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const orders = ordersRes.data || [];
  const verifications = verificationsRes.data || [];
  const customRequests = customRes.data || [];
  const businesses = await businessesFor([
    ...orders.map((row) => String(row.business_id || "")),
    ...verifications.map((row) => String(row.business_id || "")),
    ...customRequests.map((row) => String(row.business_id || "")),
  ]);
  const paid = orders.filter((row) => row.payment_status === "paid");
  return NextResponse.json({
    stats: {
      orders: orders.length,
      revenue: paid.reduce((sum, row) => sum + Number(row.amount_inr || 0), 0),
      pendingPayments: orders.filter((row) => row.payment_status === "pending").length,
      paid: paid.length,
      review: orders.filter((row) => row.campaign_status === "under_review" || row.campaign_status === "editing").length,
      active: orders.filter((row) => row.campaign_status === "ad_active").length,
      completed: orders.filter((row) => row.campaign_status === "completed").length,
      rejected: orders.filter((row) => row.campaign_status === "rejected").length,
      videos: orders.filter((row) => row.video_public_id || row.video_url).length,
      custom: customRequests.filter((row) => row.status === "received" || row.status === "in_review").length,
    },
    orders: orders.map((row) => ({
      ...row,
      video_url: (row.video_public_id
        ? privateDownloadUrl({
            publicId: String(row.video_public_id),
            resource: "video",
            format: String(row.video_format || ""),
          }, true)
        : null) || (typeof row.video_url === "string" && row.video_url.startsWith("https://") ? row.video_url : null),
      business: businesses[String(row.business_id)] || null,
    })),
    verifications: verifications.map((row) => ({
      ...row,
      shop_photo_url: (row.shop_photo_public_id
        ? privateDownloadUrl({
            publicId: String(row.shop_photo_public_id),
            resource: "image",
            format: String(row.shop_photo_format || ""),
          }, true)
        : null) || (typeof row.shop_photo_url === "string" && row.shop_photo_url.startsWith("https://") ? row.shop_photo_url : null),
      document_urls: readStoredAssets(row.document_urls)
        .map((asset) => privateDownloadUrl(asset, true))
        .filter((url): url is string => Boolean(url)),
      business: businesses[String(row.business_id)] || null,
    })),
    packages: packagesRes.data || [],
    payments: orders.map((row) => ({
      id: row.id,
      business: businesses[String(row.business_id)] || null,
      amount_inr: row.amount_inr,
      payment_status: row.payment_status,
      campaign_status: row.campaign_status,
      razorpay_order_id: row.razorpay_order_id,
      razorpay_payment_id: row.razorpay_payment_id,
      updated_at: row.updated_at,
    })),
    audit: auditRes.data || [],
    customRequests: customRequests.map((row) => ({
      ...row,
      business: businesses[String(row.business_id)] || null,
    })),
    errors: [ordersRes.error, verificationsRes.error, packagesRes.error, customRes.error]
      .filter(Boolean)
      .map((item) => item?.message)
      .filter((message) => typeof message === "string" && !message.includes("CLOUDINARY_API_KEY")),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const admin = await loadAdmin(String(body.adminId || ""));
  if (!admin || !canEditTab(admin, PROMO_TAB)) return denied();
  const supabase = getSupabase();
  const action = String(body.action || "");

  if (action === "verification") {
    const status = String(body.status || "");
    if (!["approved", "rejected", "resubmission_required", "under_review"].includes(status)) {
      return NextResponse.json({ error: "Choose a valid verification result." }, { status: 400 });
    }
    if (status !== "approved" && status !== "under_review" && !String(body.reason || "").trim()) {
      return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    }
    const { error } = await supabase.from("business_verifications").update({
      status,
      rejection_reason: status === "approved" ? null : String(body.reason || "").trim() || null,
      reviewer_admin_id: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      verification_id: body.id,
      actor_admin_id: admin.id,
      action: `verification_${status}`,
      to_status: status,
      note: String(body.reason || ""),
    });
    return NextResponse.json({ success: true });
  }

  if (action === "status") {
    const { data: order } = await supabase.from("promotion_orders").select("id, campaign_status, payment_status").eq("id", body.id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const next = String(body.status || "");
    if (next === "payment_successful" || !canMoveCampaign(String(order.campaign_status), next)) {
      return NextResponse.json({ error: "That status change is not allowed." }, { status: 400 });
    }
    if (["rejected", "cancelled", "refund_pending", "refunded"].includes(next) && !String(body.note || "").trim()) {
      return NextResponse.json({ error: "Add a reason for this change." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      campaign_status: next,
      admin_note: String(body.note || "").trim() || null,
      updated_at: now,
    };
    if (["rejected", "cancelled"].includes(next)) patch.rejection_reason = String(body.note || "").trim();
    if (next === "ad_active") patch.campaign_started_at = now;
    if (next === "completed") patch.campaign_ended_at = now;
    const { error } = await supabase.from("promotion_orders").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      order_id: body.id,
      actor_admin_id: admin.id,
      action: "campaign_status",
      from_status: order.campaign_status,
      to_status: next,
      note: String(body.note || ""),
    });
    return NextResponse.json({ success: true });
  }

  if (action === "metrics") {
    const reach = Number(body.reach);
    const views = Number(body.views);
    const visits = Number(body.visits);
    if (![reach, views, visits].every((value) => Number.isFinite(value) && value >= 0)) {
      return NextResponse.json({ error: "Metrics must be zero or greater." }, { status: 400 });
    }
    const metrics = {
      reach: Math.round(reach),
      views: Math.round(views),
      visits: Math.round(visits),
    };
    const { error } = await supabase.from("promotion_orders").update({
      actual_reach: metrics.reach,
      actual_views: metrics.views,
      actual_visits: metrics.visits,
      updated_at: new Date().toISOString(),
    }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      order_id: body.id,
      actor_admin_id: admin.id,
      action: "metrics",
      metrics,
      note: "Actual campaign results",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "custom") {
    const status = String(body.status || "");
    if (!["received", "in_review", "quoted", "closed"].includes(status)) {
      return NextResponse.json({ error: "Choose a valid custom-plan status." }, { status: 400 });
    }
    const { error } = await supabase.from("promotion_custom_requests").update({
      status,
      admin_note: String(body.note || "").trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      actor_admin_id: admin.id,
      business_id: null,
      action: "custom_plan",
      to_status: status,
      note: `${body.id} ${String(body.note || "")}`.trim(),
    });
    return NextResponse.json({ success: true });
  }

  if (action === "package") {
    const price = Number(body.price_inr);
    const reference = Number(body.reference_inr);
    if (!Number.isFinite(price) || price < 1 || !Number.isFinite(reference) || reference < price) {
      return NextResponse.json({ error: "Check the launch price and reference price." }, { status: 400 });
    }
    const row = {
      name: String(body.name || "").trim(),
      price_inr: Math.round(price),
      reference_inr: Math.round(reference),
      duration_days: Number(body.duration_days),
      coverage_label: String(body.coverage_label || "").trim(),
      reach_label: String(body.reach_label || "").trim(),
      views_label: String(body.views_label || "").trim(),
      visits_label: String(body.visits_label || "").trim(),
      active: Boolean(body.active),
      sort_order: Number(body.sort_order) || 0,
      popular: Boolean(body.popular),
      updated_at: new Date().toISOString(),
    };
    if (!row.name || !row.coverage_label) {
      return NextResponse.json({ error: "Name and coverage are required." }, { status: 400 });
    }
    const query = body.id
      ? supabase.from("promotion_packages").update(row).eq("id", body.id)
      : supabase.from("promotion_packages").insert({ ...row, id: String(body.newId || "").trim().toLowerCase() });
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("promotion_audit").insert({
      actor_admin_id: admin.id,
      action: body.id ? "package_update" : "package_create",
      note: `${row.name} ₹${row.price_inr}`,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
