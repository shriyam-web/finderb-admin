export const SITE_CONFIG_ID = "finderb";

export type SiteConfigForm = {
  pricing: {
    growthMonthly: number;
    growthMonthlyRetail: number;
    proAnnual: number;
    proAnnualRetail: number;
  };
  contact: {
    companyName: string;
    brand: string;
    email: string;
    phone: string;
    phoneDisplay: string;
    showPhone: boolean;
    addressLine1: string;
    addressLine2: string;
    country: string;
    pincode: string;
    showAddress: boolean;
    hoursWeekdays: string;
    hoursSaturday: string;
    hoursSunday: string;
    grievanceName: string;
    grievanceEmail: string;
    grievanceResponse: string;
  };
  features: {
    promoteBusinessOnline: boolean;
  };
};

export const DEFAULT_SITE_CONFIG_FORM: SiteConfigForm = {
  pricing: {
    growthMonthly: 499,
    growthMonthlyRetail: 2999,
    proAnnual: 3588,
    proAnnualRetail: 35988,
  },
  contact: {
    companyName: "MAAGAA Connect Private Limited",
    brand: "FinderB",
    email: "support@finderb.com",
    phone: "+919990222346",
    phoneDisplay: "+91 9990222346",
    showPhone: false,
    addressLine1: "MAAGAA Connect Private Limited",
    addressLine2: "Noida, Uttar Pradesh",
    country: "India",
    pincode: "201301",
    showAddress: false,
    hoursWeekdays: "Monday – Friday: 9:00 AM – 6:00 PM IST",
    hoursSaturday: "Saturday: 10:00 AM – 4:00 PM IST",
    hoursSunday: "Sunday: Closed",
    grievanceName: "Customer Support Team",
    grievanceEmail: "support@finderb.com",
    grievanceResponse: "within 7 working days",
  },
  features: {
    promoteBusinessOnline: false,
  },
};

function money(value: unknown, fallback: number): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return fallback;
  const rupees = Math.round(amount);
  if (rupees < 1 || rupees > 10_000_000) return fallback;
  return rupees;
}

function text(value: unknown, fallback: string, max = 180): string {
  const next = String(value ?? "").trim();
  if (!next) return fallback;
  return next.slice(0, max);
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseSiteConfigForm(raw: unknown): SiteConfigForm {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pricing = (row.pricing && typeof row.pricing === "object" ? row.pricing : {}) as Record<string, unknown>;
  const contact = (row.contact && typeof row.contact === "object" ? row.contact : {}) as Record<string, unknown>;
  const features = (row.features && typeof row.features === "object" ? row.features : {}) as Record<string, unknown>;
  const base = DEFAULT_SITE_CONFIG_FORM;
  return {
    pricing: {
      growthMonthly: money(pricing.growthMonthly, base.pricing.growthMonthly),
      growthMonthlyRetail: money(pricing.growthMonthlyRetail, base.pricing.growthMonthlyRetail),
      proAnnual: money(pricing.proAnnual, base.pricing.proAnnual),
      proAnnualRetail: money(pricing.proAnnualRetail, base.pricing.proAnnualRetail),
    },
    contact: {
      companyName: text(contact.companyName, base.contact.companyName),
      brand: text(contact.brand, base.contact.brand, 40),
      email: text(contact.email, base.contact.email),
      phone: text(contact.phone, base.contact.phone, 20),
      phoneDisplay: text(contact.phoneDisplay, base.contact.phoneDisplay, 32),
      showPhone: flag(contact.showPhone, base.contact.showPhone),
      addressLine1: text(contact.addressLine1, base.contact.addressLine1),
      addressLine2: text(contact.addressLine2, base.contact.addressLine2),
      country: text(contact.country, base.contact.country, 60),
      pincode: text(contact.pincode, base.contact.pincode, 12),
      showAddress: flag(contact.showAddress, base.contact.showAddress),
      hoursWeekdays: text(contact.hoursWeekdays, base.contact.hoursWeekdays),
      hoursSaturday: text(contact.hoursSaturday, base.contact.hoursSaturday),
      hoursSunday: text(contact.hoursSunday, base.contact.hoursSunday),
      grievanceName: text(contact.grievanceName, base.contact.grievanceName),
      grievanceEmail: text(contact.grievanceEmail, base.contact.grievanceEmail),
      grievanceResponse: text(contact.grievanceResponse, base.contact.grievanceResponse),
    },
    features: {
      promoteBusinessOnline: flag(features.promoteBusinessOnline, false),
    },
  };
}
