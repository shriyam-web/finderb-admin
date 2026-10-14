export const PROFILE_LEAD_BADGE = 'Generated on your profile';
export const CATEGORY_LEAD_BADGE = 'Popular in your category';
export const CATEGORY_LEAD_BADGE_LEGACY = 'In your category';
export const DIRECT_LEAD_BADGE = 'Direct Lead';

export function normalizeLeadSource(status: string | null | undefined): string | null {
  if (status === CATEGORY_LEAD_BADGE_LEGACY) return CATEGORY_LEAD_BADGE;
  if (
    status === PROFILE_LEAD_BADGE ||
    status === CATEGORY_LEAD_BADGE ||
    status === DIRECT_LEAD_BADGE
  ) {
    return status;
  }
  return null;
}

export function leadBadgeClassName(status: string): string {
  const source = normalizeLeadSource(status);
  if (source === DIRECT_LEAD_BADGE) {
    return 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm';
  }
  if (source === PROFILE_LEAD_BADGE) {
    return 'bg-[#12324c] text-[#e8f3ff] border-[#0b2236]';
  }
  if (source === CATEGORY_LEAD_BADGE) {
    return 'bg-gradient-to-r from-[#fff4d2] via-[#f7c948] to-[#e8a317] text-[#5a3b04] border-[#d7a21a]/70';
  }
  if (status === 'To be contacted' || status === 'Asked to connect later') {
    return 'bg-sky-50 text-sky-800 border-sky-200';
  }
  if (status === 'New Lead' || status === 'New') {
    return 'bg-sky-50 text-sky-800 border-sky-200';
  }
  if (status === 'Contacted') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }
  if (status === 'Not interested') {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  if (status === 'Wrong lead') {
    return 'bg-orange-50 text-orange-900 border-orange-200';
  }
  if (status === 'Converted') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (status === 'Closed') {
    return 'bg-slate-50 text-slate-600 border-slate-100';
  }
  return 'bg-slate-50 text-slate-600 border-slate-100';
}

export function isProfileLeadSource(status: string): boolean {
  return normalizeLeadSource(status) === PROFILE_LEAD_BADGE;
}

export function isCategoryLeadSource(status: string): boolean {
  return normalizeLeadSource(status) === CATEGORY_LEAD_BADGE;
}

export function isDirectLeadSource(status: string): boolean {
  return normalizeLeadSource(status) === DIRECT_LEAD_BADGE;
}

export function isLegacyLeadSource(status: string): boolean {
  return !isProfileLeadSource(status) && !isCategoryLeadSource(status) && !isDirectLeadSource(status);
}
