import { createClient } from "../../utils/supabase/client";
import {
  buildBadgeReports,
  listingLiveInstant,
  parseBadgeOverrides,
  startOfMonthIstIso,
  type BadgeId,
  type BadgeOverrideMode,
  type BadgeReport,
} from "./businessBadges";

function indianMobileOk(value: unknown): boolean {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits);
}

function hasListingPhoto(row: Record<string, unknown>): boolean {
  const direct = [row.profilePictureUrl, row.image].some((value) => typeof value === "string" && value.trim());
  if (direct) return true;
  return Array.isArray(row.images) && row.images.some((entry) => {
    if (typeof entry === "string") return entry.trim().length > 0;
    if (entry && typeof entry === "object" && "url" in entry) return String((entry as { url?: unknown }).url || "").trim().length > 0;
    return false;
  });
}

/** Mirrors FinderB profile completion so Best in Category eligibility matches the public profile. */
function profileCompletionPercent(row: Record<string, unknown>): number {
  const filled = (key: string) => {
    const value = row[key];
    return value !== undefined && value !== null && value !== "" && (typeof value !== "object" || Object.keys(value as object).length > 0);
  };
  const keys = [
    "businessName", "displayName", "category", "publicPhone", "businessAddress", "city", "state", "country",
    "about", "profilePictureUrl", "timings", "yearsInBusiness", "website", "facebookUrl", "instagramUrl",
    "youtubeUrl", "whatsappNumber",
  ];
  let completed = keys.filter((key) => (key === "profilePictureUrl" ? hasListingPhoto(row) : filled(key))).length;
  const ownerOk = String(row.ownerName || "").trim().length > 0 && indianMobileOk(row.ownerMobile);
  if (ownerOk) completed += 1;
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) completed += 1;
  if (hasListingPhoto(row)) completed += 1;
  if (Array.isArray(row.paymentModes) && row.paymentModes.length > 0) completed += 1;
  return Math.round((completed / (keys.length + 4)) * 100);
}

function replyStats(leads: { created_at?: string | null; merchant_read_at?: string | null }[]) {
  const samples = leads
    .map((lead) => {
      if (!lead.created_at || !lead.merchant_read_at) return null;
      const created = Date.parse(lead.created_at);
      const read = Date.parse(lead.merchant_read_at);
      if (!Number.isFinite(created) || !Number.isFinite(read) || read < created) return null;
      return read - created;
    })
    .filter((value): value is number => value != null);
  if (!samples.length) return { count: 0, averageMs: null as number | null };
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { count: samples.length, averageMs };
}

function publicRating(review: unknown): { rating: number | null; reviewCount: number } {
  let source = review;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  const rows = Array.isArray(source) ? source : [];
  const visible = rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const entry = row as { hidden?: boolean; deleted?: boolean; rating?: unknown };
    return !entry.hidden && !entry.deleted && typeof entry.rating === "number";
  }) as { rating: number }[];
  if (!visible.length) return { rating: null, reviewCount: 0 };
  const total = visible.reduce((sum, row) => sum + row.rating, 0);
  return {
    rating: Math.round((total / visible.length) * 10) / 10,
    reviewCount: visible.length,
  };
}

async function monthRank(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  category: string,
  city: string,
) {
  const empty = { monthViews: 0, monthLeads: 0, topViews: 0, topLeads: 0 };
  if (!category || !city) return empty;
  const since = startOfMonthIstIso();
  const rpc = await supabase.rpc("badge_month_leaders", {
    p_city: city,
    p_category: category,
    p_since: since,
  });
  const rows = !rpc.error && Array.isArray(rpc.data) ? rpc.data : null;
  const counted = rows
    ? rows
    : await fallbackCounts(supabase, businessId, category, city, since);
  let monthViews = 0;
  let monthLeads = 0;
  let topViews = 0;
  let topLeads = 0;
  for (const row of counted) {
    const views = Number(row.views) || 0;
    const leads = Number(row.leads) || 0;
    if (views > topViews) topViews = views;
    if (leads > topLeads) topLeads = leads;
    if (String(row.business_id || "") === businessId) {
      monthViews = views;
      monthLeads = leads;
    }
  }
  return { monthViews, monthLeads, topViews, topLeads };
}

async function fallbackCounts(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  category: string,
  city: string,
  since: string,
) {
  const peers = await supabase
    .from("Business")
    .select("id")
    .ilike("status", "active")
    .ilike("city", city)
    .ilike("category", category)
    .limit(80);
  const ids = (peers.data || []).map((row) => String(row.id));
  if (!ids.includes(businessId)) ids.push(businessId);
  const totals = await Promise.all(
    ids.map(async (id) => {
      const [views, leads] = await Promise.all([
        supabase
          .from("profile_views")
          .select("id", { count: "exact", head: true })
          .eq("business_id", id)
          .gte("viewed_at", since),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("business_id", id)
          .gte("created_at", since),
      ]);
      return { business_id: id, views: views.count || 0, leads: leads.count || 0 };
    }),
  );
  return totals;
}

export async function loadMerchantBadgeReports(businessId: string): Promise<{
  reports: BadgeReport[];
  overridesReady: boolean;
}> {
  const supabase = createClient();
  const full = await supabase
    .from("Business")
    .select("id, category, city, status, createdAt, listingLiveAt, badgeOverrides, review, businessName, displayName, publicPhone, ownerName, ownerMobile, businessAddress, state, country, about, profilePictureUrl, image, images, timings, yearsInBusiness, website, facebookUrl, instagramUrl, youtubeUrl, whatsappNumber, latitude, longitude, paymentModes")
    .eq("id", businessId)
    .maybeSingle();

  let row = full.data;
  let overridesReady = !full.error;
  if (full.error && /listingLiveAt|badgeOverrides/i.test(full.error.message || "")) {
    overridesReady = false;
    const basic = await supabase
      .from("Business")
      .select("id, category, city, status, createdAt, review")
      .eq("id", businessId)
      .maybeSingle();
    row = basic.data as typeof row;
  } else if (full.error) {
    throw new Error(full.error.message);
  }
  if (!row) throw new Error("Business not found");

  const leads = await supabase
    .from("leads")
    .select("created_at, merchant_read_at")
    .eq("business_id", businessId);
  const reply = replyStats(leads.data || []);
  const rating = publicRating(row.review);
  const rank = await monthRank(supabase, businessId, String(row.category || ""), String(row.city || ""));

  return {
    overridesReady,
    reports: buildBadgeReports({
      repliedCount: reply.count,
      averageResponseMs: reply.averageMs,
      rating: rating.rating,
      reviewCount: rating.reviewCount,
      ...rank,
      category: String(row.category || ""),
      city: String(row.city || ""),
      liveAt: listingLiveInstant(row),
      completionPercent: profileCompletionPercent(row as Record<string, unknown>),
      overrides: parseBadgeOverrides(row.badgeOverrides),
    }),
  };
}

export async function saveBadgeOverride(
  businessId: string,
  id: BadgeId,
  mode: "auto" | BadgeOverrideMode,
  current: BadgeReport[],
): Promise<void> {
  const supabase = createClient();
  const next: Record<string, BadgeOverrideMode> = {};
  for (const badge of current) {
    if (badge.override === "on" || badge.override === "off") next[badge.id] = badge.override;
  }
  if (mode === "auto") delete next[id];
  else next[id] = mode;

  const { error } = await supabase.from("Business").update({ badgeOverrides: next }).eq("id", businessId);
  if (error) throw new Error(error.message);
}
