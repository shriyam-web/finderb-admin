import {
  indianMobileValidationError,
  normalizeIndianPhoneForStorage,
} from "./indianPhone";
import { validateRegistrationPassword } from "./merchantPasswordPolicy";

export const REGISTRATION_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_NAME_LENGTH = 2;
export const MIN_ADDRESS_LINE1_LENGTH = 5;

export type MerchantRegistrationPayload = {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  businessName: string;
  displayName?: string;
  category: string;
  city: string;
  state: string;
  country: string;
  publicPhone: string;
  addressLine1: string;
  addressLine2?: string;
  selectedPlan?: string;
  billingCycle?: string;
  activateImmediately?: boolean;
};

export type NormalizedMerchantRegistration = {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  businessName: string;
  displayName: string;
  category: string;
  city: string;
  state: string;
  country: string;
  publicPhone: string;
  businessAddress: string;
  location: string;
  selectedPlan: string;
  billingCycle: string;
  activateImmediately: boolean;
};

function combineBusinessAddress(line1: string, line2?: string | null): string {
  return [line1.trim(), line2?.trim() ?? ""].filter(Boolean).join(", ");
}

export function validateAndNormalizeMerchantRegistration(
  data: MerchantRegistrationPayload,
): { ok: true; data: NormalizedMerchantRegistration } | { ok: false; error: string } {
  const fullName = data.fullName?.trim() ?? "";
  if (!fullName || fullName.length < MIN_NAME_LENGTH) {
    return { ok: false, error: "Owner full name must be at least 2 characters." };
  }

  const email = (data.email ?? "").trim().toLowerCase();
  if (!email || !REGISTRATION_EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const passwordError = validateRegistrationPassword(data.password ?? "");
  if (passwordError) return { ok: false, error: passwordError };

  const mobileError = indianMobileValidationError(data.mobile ?? "", { label: "mobile number" });
  if (mobileError) return { ok: false, error: mobileError };

  const businessName = data.businessName?.trim() ?? "";
  if (!businessName || businessName.length < MIN_NAME_LENGTH) {
    return { ok: false, error: "Legal business name must be at least 2 characters." };
  }

  const displayNameRaw = data.displayName?.trim() ?? "";
  if (displayNameRaw && displayNameRaw.length < MIN_NAME_LENGTH) {
    return { ok: false, error: "Business display name must be at least 2 characters." };
  }

  const category = data.category?.trim() ?? "";
  if (!category) return { ok: false, error: "Please select a business category." };

  const addressLine1 = data.addressLine1?.trim() ?? "";
  if (!addressLine1 || addressLine1.length < MIN_ADDRESS_LINE1_LENGTH) {
    return { ok: false, error: `Address line 1 must be at least ${MIN_ADDRESS_LINE1_LENGTH} characters.` };
  }

  const country = data.country?.trim() || "India";
  const state = data.state?.trim() ?? "";
  const city = data.city?.trim() ?? "";
  if (!state) return { ok: false, error: "Please select your state." };
  if (!city) return { ok: false, error: "Please select your city." };

  const publicPhoneError = indianMobileValidationError(data.publicPhone ?? "", {
    label: "display phone number",
  });
  if (publicPhoneError) return { ok: false, error: publicPhoneError };

  const selectedPlan = (data.selectedPlan || "free").trim().toLowerCase();
  const billingCycle = (data.billingCycle || "monthly").trim().toLowerCase();
  const allowedPlans = new Set(["free", "starter", "growth", "pro"]);

  return {
    ok: true,
    data: {
      fullName,
      email,
      password: data.password,
      mobile: normalizeIndianPhoneForStorage(data.mobile),
      businessName,
      displayName: displayNameRaw || businessName,
      category,
      city,
      state,
      country,
      publicPhone: normalizeIndianPhoneForStorage(data.publicPhone),
      businessAddress: combineBusinessAddress(addressLine1, data.addressLine2),
      location: [city, state].filter(Boolean).join(", "),
      selectedPlan: allowedPlans.has(selectedPlan) ? selectedPlan : "free",
      billingCycle: billingCycle === "annual" ? "annual" : "monthly",
      activateImmediately: Boolean(data.activateImmediately),
    },
  };
}
