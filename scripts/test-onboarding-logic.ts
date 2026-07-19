/**
 * Standalone sanity tests for the placeholder-email onboarding logic.
 * Run: npx tsx scripts/test-onboarding-logic.ts
 */
import {
  buildPlaceholderEmailCandidate,
  isPlaceholderEmail,
  PLACEHOLDER_EMAIL_DOMAIN,
} from "../src/lib/placeholderEmail";
import { validateAndNormalizeMerchantRegistration } from "../src/lib/merchantRegistration";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`, detail ?? "");
  }
}

const validBase = {
  fullName: "Priya Sharma",
  password: "Finderb@1234",
  mobile: "9812345678",
  businessName: "Flame & Flavors",
  category: "Restaurants",
  addressLine1: "12 MG Road",
  state: "Delhi",
  city: "New Delhi",
  country: "India",
  publicPhone: "9812345678",
};

console.log("placeholderEmail helpers");
check(
  "generates slugified placeholder from business name",
  buildPlaceholderEmailCandidate("Flame & Flavors") ===
    `flame-and-flavors@${PLACEHOLDER_EMAIL_DOMAIN}`,
  buildPlaceholderEmailCandidate("Flame & Flavors"),
);
check(
  "applies numeric suffix for collisions",
  buildPlaceholderEmailCandidate("Flame & Flavors", "2") ===
    `flame-and-flavors-2@${PLACEHOLDER_EMAIL_DOMAIN}`,
);
check(
  "falls back to 'merchant' for empty/symbol-only names",
  buildPlaceholderEmailCandidate("!!!") === `merchant@${PLACEHOLDER_EMAIL_DOMAIN}`,
  buildPlaceholderEmailCandidate("!!!"),
);
check(
  "isPlaceholderEmail true for finderb.com",
  isPlaceholderEmail("abc@finderb.com") === true,
);
check(
  "isPlaceholderEmail is case-insensitive",
  isPlaceholderEmail("ABC@FinderB.com") === true,
);
check(
  "isPlaceholderEmail false for real domain",
  isPlaceholderEmail("owner@gmail.com") === false,
);
check("isPlaceholderEmail false for empty", isPlaceholderEmail("") === false);
check(
  "isPlaceholderEmail false for null",
  isPlaceholderEmail(null) === false,
);

console.log("\nregistration validation — normal email");
{
  const result = validateAndNormalizeMerchantRegistration({
    ...validBase,
    email: "owner@gmail.com",
  });
  check("accepts valid email", result.ok === true, result);
  if (result.ok) {
    check("email is lowercased & kept", result.data.email === "owner@gmail.com");
    check("emailUnavailable defaults false", result.data.emailUnavailable === false);
  }
}

console.log("\nregistration validation — missing email without flag");
{
  const result = validateAndNormalizeMerchantRegistration({
    ...validBase,
    email: "",
  });
  check("rejects empty email when flag off", result.ok === false, result);
}

console.log("\nregistration validation — invalid email without flag");
{
  const result = validateAndNormalizeMerchantRegistration({
    ...validBase,
    email: "not-an-email",
  });
  check("rejects malformed email when flag off", result.ok === false, result);
}

console.log("\nregistration validation — emailUnavailable flag");
{
  const result = validateAndNormalizeMerchantRegistration({
    ...validBase,
    email: "",
    emailUnavailable: true,
  });
  check("accepts empty email when flag on", result.ok === true, result);
  if (result.ok) {
    check("email left blank for server to fill", result.data.email === "");
    check("emailUnavailable propagated", result.data.emailUnavailable === true);
  }
}

console.log("\nregistration validation — flag on still enforces other fields");
{
  const result = validateAndNormalizeMerchantRegistration({
    ...validBase,
    email: "",
    emailUnavailable: true,
    mobile: "123", // invalid
  });
  check("still rejects bad mobile with flag on", result.ok === false, result);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
