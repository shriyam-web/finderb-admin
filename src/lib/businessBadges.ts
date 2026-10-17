/** Keep in sync with FinderB/lib/businessBadges.ts. Public trust badges. */

export const BADGE_IDS = ['bestInCategory', 'quickReply', 'highlyRated', 'popularMonth', 'newOnFinderB', 'trusted'] as const;

export type BadgeId = (typeof BADGE_IDS)[number];
export type BadgeOverrideMode = 'on' | 'off';
export type BadgeOverrides = Partial<Record<BadgeId, BadgeOverrideMode>>;

export const QUICK_REPLY_MS = 60 * 60 * 1000;
export const QUICK_REPLY_MIN_REPLIES = 5;
export const HIGHLY_RATED_MIN = 4.7;
export const HIGHLY_RATED_MIN_REVIEWS = 10;
export const BEST_IN_CATEGORY_MIN = 4;
export const BEST_IN_CATEGORY_MIN_REVIEWS = 3;
export const BEST_IN_CATEGORY_RESPONSE_MS = 4 * 60 * 60 * 1000;
export const BEST_IN_CATEGORY_MIN_COMPLETION = 90;
export const NEW_LISTING_MS = 30 * 24 * 60 * 60 * 1000;
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type PublicBadge = {
  id: BadgeId;
  label: string;
};

export type BadgeReport = PublicBadge & {
  earned: boolean;
  active: boolean;
  override: 'auto' | BadgeOverrideMode;
  detail: string;
};

export const BADGE_LABEL: Record<BadgeId, string> = {
  bestInCategory: 'Best in Category',
  quickReply: 'Quick reply',
  highlyRated: 'Highly rated',
  popularMonth: 'Popular this month',
  newOnFinderB: 'New on FinderB',
  trusted: 'FinderB Trusted',
};

export const BADGE_HINT: Record<BadgeId, string> = {
  bestInCategory: 'A strong listing in its category: rating, reviews, replies, and a finished profile.',
  quickReply: 'This business usually replies to a new lead within an hour.',
  highlyRated: 'Customers rate this business 4.7 or higher across at least 10 reviews.',
  popularMonth: 'The most visited or most contacted listing in this category and city this month.',
  newOnFinderB: 'This listing went live on FinderB within the last 30 days.',
  trusted: 'FinderB has marked this business as trusted. Only an admin can award it.',
};

export const BADGE_COPY: Record<
  BadgeId,
  { eligibility: readonly string[]; benefits: readonly string[] }
> = {
  bestInCategory: {
    eligibility: [
      'Public rating is 4 or above.',
      'At least 3 reviews are visible.',
      'Average reply time is within about 4 hours.',
      'Profile completion is above 90%.',
      'An admin can force this mark on or off for one business.',
    ],
    benefits: [
      'The fire mark appears on the public profile, under the category line.',
      'Customers see the business as a strong choice in its category.',
    ],
  },
  quickReply: {
    eligibility: [
      'Average reply time on leads is within 1 hour.',
      'At least 5 leads have been opened.',
    ],
    benefits: [
      'A Quick reply chip appears on the public profile, next to the usual reply time.',
      'Customers can see this shop answers the same day, faster than the 4-hour bar for Best in Category.',
    ],
  },
  highlyRated: {
    eligibility: [
      'Public rating is 4.7 or above.',
      'At least 10 reviews are visible.',
    ],
    benefits: [
      'A Highly rated chip appears on the public profile.',
      'It reflects review quality on its own, even when reply time is slower.',
    ],
  },
  popularMonth: {
    eligibility: [
      'This calendar month, the listing has the most profile views or the most leads among active businesses in the same category and city.',
      'A listing with zero views and zero leads does not qualify.',
      'The chip drops off when a new month starts or another business moves ahead.',
    ],
    benefits: [
      'A Popular this month chip appears on the public profile.',
      'Customers see which nearby listing people are opening and contacting right now.',
    ],
  },
  newOnFinderB: {
    eligibility: ['The listing has been live for fewer than 30 days.'],
    benefits: [
      'A New on FinderB chip appears on the public profile.',
      'A new business can be noticed before it has enough reviews for Highly rated or Best in Category.',
    ],
  },
  trusted: {
    eligibility: [
      'FinderB awards this badge. It does not turn on from ratings, replies, or time on the platform.',
      'An admin can switch it on or off for one business.',
    ],
    benefits: [
      'A FinderB Trusted chip appears on the public profile.',
      'It sits apart from the green verified tick, which only confirms identity.',
    ],
  },
};

export function startOfMonthIstIso(now = Date.now()): string {
  const ist = new Date(now + IST_OFFSET_MS);
  const startUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS;
  return new Date(startUtc).toISOString();
}

export function parseBadgeOverrides(value: unknown): BadgeOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const overrides: BadgeOverrides = {};
  for (const id of BADGE_IDS) {
    const mode = source[id];
    if (mode === 'on' || mode === 'off') overrides[id] = mode;
  }
  return overrides;
}

export function formatBadgeDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hr' : `${hours} hr`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

export function listingLiveInstant(business: {
  listingLiveAt?: unknown;
  createdAt?: unknown;
  status?: unknown;
}): string | null {
  const explicit = typeof business.listingLiveAt === 'string' ? business.listingLiveAt.trim() : '';
  if (explicit && !Number.isNaN(Date.parse(explicit))) return explicit;
  const status = String(business.status || '').trim().toLowerCase();
  if (status !== 'active') return null;
  const created = typeof business.createdAt === 'string' ? business.createdAt.trim() : '';
  if (created && !Number.isNaN(Date.parse(created))) return created;
  return null;
}

