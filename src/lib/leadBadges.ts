export const PROFILE_LEAD_BADGE = 'Generated on your profile';
export const CATEGORY_LEAD_BADGE = 'In your category';

export function leadBadgeClassName(status: string): string {
  if (status === PROFILE_LEAD_BADGE) {
    return 'bg-blue-50 text-blue-800 border-blue-200';
  }
  if (status === CATEGORY_LEAD_BADGE) {
    return 'bg-violet-50 text-violet-800 border-violet-200';
  }
  if (status === 'New Lead' || status === 'New') {
    return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  }
  if (status === 'Contacted') {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }
  if (status === 'Closed') {
    return 'bg-slate-50 text-slate-600 border-slate-100';
  }
  return 'bg-slate-50 text-slate-600 border-slate-100';
}

export function isProfileLeadSource(status: string): boolean {
  return status === PROFILE_LEAD_BADGE;
}

export function isCategoryLeadSource(status: string): boolean {
  return status === CATEGORY_LEAD_BADGE;
}

export function isLegacyLeadSource(status: string): boolean {
  return !isProfileLeadSource(status) && !isCategoryLeadSource(status);
}
