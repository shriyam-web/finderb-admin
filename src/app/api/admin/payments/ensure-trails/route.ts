import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function amountPaiseForCycle(billingCycle: string) {
  return billingCycle === "annual" ? 358800 : 49900;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { adminId?: string };
    const adminId = body.adminId?.trim() || "";
    if (!adminId) {
      return NextResponse.json({ success: false, error: "Admin session is required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: admin } = await supabase
      .from("admins")
      .select("id, role, is_disabled")
      .eq("id", adminId)
      .maybeSingle();

    if (!admin || admin.is_disabled) {
      return NextResponse.json({ success: false, error: "Not allowed." }, { status: 403 });
    }

    const { data: businesses, error: businessError } = await supabase
      .from("Business")
      .select(
        "id, selectedPlan, billingCycle, paymentId, orderId, razorpaySubscriptionId, planStartedAt, planExpiresAt, paymentStatus, updatedAt, createdAt",
      )
      .eq("paymentStatus", "completed");

    if (businessError) {
      return NextResponse.json({ success: false, error: businessError.message }, { status: 500 });
    }

    const { data: existing } = await supabase.from("merchant_payments").select("payment_id");
    const known = new Set(
      (existing ?? [])
        .map((row) => (row.payment_id ? String(row.payment_id) : ""))
        .filter(Boolean),
    );

    const nowIso = new Date().toISOString();
    const rows = (businesses ?? [])
      .filter((business) => business.paymentId && !known.has(String(business.paymentId)))
      .map((business) => {
        const billingCycle = String(business.billingCycle || "monthly");
        return {
          business_id: business.id,
          plan: String(business.selectedPlan || "pro"),
          billing_cycle: billingCycle,
          amount_paise: amountPaiseForCycle(billingCycle),
          currency: "INR",
          status: "completed",
          order_id: business.orderId || null,
          payment_id: business.paymentId,
          razorpay_subscription_id: business.razorpaySubscriptionId || null,
          payment_type: business.razorpaySubscriptionId ? "subscription_auth" : "one_time",
          source: "admin_ensure_trail",
          plan_started_at: business.planStartedAt || null,
          plan_expires_at: business.planExpiresAt || null,
          created_at: business.updatedAt || business.createdAt || nowIso,
          updated_at: nowIso,
        };
      });

    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    const { error: insertError } = await supabase.from("merchant_payments").insert(rows);
    if (insertError) {
      console.error("[ensure-trails] insert failed", insertError.message);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: rows.length });
  } catch (error) {
    console.error("[ensure-trails] failed", error);
    return NextResponse.json({ success: false, error: "Could not refresh payment trails." }, { status: 500 });
  }
}