export type BadgeFacts = {
  repliedCount: number;
  averageResponseMs: number | null;
  rating: number | null;
  reviewCount: number;
  monthViews: number;
  monthLeads: number;
  topViews: number;
  topLeads: number;
  category: string;
  city: string;
  liveAt: string | null;
  completionPercent?: number;
  nowMs?: number;
  overrides?: BadgeOverrides;
};

function placeLabel(category: string, city: string): string {
  if (category && city) return `${category} in ${city}`;
  return category || city || 'this area';
}

function resolveActive(id: BadgeId, earned: boolean, overrides: BadgeOverrides): { active: boolean; override: BadgeReport['override'] } {
  const mode = overrides[id];
  if (mode === 'on') return { active: true, override: 'on' };
  if (mode === 'off') return { active: false, override: 'off' };
  if (id === 'trusted') return { active: false, override: 'auto' };
  return { active: earned, override: 'auto' };
}

export function buildBadgeReports(facts: BadgeFacts): BadgeReport[] {
  const overrides = facts.overrides ?? {};
  const now = facts.nowMs ?? Date.now();
  const place = placeLabel(facts.category.trim(), facts.city.trim());

  const quickEarned =
    facts.repliedCount >= QUICK_REPLY_MIN_REPLIES &&
    facts.averageResponseMs != null &&
    facts.averageResponseMs <= QUICK_REPLY_MS;
  const quickDetail =
    facts.repliedCount === 0 || facts.averageResponseMs == null
      ? 'No lead replies yet.'
      : `${facts.repliedCount} replies, average ${formatBadgeDuration(facts.averageResponseMs)}.`;

  const ratedEarned =
    facts.rating != null &&
    facts.rating >= HIGHLY_RATED_MIN &&
    facts.reviewCount >= HIGHLY_RATED_MIN_REVIEWS;
  const ratedDetail =
    facts.rating == null || facts.reviewCount === 0
      ? 'No public reviews yet.'
      : `${facts.rating.toFixed(1)} from ${facts.reviewCount} review${facts.reviewCount === 1 ? '' : 's'}.`;

  const viewsWin = facts.monthViews > 0 && facts.monthViews >= facts.topViews;
  const leadsWin = facts.monthLeads > 0 && facts.monthLeads >= facts.topLeads;
  const popularEarned = Boolean(facts.category.trim() && facts.city.trim()) && (viewsWin || leadsWin);
  let popularDetail = `${facts.monthViews} profile views and ${facts.monthLeads} leads this month in ${place}.`;
  if (!facts.category.trim() || !facts.city.trim()) {
    popularDetail = 'Needs a category and a city before this can be compared.';
  } else if (popularEarned && viewsWin && leadsWin) {
    popularDetail = `Most profile views (${facts.monthViews}) and most leads (${facts.monthLeads}) this month in ${place}.`;
  } else if (popularEarned && viewsWin) {
    popularDetail = `Most profile views this month in ${place} (${facts.monthViews}).`;
  } else if (popularEarned && leadsWin) {
    popularDetail = `Most leads this month in ${place} (${facts.monthLeads}).`;
  } else {
    popularDetail = `${facts.monthViews} profile views and ${facts.monthLeads} leads this month in ${place}. The highest so far is ${facts.topViews} views or ${facts.topLeads} leads.`;
  }

  const liveMs = facts.liveAt ? Date.parse(facts.liveAt) : Number.NaN;
  const ageMs = Number.isFinite(liveMs) ? Math.max(0, now - liveMs) : null;
  const newEarned = ageMs != null && ageMs < NEW_LISTING_MS;
  const newDetail =
    ageMs == null
      ? 'This listing is not live yet.'
      : `Live for ${Math.floor(ageMs / (24 * 60 * 60 * 1000))} day${Math.floor(ageMs / (24 * 60 * 60 * 1000)) === 1 ? '' : 's'}.`;

  const completion = facts.completionPercent ?? 0;
  const bestEarned =
    facts.rating != null &&
    facts.rating >= BEST_IN_CATEGORY_MIN &&
    facts.reviewCount >= BEST_IN_CATEGORY_MIN_REVIEWS &&
    facts.averageResponseMs != null &&
    facts.averageResponseMs <= BEST_IN_CATEGORY_RESPONSE_MS &&
    completion > BEST_IN_CATEGORY_MIN_COMPLETION;
  const bestDetail = [
    facts.rating == null ? 'No rating' : `${facts.rating.toFixed(1)} rating`,
    `${facts.reviewCount} review${facts.reviewCount === 1 ? '' : 's'}`,
    facts.averageResponseMs == null ? 'no replies yet' : `replies in ${formatBadgeDuration(facts.averageResponseMs)}`,
    `profile ${Math.round(completion)}%`,
  ].join(' · ');

  const rows: Array<{ id: BadgeId; earned: boolean; detail: string }> = [
    { id: 'bestInCategory', earned: bestEarned, detail: `${bestDetail}.` },
    { id: 'quickReply', earned: quickEarned, detail: quickDetail },
    { id: 'highlyRated', earned: ratedEarned, detail: ratedDetail },
    { id: 'popularMonth', earned: popularEarned, detail: popularDetail },
    { id: 'newOnFinderB', earned: newEarned, detail: newDetail },
    { id: 'trusted', earned: false, detail: 'FinderB awards this. It does not turn on by itself.' },
  ];

  return rows.map((row) => {
    const resolved = resolveActive(row.id, row.earned, overrides);
    return {
      id: row.id,
      label: BADGE_LABEL[row.id],
      earned: row.earned,
      detail: row.detail,
      ...resolved,
    };
  });
}

export function activePublicBadges(reports: BadgeReport[]): PublicBadge[] {
  return reports.filter((badge) => badge.active).map((badge) => ({ id: badge.id, label: badge.label }));
}

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === 'string' && (BADGE_IDS as readonly string[]).includes(value);
}
