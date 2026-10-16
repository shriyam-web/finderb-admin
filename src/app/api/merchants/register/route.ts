import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildBusinessSlugCandidate,
  withSlugSuffix,
} from "../../../../lib/businessSlug";
import {
  buildPlaceholderEmailCandidate,
  randomPlaceholderEmailDigits,
} from "../../../../lib/placeholderEmail";
import { hashPassword } from "../../../../lib/merchantPassword";
import {
  validateAndNormalizeMerchantRegistration,
  type MerchantRegistrationPayload,
} from "../../../../lib/merchantRegistration";
import { canEditTab } from "../../../../lib/adminTabAccess";
import { resolveGalleryImages } from "../../../../lib/rehostRemoteImage";
import { notifyListingLiveOnSite } from "../../../../lib/notifyListingLive";

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
    const { data } = await supabase
      .from("Business")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    if (!data?.length) return candidate;
  }

  return withSlugSuffix(base, businessId.slice(0, 8));
}

async function generateUniquePlaceholderEmail(
  supabase: ReturnType<typeof getSupabase>,
  businessName: string,
): Promise<string> {
  for (let i = 0; i < 50; i += 1) {
    // Always randomize — never use bare brand@finderb.com (guessable with default password).
    const candidate = buildPlaceholderEmailCandidate(businessName);
    const { data } = await supabase
      .from("Business")
      .select("id")
      .or(`email.eq.${candidate},workEmail.eq.${candidate}`)
      .limit(1);
    if (!data?.length) return candidate;
  }

  return buildPlaceholderEmailCandidate(
    businessName,
    `${randomPlaceholderEmailDigits()}${crypto.randomUUID().replace(/\D/g, "").slice(0, 6)}`,
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MerchantRegistrationPayload & {
      adminId?: string;
    };

    if (!body.adminId) {
      return NextResponse.json(
        { success: false, error: "Admin session required." },
        { status: 401 },
      );
    }

    const supabase = getSupabase();

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
      .eq("id", body.adminId)
      .single();

    if (adminError || !admin || admin.is_disabled) {
      return NextResponse.json(
        { success: false, error: "Unauthorized admin session." },
        { status: 401 },
      );
    }

    if (
      !canEditTab(
        {
          role: admin.role,
          allowed_tabs: admin.allowed_tabs,
          allowed_tab_modes: admin.allowed_tab_modes,
        },
        "Business Onboarding",
      ) &&
      !canEditTab(
        {
          role: admin.role,
          allowed_tabs: admin.allowed_tabs,
          allowed_tab_modes: admin.allowed_tab_modes,
        },
        "Quick Onboard",
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have edit permission for business onboarding.",
        },
        { status: 403 },
      );
    }

    const validated = validateAndNormalizeMerchantRegistration(body);
    if (!validated.ok) {
      return NextResponse.json(
        { success: false, error: validated.error },
        { status: 400 },
      );
    }

    const normalized = validated.data;

    if (normalized.emailUnavailable) {
      normalized.email = await generateUniquePlaceholderEmail(
        supabase,
        normalized.businessName,
      );
    } else {
      const { data: emailConflict } = await supabase
        .from("Business")
        .select("id")
        .or(`email.eq.${normalized.email},workEmail.eq.${normalized.email}`)
        .limit(1);

      if (emailConflict?.length) {
        return NextResponse.json(
          {
            success: false,
            error: "A merchant with this email already exists.",
          },
          { status: 409 },
        );
      }
    }

    const { data: mobileConflict } = await supabase
      .from("Business")
      .select("id")
      .eq("mobile", normalized.mobile)
      .limit(1);

    if (mobileConflict?.length) {
      return NextResponse.json(
        {
          success: false,
          error: "A merchant with this mobile number already exists.",
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(normalized.password);
    const slug = await generateUniqueSlug(
      supabase,
      normalized.businessName,
      normalized.city,
      id,
    );

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
    // KYC is a separate verification system — never set by listing activation.
    const kycStatus = "pending";

    const galleryImages = await resolveGalleryImages(normalized.photos);
    const profilePictureUrl = galleryImages[0] || null;

    const insertRow = {
        id,
        fullName: normalized.fullName,
        // Placeholder logins keep workEmail blank so the profile still
        // reads as "email missing" until the real address is collected.
        // (workEmail is NOT NULL, so use an empty string rather than null.)
        workEmail: normalized.emailUnavailable ? "" : normalized.email,
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
        isVerified: false,
        registrationNumber,
        password: passwordHash,
        slug,
        about: normalized.about,
        website: normalized.website,
        facebookUrl: normalized.facebookUrl,
        instagramUrl: normalized.instagramUrl,
        youtubeUrl: normalized.youtubeUrl,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        googleRating: normalized.googleRating,
        timings: normalized.timings,
        // Business.images is NOT NULL (default '{}') — never insert null.
        images: galleryImages,
        profilePictureUrl,
        paymentModes: normalized.paymentModes,
        createdAt: now,
        updatedAt: now,
        onboardSource: "admin",
    };
    let { data: business, error } = await supabase
      .from("Business")
      .insert(insertRow)
      .select(
        "id, registrationNumber, businessName, fullName, email, mobile, slug, status, kycStatus, city",
      )
      .single();
    if (error && /onboardSource/i.test(error.message)) {
      const withoutSource = { ...insertRow } as Record<string, unknown>;
      delete withoutSource.onboardSource;
      const retry = await supabase
        .from("Business")
        .insert(withoutSource)
        .select(
          "id, registrationNumber, businessName, fullName, email, mobile, slug, status, kycStatus, city",
        )
        .single();
      business = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === "23505") {
        const message = error.message.toLowerCase().includes("mobile")
          ? "A merchant with this mobile number already exists."
          : error.message.toLowerCase().includes("email")
            ? "A merchant with this email already exists."
            : "A merchant with these details already exists.";
        return NextResponse.json(
          { success: false, error: message },
          { status: 409 },
        );
      }
      console.error("[admin-register] insert failed:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    if (!business) {
      return NextResponse.json(
        { success: false, error: "Registration failed." },
        { status: 500 },
      );
    }

    if (String(business.status || "").toLowerCase() === "active") {
      void notifyListingLiveOnSite(String(business.id)).catch((notifyError) => {
        console.warn("[admin-register] listing-live notify failed", notifyError);
      });
    }

    return NextResponse.json({ success: true, business });
  } catch (error: unknown) {
    console.error("[admin-register] unexpected:", error);
    const message =
      error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
