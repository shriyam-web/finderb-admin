import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildBusinessSlugCandidate, withSlugSuffix } from "../../../../lib/businessSlug";
import { hashPassword } from "../../../../lib/merchantPassword";
import {
  validateAndNormalizeMerchantRegistration,
  type MerchantRegistrationPayload,
} from "../../../../lib/merchantRegistration";

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

function generateRegistrationNumber() {
  return `FINDERB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

async function generateUniqueSlug(
  supabase: ReturnType<typeof getSupabase>,
  businessName: string,
  city: string,
  businessId: string,
): Promise<string> {
  const base = buildBusinessSlugCandidate(businessName, city);

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : withSlugSuffix(base, String(i + 1));
    const { data } = await supabase.from("Business").select("id").eq("slug", candidate).limit(1);
    if (!data?.length) return candidate;
  }

  return withSlugSuffix(base, businessId.slice(0, 8));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MerchantRegistrationPayload & {
      adminId?: string;
    };

    if (!body.adminId) {
      return NextResponse.json({ success: false, error: "Admin session required." }, { status: 401 });
    }

    const supabase = getSupabase();

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, role, is_disabled, allowed_tabs")
      .eq("id", body.adminId)
      .single();

    if (adminError || !admin || admin.is_disabled) {
      return NextResponse.json({ success: false, error: "Unauthorized admin session." }, { status: 401 });
    }

    const isController = admin.role === "controller";
    const allowed = Array.isArray(admin.allowed_tabs) ? admin.allowed_tabs : [];
    if (
      !isController &&
      !allowed.includes("Business Onboarding") &&
      !allowed.includes("Merchant Registration")
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have permission for business onboarding." },
        { status: 403 },
      );
    }

    const validated = validateAndNormalizeMerchantRegistration(body);
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }

    const normalized = validated.data;

    const { data: emailConflict } = await supabase
      .from("Business")
      .select("id")
      .or(`email.eq.${normalized.email},workEmail.eq.${normalized.email}`)
      .limit(1);

    if (emailConflict?.length) {
      return NextResponse.json(
        { success: false, error: "A merchant with this email already exists." },
        { status: 409 },
      );
    }

    const { data: mobileConflict } = await supabase
      .from("Business")
      .select("id")
      .eq("mobile", normalized.mobile)
      .limit(1);

    if (mobileConflict?.length) {
      return NextResponse.json(
        { success: false, error: "A merchant with this mobile number already exists." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(normalized.password);
    const slug = await generateUniqueSlug(supabase, normalized.businessName, normalized.city, id);

    let registrationNumber = generateRegistrationNumber();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: regConflict } = await supabase
        .from("Business")
        .select("id")
        .eq("registrationNumber", registrationNumber)
        .limit(1);
      if (!regConflict?.length) break;
      registrationNumber = generateRegistrationNumber();
    }

    const status = normalized.activateImmediately ? "Active" : "Pending";
    const kycStatus = normalized.activateImmediately ? "approved" : "pending";

    const { data: business, error } = await supabase
      .from("Business")
      .insert({
        id,
        fullName: normalized.fullName,
        workEmail: normalized.email,
        email: normalized.email,
        mobile: normalized.mobile,
        businessName: normalized.businessName,
        displayName: normalized.displayName,
        owner_name: normalized.fullName,
        owner_mobile: normalized.mobile,
        category: normalized.category,
        location: normalized.location,
        city: normalized.city,
        state: normalized.state,
        country: normalized.country,
        publicPhone: normalized.publicPhone,
        businessAddress: normalized.businessAddress,
        selectedPlan: normalized.selectedPlan,
        billingCycle: normalized.billingCycle,
        status,
        kycStatus,
        isVerified: normalized.activateImmediately,
        registrationNumber,
        password: passwordHash,
        slug,
        createdAt: now,
        updatedAt: now,
      })
      .select("id, registrationNumber, businessName, fullName, email, mobile, slug, status, kycStatus, city")
      .single();

    if (error) {
      if (error.code === "23505") {
        const message = error.message.toLowerCase().includes("mobile")
          ? "A merchant with this mobile number already exists."
          : error.message.toLowerCase().includes("email")
            ? "A merchant with this email already exists."
            : "A merchant with these details already exists.";
        return NextResponse.json({ success: false, error: message }, { status: 409 });
      }
      console.error("[admin-register] insert failed:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, business });
  } catch (error: unknown) {
    console.error("[admin-register] unexpected:", error);
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
