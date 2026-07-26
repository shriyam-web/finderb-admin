/**
 * Reliability tests for Quick Onboard JSON parsing.
 * Run: npx tsx scripts/test-quick-onboard.ts
 */
import {
  buildCategoryTaxonomy,
  buildQuickOnboardPrompt,
  draftFromAiFields,
  extractJsonObjectText,
  formatCategoryTaxonomyForPrompt,
  parseQuickOnboardPayload,
  resolveCategoryLabel,
  toRegistrationPayload,
  validateQuickOnboardDraft,
} from "../src/lib/quickOnboard";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`, detail ?? "");
  }
}

const categories = [
  { id: "1", name: "Restaurants", parent_id: null },
  { id: "2", name: "Fine Dining", parent_id: "1" },
  { id: "3", name: "Cafes", parent_id: null },
  { id: "4", name: "Beauty & Wellness", parent_id: null },
  { id: "5", name: "Salon", parent_id: "4" },
  { id: "6", name: "Spa", parent_id: "4" },
];

const goodPayload = {
  ownerFullName: "Priya Sharma",
  loginEmail: "owner@studio.in",
  emailUnavailable: false,
  mobile: "9812345678",
  businessName: "Flame & Flavors",
  displayName: "Flame & Flavors",
  category: "Restaurants",
  subcategory: "Fine Dining",
  addressLine1: "12 MG Road, Connaught Place",
  addressLine2: "",
  city: "New Delhi",
  state: "Delhi",
  country: "India",
  publicPhone: "9812345678",
  activateImmediately: false,
  notes: "",
};

console.log("extractJsonObjectText");
check(
  "extracts fenced json",
  extractJsonObjectText(
    "Here\n```json\n" + JSON.stringify(goodPayload) + "\n```\n",
  ) === JSON.stringify(goodPayload),
);
check(
  "extracts bare object",
  extractJsonObjectText(JSON.stringify(goodPayload)) ===
    JSON.stringify(goodPayload),
);
check(
  "rejects freeform",
  extractJsonObjectText("Flame & Flavors\nNew Delhi") === null,
);

console.log("\nparseQuickOnboardPayload");
{
  const fenced = "Sure!\n```json\n" + JSON.stringify(goodPayload) + "\n```";
  const result = parseQuickOnboardPayload(fenced);
  check("accepts fenced JSON", result.ok === true, result);
  if (result.ok) {
    check(
      "businessName parsed",
      result.fields.businessName === "Flame & Flavors",
    );
    check("mobile 10 digits", result.fields.mobile === "9812345678");
    check("subcategory parsed", result.fields.subcategory === "Fine Dining");
  }
}
{
  const result = parseQuickOnboardPayload(JSON.stringify(goodPayload));
  check("accepts bare JSON", result.ok === true, result);
}
{
  const result = parseQuickOnboardPayload(
    "Flame & Flavors\nAddress: 12 MG Road\nPhone: 9812345678",
  );
  check("rejects raw Google text", result.ok === false, result);
  check(
    "helpful message for raw paste",
    !result.ok && Boolean(result.message?.includes("ChatGPT JSON")),
    !result.ok ? result.message : undefined,
  );
}
{
  const result = parseQuickOnboardPayload(
    JSON.stringify({ ...goodPayload, loginEmail: "", emailUnavailable: true }),
  );
  check("emailUnavailable accepted", result.ok === true, result);
}
{
  const result = parseQuickOnboardPayload(
    JSON.stringify({ ...goodPayload, mobile: "123" }),
  );
  check("bad phone rejected", result.ok === false, result);
}
{
  const result = parseQuickOnboardPayload(
    JSON.stringify({ ...goodPayload, mobile: "+91 98123 45678" }),
  );
  check(
    "strips +91 from mobile",
    result.ok === true && result.fields?.mobile === "9812345678",
    result,
  );
}
{
  const result = parseQuickOnboardPayload("{ not json");
  check("invalid JSON rejected", result.ok === false, result);
}
{
  // Legacy combined category without subcategory key
  const legacy = {
    ...goodPayload,
    category: "Restaurants › Fine Dining",
    subcategory: undefined,
  };
  delete (legacy as { subcategory?: string }).subcategory;
  const result = parseQuickOnboardPayload(JSON.stringify(legacy));
  check(
    "legacy Parent › Child splits",
    result.ok === true &&
      result.fields?.category === "Restaurants" &&
      result.fields?.subcategory === "Fine Dining",
    result,
  );
}

console.log("\ntaxonomy prompt");
{
  const tree = buildCategoryTaxonomy(categories);
  check("taxonomy parents ordered", tree[0]?.name === "Beauty & Wellness");
  check(
    "restaurants has Fine Dining child",
    tree.some(
      (n) =>
        n.name === "Restaurants" && n.subcategories.includes("Fine Dining"),
    ),
  );
  check(
    "cafes is leaf",
    tree.some((n) => n.name === "Cafes" && n.subcategories.length === 0),
  );
  const block = formatCategoryTaxonomyForPrompt(categories);
  check("prompt lists Salon", block.includes("Salon"));
  check("prompt marks NONE for leaf", block.includes("Subcategories: NONE"));
  const prompt = buildQuickOnboardPrompt(categories);
  check("prompt embeds taxonomy", prompt.includes("ALLOWED FINDERB TAXONOMY"));
  check("prompt requires subcategory key", prompt.includes('"subcategory"'));
  check("prompt includes Spa", prompt.includes("Spa"));
}

console.log("\ncategory resolve");
{
  const r = resolveCategoryLabel("Cafes", categories, "");
  check("exact leaf category match", r.matched && r.label === "Cafes", r);
}
{
  const r = resolveCategoryLabel("Restaurants", categories, "Fine Dining");
  check(
    "parent + subcategory exact",
    r.matched && r.label === "Restaurants › Fine Dining",
    r,
  );
}
{
  const r = resolveCategoryLabel("restaurants", categories, "fine dining");
  check(
    "case-insensitive parent + sub",
    r.matched && r.label === "Restaurants › Fine Dining",
    r,
  );
}
{
  const r = resolveCategoryLabel("fine dining", categories);
  check(
    "subcategory-only becomes Parent › Child",
    r.matched && r.label === "Restaurants › Fine Dining",
    r,
  );
}
{
  const r = resolveCategoryLabel("Beauty & Wellness", categories, "Salon");
  check(
    "beauty + salon",
    r.matched && r.label === "Beauty & Wellness › Salon",
    r,
  );
}
{
  const r = resolveCategoryLabel("Restaurants", categories, "");
  check(
    "parent with children but no sub unmatched",
    !r.matched,
    r,
  );
}
{
  const r = resolveCategoryLabel("Spaceships", categories);
  check("unknown category unmatched", !r.matched);
}
{
  const r = resolveCategoryLabel("Beauty & Wellness", categories, "Gym");
  check("wrong subcategory under parent unmatched", !r.matched, r);
}

console.log("\ndraft + validate");
{
  const parsed = parseQuickOnboardPayload(JSON.stringify(goodPayload));
  check("parsed ok for draft", parsed.ok === true && Boolean(parsed.fields));
  if (parsed.ok && parsed.fields) {
    const draft = draftFromAiFields(parsed.fields, categories);
    check("category matched on draft", draft.categoryMatched === true);
    check(
      "resolved Parent › Child",
      draft.resolvedCategory === "Restaurants › Fine Dining",
      draft.resolvedCategory,
    );
    const v = validateQuickOnboardDraft(draft, "Finderb@1234");
    check("draft validates", v.ok === true, v);
    const payload = toRegistrationPayload(draft, "Finderb@1234");
    check(
      "payload category set",
      payload.category === "Restaurants › Fine Dining",
    );
  }
}
{
  const parsed = parseQuickOnboardPayload(
    JSON.stringify({
      ...goodPayload,
      category: "Unknown Biz Type",
      subcategory: "",
    }),
  );
  if (parsed.fields) {
    const draft = draftFromAiFields(parsed.fields, categories);
    check("unmatched category blocks create", draft.categoryMatched === false);
    const v = validateQuickOnboardDraft(draft, "Finderb@1234");
    check("validate fails without taxonomy pick", v.ok === false, v);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
