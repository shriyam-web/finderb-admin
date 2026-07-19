// Live end-to-end test of the placeholder-email onboarding via the running API.
// Creates a throwaway merchant, verifies the DB row, then deletes it.
// Run (dev server must be up): node scripts/test-onboarding-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv(".env.local");
loadEnv(".env");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase env.");
  process.exit(1);
}
const supabase = createClient(url, key);

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`, detail ?? "");
  }
};

// Pick an admin allowed to onboard.
const { data: admins } = await supabase
  .from("admins")
  .select("id, role, allowed_tabs, is_disabled");
const admin = (admins || []).find(
  (a) =>
    !a.is_disabled &&
    (a.role === "controller" ||
      (Array.isArray(a.allowed_tabs) &&
        (a.allowed_tabs.includes("Business Onboarding") ||
          a.allowed_tabs.includes("Merchant Registration")))),
);

if (!admin) {
  console.error("No eligible admin found to run onboarding test.");
  process.exit(1);
}
console.log(`Using admin ${admin.id} (${admin.role})`);

const stamp = Date.now();
const businessName = `E2E Test Diner ${stamp}`;
const mobile = "9" + String(stamp).slice(-9);
let createdId = null;

try {
  console.log("\nPlaceholder onboarding (emailUnavailable=true)");
  const res = await fetch(`${BASE_URL}/api/merchants/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminId: admin.id,
      fullName: "E2E Tester",
      email: "",
      emailUnavailable: true,
      password: "Finderb@1234",
      mobile,
      businessName,
      displayName: "",
      category: "Restaurants",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      publicPhone: mobile,
      addressLine1: "12 Test Street",
      addressLine2: "",
      selectedPlan: "free",
      billingCycle: "monthly",
      activateImmediately: false,
    }),
  });
  const payload = await res.json();
  check("API responded ok", res.ok && payload.success === true, payload);

  const biz = payload.business;
  createdId = biz?.id ?? null;
  check("returned a business id", Boolean(createdId));
  check(
    "generated email ends with @finderb.com",
    typeof biz?.email === "string" && biz.email.endsWith("@finderb.com"),
    biz?.email,
  );
  check(
    "email slug derived from business name",
    typeof biz?.email === "string" && biz.email.startsWith("e2e-test-diner"),
    biz?.email,
  );
  check("kycStatus is pending", biz?.kycStatus === "pending", biz?.kycStatus);
  check("status is Pending (not activated)", biz?.status === "Pending", biz?.status);

  // Verify persisted row: workEmail must be empty so it reads as "email missing".
  const { data: row } = await supabase
    .from("Business")
    .select("id, email, workEmail, isVerified, kycStatus")
    .eq("id", createdId)
    .single();
  check("row persisted", Boolean(row), row);
  check("workEmail is empty/null (email missing)", !row?.workEmail, row?.workEmail);
  check("row email matches generated placeholder", row?.email === biz?.email);
  check("isVerified is false", row?.isVerified === false, row?.isVerified);

  console.log("\nDuplicate mobile rejection");
  const dupRes = await fetch(`${BASE_URL}/api/merchants/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminId: admin.id,
      fullName: "E2E Tester",
      email: "",
      emailUnavailable: true,
      password: "Finderb@1234",
      mobile, // same mobile
      businessName: `${businessName} DUP`,
      category: "Restaurants",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      publicPhone: mobile,
      addressLine1: "12 Test Street",
      selectedPlan: "free",
      billingCycle: "monthly",
      activateImmediately: false,
    }),
  });
  const dupPayload = await dupRes.json();
  check(
    "duplicate mobile rejected",
    dupRes.status === 409 && dupPayload.success === false,
    dupPayload,
  );
} finally {
  if (createdId) {
    await supabase.from("merchant_audit_logs").delete().eq("merchant_id", createdId);
    const { error: delErr } = await supabase
      .from("Business")
      .delete()
      .eq("id", createdId);
    console.log(
      `\nCleanup: deleted test merchant ${createdId}${delErr ? ` (error: ${delErr.message})` : ""}`,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
