import {
  extractIndianMobileDigits,
  indianMobileValidationError,
  normalizeIndianPhoneForStorage,
} from "./indianPhone";
import {
  MIN_ADDRESS_LINE1_LENGTH,
  MIN_NAME_LENGTH,
  REGISTRATION_EMAIL_REGEX,
  validateAndNormalizeMerchantRegistration,
  type MerchantRegistrationPayload,
} from "./merchantRegistration";
import type { WeekTimings } from "./googleBusinessLink";
import { normalizeWeekTimings } from "./workingHours";
import { DEFAULT_ONBOARDING_PAYMENT_MODES } from "./paymentModes";

/** Strict schema keys the AI must return. */
export type QuickOnboardAiFields = {
  ownerFullName: string;
  loginEmail: string;
  emailUnavailable: boolean;
  mobile: string;
  businessName: string;
  displayName: string;
  /** Exact top-level FinderB category name from the allowed list. */
  category: string;
  /** Exact subcategory name when the parent has children; otherwise "". */
  subcategory: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  publicPhone: string;
  activateImmediately: boolean;
  notes: string;
  /** Optional profile enrichment (Google link / AI). */
  about: string;
  website: string;
  mapsUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  photos: string[];
  timings: WeekTimings | null;
};

export type QuickOnboardDraft = QuickOnboardAiFields & {
  /** Resolved category label ready for register API (may include parent › child). */
  resolvedCategory: string;
  categoryMatched: boolean;
  /** Editable on the review form; not inferred from Google/AI. */
  paymentModes: string[];
};

export type QuickOnboardParseResult =
  | {
      ok: true;
      fields: QuickOnboardAiFields;
      missing: string[];
      errors: string[];
      message?: string;
    }
  | {
      ok: false;
      fields: QuickOnboardAiFields | null;
      missing: string[];
      errors: string[];
      message: string;
    };

const EMPTY_FIELDS: QuickOnboardAiFields = {
  ownerFullName: "",
  loginEmail: "",
  emailUnavailable: false,
  mobile: "",
  businessName: "",
  displayName: "",
  category: "",
  subcategory: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "India",
  publicPhone: "",
  activateImmediately: false,
  notes: "",
  about: "",
  website: "",
  mapsUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  youtubeUrl: "",
  latitude: null,
  longitude: null,
  rating: null,
  photos: [],
  timings: null,
};

export type CategoryOption = {
  id: string;
  name: string;
  parent_id?: string | null;
};

export type CategoryTaxonomyNode = {
  name: string;
  subcategories: string[];
};

/** Build parent → subcategory tree from live FinderB categories. */
export function buildCategoryTaxonomy(
  categories: CategoryOption[],
): CategoryTaxonomyNode[] {
  const parents = categories
    .filter((c) => !c.parent_id)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return parents.map((parent) => ({
    name: parent.name,
    subcategories: categories
      .filter((c) => c.parent_id === parent.id)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.name),
  }));
}

/** Human-readable taxonomy block embedded in the AI prompt. */
export function formatCategoryTaxonomyForPrompt(
  categories: CategoryOption[],
): string {
  const tree = buildCategoryTaxonomy(categories);
  if (tree.length === 0) {
    return "(No categories loaded — leave category and subcategory empty.)";
  }

  return tree
    .map((node, index) => {
      const n = index + 1;
      if (node.subcategories.length === 0) {
        return `${n}. ${node.name}\n   - Subcategories: NONE — set "subcategory" to ""`;
      }
      const kids = node.subcategories.map((s) => `     • ${s}`).join("\n");
      return `${n}. ${node.name}\n   - Subcategories (pick EXACTLY one):\n${kids}`;
    })
    .join("\n\n");
}

/**
 * Build the copyable AI prompt with the live category/subcategory list.
 * Names must be copied character-for-character from the taxonomy block.
 */
export function buildQuickOnboardPrompt(
  categories: CategoryOption[] = [],
): string {
  const taxonomy = formatCategoryTaxonomyForPrompt(categories);

  return `You are a careful data clerk converting Google Business Profile (or similar listing) text into a FinderB merchant registration JSON payload.

TASK
1. Read ONLY the business details the user pastes after this prompt (name, address, phone, hours, Google category, website, etc.).
2. Fill every JSON key below using facts from that text — never invent missing facts.
3. Choose category + subcategory ONLY from the ALLOWED FINDERB TAXONOMY below (copy names EXACTLY, character-for-character, including punctuation & spacing).
4. Reply with NOTHING except one fenced JSON code block (no commentary, no markdown tables, no bullet lists outside the fence).

ALLOWED FINDERB TAXONOMY (authoritative — do not invent names outside this list):
${taxonomy}

CATEGORY SELECTION RULES (critical — follow in order)
1. Infer the business type from the pasted text (Google category, business name, services, hours).
2. Pick the single best PARENT from the taxonomy above → put its EXACT name in "category".
3. If that parent lists subcategories:
   - You MUST pick the single best subcategory from THAT parent's list only.
   - Put its EXACT name in "subcategory".
   - Never leave subcategory empty when the parent has children.
   - Never pick a subcategory that belongs to a different parent.
4. If that parent says Subcategories: NONE → set "subcategory" to "".
5. Prefer the most specific match. Examples of reasoning (adapt to the live list above):
   - "Restaurant", "North Indian restaurant", "Pizza place" → Food/Dining parent + closest food subcategory if present.
   - "Cafe", "Coffee shop" → cafe-related subcategory if present.
   - "Beauty salon", "Hair salon", "Spa" → beauty/salon parent + matching subcategory.
   - "Real estate agent", "Property dealer" → real-estate parent + matching subcategory.
   - "Tour operator", "Travel agency" → travel parent + matching subcategory.
6. If nothing fits confidently, leave both "category" and "subcategory" as "" (do NOT guess a close-but-wrong label).
7. Do NOT output "Parent › Child" in either field — use the two separate keys only.
8. Do NOT invent GST, PAN, CIN, emails, phones, or addresses.

OUTPUT FORMAT (exact keys — do not rename, add, or remove keys):

\`\`\`json
{
  "ownerFullName": "",
  "loginEmail": "",
  "emailUnavailable": false,
  "mobile": "",
  "businessName": "",
  "displayName": "",
  "category": "",
  "subcategory": "",
  "addressLine1": "",
  "addressLine2": "",
  "city": "",
  "state": "",
  "country": "India",
  "publicPhone": "",
  "activateImmediately": false,
  "notes": ""
}
\`\`\`

FIELD RULES
- businessName: legal / primary business name (required).
- displayName: public-facing name if different; otherwise same as businessName.
- ownerFullName: real owner / contact person only if clearly present in the text. If unknown, use "" — never invent and never copy businessName.
- loginEmail: real business/owner email only if clearly present. NEVER invent Gmail/Yahoo/etc.
- emailUnavailable: true when no real email exists; then loginEmail must be "".
- mobile: primary Indian mobile as 10 digits only (no +91 / spaces / dashes). Strip country code if present.
- publicPhone: listing/display phone as 10 digits; if missing, copy mobile.
- addressLine1: street / building / area (at least a short street line).
- addressLine2: landmark or floor if present, else "".
- city / state: Indian city and state names (expand abbreviations when obvious, e.g. "DL" → "Delhi", "MH" → "Maharashtra").
- country: default "India" unless the text clearly says otherwise.
- category: EXACT parent name from ALLOWED FINDERB TAXONOMY (or "" if unsure).
- subcategory: EXACT child name under that parent when children exist; otherwise "".
- activateImmediately: false unless the user explicitly asks to go live now.
- notes: short free-text leftovers (hours, website, rating) — optional; use "" if none.

HARD CONSTRAINTS
- Never invent phone numbers, emails, addresses, or IDs.
- Never output anything except the single JSON fence.
- If a required fact is missing, leave that string empty (or set emailUnavailable) rather than guessing.
- Category/subcategory names must match the taxonomy EXACTLY (same spelling, casing, symbols).

Paste the Google Business Profile text below this line:
---
`;
}

/** Fallback static prompt when categories are not yet loaded. */
export const QUICK_ONBOARD_PROMPT = buildQuickOnboardPrompt([]);

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1";
  }
  return false;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);
}

function asTimings(value: unknown): WeekTimings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return normalizeWeekTimings(value);
}

function digitsPhone(value: string): string {
  return extractIndianMobileDigits(value);
}

/** Extract the first JSON object from fenced or bare text. */
export function extractJsonObjectText(raw: string): string | null {
  const text = (raw || "").trim();
  if (!text) return null;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    if (inner.startsWith("{")) return inner;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return null;
}

function coerceFields(parsed: Record<string, unknown>): QuickOnboardAiFields {
  const businessName = asString(parsed.businessName);
  const mobile = digitsPhone(asString(parsed.mobile));
  const publicRaw = asString(parsed.publicPhone);
  const publicPhone = digitsPhone(publicRaw) || mobile;
  let loginEmail = asString(parsed.loginEmail).toLowerCase();
  let emailUnavailable = asBoolean(parsed.emailUnavailable);

  if (!loginEmail) {
    emailUnavailable = true;
  } else if (emailUnavailable) {
    loginEmail = "";
  }

  const ownerFullName = asString(parsed.ownerFullName);

  // Support legacy "Parent › Child" / "Parent > Child" in category alone.
  let category = asString(parsed.category);
  let subcategory = asString(parsed.subcategory);
  const combined = category.match(/^(.+?)\s*[›>]\s*(.+)$/);
  if (combined && !subcategory) {
    category = combined[1].trim();
    subcategory = combined[2].trim();
  }

  return {
    ownerFullName,
    loginEmail,
    emailUnavailable,
    mobile,
    businessName,
    displayName: asString(parsed.displayName) || businessName,
    category,
    subcategory,
    addressLine1: asString(parsed.addressLine1),
    addressLine2: asString(parsed.addressLine2),
    city: asString(parsed.city),
    state: asString(parsed.state),
    country: asString(parsed.country) || "India",
    publicPhone,
    activateImmediately: asBoolean(parsed.activateImmediately),
    notes: asString(parsed.notes),
    about: asString(parsed.about),
    website: asString(parsed.website),
    mapsUrl: asString(parsed.mapsUrl),
    facebookUrl: asString(parsed.facebookUrl),
    instagramUrl: asString(parsed.instagramUrl),
    youtubeUrl: asString(parsed.youtubeUrl),
    latitude: asNullableNumber(parsed.latitude),
    longitude: asNullableNumber(parsed.longitude),
    rating: asNullableNumber(parsed.rating),
    photos: asStringArray(parsed.photos),
    timings: asTimings(parsed.timings),
  };
}

function collectFieldIssues(fields: QuickOnboardAiFields): {
  missing: string[];
  errors: string[];
} {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!fields.businessName || fields.businessName.length < MIN_NAME_LENGTH) {
    missing.push("businessName");
  }
  // ownerFullName is optional — fill later on the merchant profile if unknown.
  if (
    !fields.addressLine1 ||
    fields.addressLine1.length < MIN_ADDRESS_LINE1_LENGTH
  ) {
    missing.push("addressLine1");
  }
  if (!fields.city) missing.push("city");
  if (!fields.state) missing.push("state");
  if (!fields.category) missing.push("category");
  if (!fields.mobile) missing.push("mobile");
  if (!fields.publicPhone) missing.push("publicPhone");

  if (!fields.emailUnavailable) {
    if (!fields.loginEmail) {
      missing.push("loginEmail");
    } else if (!REGISTRATION_EMAIL_REGEX.test(fields.loginEmail)) {
      errors.push("loginEmail is not a valid email address.");
    }
  }

  const mobileError = indianMobileValidationError(fields.mobile, {
    label: "mobile number",
  });
  if (fields.mobile && mobileError) errors.push(mobileError);

  const publicError = indianMobileValidationError(fields.publicPhone, {
    label: "display phone number",
    allowLandline: true,
  });
  if (fields.publicPhone && publicError) errors.push(publicError);

  return { missing, errors };
}

/**
 * Strict JSON-only parser. Rejects freeform Google Business paste.
 */
export function parseQuickOnboardPayload(raw: string): QuickOnboardParseResult {
  const text = (raw || "").trim();
  if (!text) {
    return {
      ok: false,
      fields: null,
      missing: [],
      errors: [],
      message: "Paste the AI JSON block, not the raw Google text.",
    };
  }

  const jsonText = extractJsonObjectText(text);
  if (!jsonText) {
    return {
      ok: false,
      fields: null,
      missing: [],
      errors: [],
      message:
        "Paste the AI JSON block, not the raw Google text. Copy the prompt, paste merchant details into any AI, then paste only the JSON reply here.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      fields: null,
      missing: [],
      errors: [],
      message:
        "JSON is invalid. Ask the AI to reply again with only the fenced JSON object.",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      fields: null,
      missing: [],
      errors: [],
      message: "Expected a JSON object with FinderB registration keys.",
    };
  }

  const fields = coerceFields(parsed as Record<string, unknown>);
  const { missing, errors } = collectFieldIssues(fields);
  const ok = missing.length === 0 && errors.length === 0;

  if (!ok) {
    return {
      ok: false,
      fields,
      missing,
      errors,
      message:
        missing.length > 0
          ? `Missing required fields: ${missing.join(", ")}.`
          : errors[0] || "Fix the highlighted fields before creating.",
    };
  }

  return { ok: true, fields, missing: [], errors: [] };
}

export function resolveCategoryLabel(
  aiCategory: string,
  categories: CategoryOption[],
  aiSubcategory = "",
): { label: string; matched: boolean; categoryId: string | null } {
  const rawCategory = aiCategory.trim();
  let categoryNeedle = rawCategory;
  let subcategoryNeedle = aiSubcategory.trim();

  // Legacy combined "Parent › Child" in the category field.
  const combined = categoryNeedle.match(/^(.+?)\s*[›>]\s*(.+)$/);
  if (combined && !subcategoryNeedle) {
    categoryNeedle = combined[1].trim();
    subcategoryNeedle = combined[2].trim();
  }

  if ((!categoryNeedle && !subcategoryNeedle) || categories.length === 0) {
    return {
      label: [rawCategory, aiSubcategory.trim()].filter(Boolean).join(" › "),
      matched: false,
      categoryId: null,
    };
  }

  const byId = new Map(categories.map((c) => [c.id, c]));
  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const exactCi = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

  const fuzzyScore = (name: string, needle: string) => {
    const n = name.toLowerCase().trim();
    const q = needle.toLowerCase().trim();
    if (!q || !n) return 0;
    if (n === q) return 100;
    // Avoid weak substring traps (e.g. "Spa" ⊂ "Spaceships")
    const shorter = n.length <= q.length ? n : q;
    const longer = n.length <= q.length ? q : n;
    if (shorter.length < 4) return 0;
    if (
      longer.includes(shorter) &&
      shorter.length / longer.length >= 0.45
    ) {
      return 60;
    }
    // Whole-word overlap for multi-word labels
    const nWords = new Set(n.split(/[^a-z0-9&]+/).filter((w) => w.length >= 3));
    const qWords = q.split(/[^a-z0-9&]+/).filter((w) => w.length >= 3);
    if (qWords.length > 0 && qWords.every((w) => nWords.has(w))) return 70;
    return 0;
  };

  // 1) Exact parent + exact subcategory under that parent
  if (categoryNeedle) {
    const parent = parents.find((p) => exactCi(p.name, categoryNeedle));
    if (parent) {
      const kids = childrenOf(parent.id);
      if (kids.length === 0) {
        if (!subcategoryNeedle) {
          return { label: parent.name, matched: true, categoryId: parent.id };
        }
        // Parent is a leaf but AI sent a subcategory — treat as unmatched unless
        // subcategory equals parent (ignore noise).
        if (exactCi(parent.name, subcategoryNeedle)) {
          return { label: parent.name, matched: true, categoryId: parent.id };
        }
      } else if (subcategoryNeedle) {
        const childExact = kids.find((c) =>
          exactCi(c.name, subcategoryNeedle),
        );
        if (childExact) {
          return {
            label: `${parent.name} › ${childExact.name}`,
            matched: true,
            categoryId: childExact.id,
          };
        }
        // Fuzzy subcategory under the chosen parent only
        let bestChild: CategoryOption | null = null;
        let best = 0;
        for (const child of kids) {
          const s = fuzzyScore(child.name, subcategoryNeedle);
          if (s > best) {
            best = s;
            bestChild = child;
          }
        }
        if (bestChild && best >= 60) {
          return {
            label: `${parent.name} › ${bestChild.name}`,
            matched: true,
            categoryId: bestChild.id,
          };
        }
      } else {
        // Parent has children but no subcategory — not a valid leaf pick
        return {
          label: parent.name,
          matched: false,
          categoryId: null,
        };
      }
    }
  }

  // 2) Subcategory-only / category-is-actually-a-child exact match
  const childQuery = subcategoryNeedle || categoryNeedle;
  if (childQuery) {
    const exactChild = categories.find(
      (c) => c.parent_id && exactCi(c.name, childQuery),
    );
    if (exactChild) {
      const parent = byId.get(exactChild.parent_id!);
      return {
        label: parent
          ? `${parent.name} › ${exactChild.name}`
          : exactChild.name,
        matched: true,
        categoryId: exactChild.id,
      };
    }
  }

  // 3) Fuzzy fallback across all nodes (prefer children when scores tie)
  let best: CategoryOption | null = null;
  let bestScore = 0;
  for (const cat of categories) {
    let s = 0;
    if (subcategoryNeedle && cat.parent_id) {
      s = Math.max(s, fuzzyScore(cat.name, subcategoryNeedle));
    }
    if (categoryNeedle) {
      s = Math.max(s, fuzzyScore(cat.name, categoryNeedle));
    }
    // Prefer child matches slightly when scores equal
    if (cat.parent_id && s > 0) s += 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = cat;
    }
  }

  if (!best || bestScore < 60) {
    const label = subcategoryNeedle
      ? `${categoryNeedle || rawCategory} › ${subcategoryNeedle}`
      : categoryNeedle || rawCategory;
    return { label, matched: false, categoryId: null };
  }

  if (best.parent_id) {
    const parent = byId.get(best.parent_id);
    // If parent has children, matching the parent alone is not enough
    if (!parent) {
      return { label: best.name, matched: true, categoryId: best.id };
    }
    return {
      label: `${parent.name} › ${best.name}`,
      matched: true,
      categoryId: best.id,
    };
  }

  const kids = childrenOf(best.id);
  if (kids.length > 0) {
    return { label: best.name, matched: false, categoryId: null };
  }

  return { label: best.name, matched: true, categoryId: best.id };
}

export function draftFromAiFields(
  fields: QuickOnboardAiFields,
  categories: CategoryOption[],
): QuickOnboardDraft {
  const resolved = resolveCategoryLabel(
    fields.category,
    categories,
    fields.subcategory,
  );
  const fallbackLabel = fields.subcategory
    ? `${fields.category} › ${fields.subcategory}`
    : fields.category;
  return {
    ...fields,
    resolvedCategory: resolved.matched ? resolved.label : fallbackLabel,
    categoryMatched: resolved.matched,
    paymentModes: [...DEFAULT_ONBOARDING_PAYMENT_MODES],
  };
}

/** Build register API payload from an editable draft + password. */
export function toRegistrationPayload(
  draft: QuickOnboardDraft,
  password: string,
): MerchantRegistrationPayload {
  return {
    fullName: draft.ownerFullName,
    email: draft.emailUnavailable ? "" : draft.loginEmail,
    emailUnavailable: draft.emailUnavailable,
    password,
    mobile: draft.mobile,
    businessName: draft.businessName,
    displayName: draft.displayName || draft.businessName,
    category: draft.resolvedCategory || draft.category,
    city: draft.city,
    state: draft.state,
    country: draft.country || "India",
    publicPhone: draft.publicPhone || draft.mobile,
    addressLine1: draft.addressLine1,
    addressLine2: draft.addressLine2 || undefined,
    selectedPlan: "free",
    billingCycle: "monthly",
    activateImmediately: draft.activateImmediately,
    about: draft.about || undefined,
    website: draft.website || undefined,
    mapsUrl: draft.mapsUrl || undefined,
    facebookUrl: draft.facebookUrl || undefined,
    instagramUrl: draft.instagramUrl || undefined,
    youtubeUrl: draft.youtubeUrl || undefined,
    latitude: draft.latitude ?? undefined,
    longitude: draft.longitude ?? undefined,
    // Google Places score — stored as googleRating, not FinderB rating.
    googleRating: draft.rating ?? undefined,
    photos: draft.photos?.length ? draft.photos : undefined,
    timings: draft.timings || undefined,
    paymentModes: draft.paymentModes,
  };
}

export function validateQuickOnboardDraft(
  draft: QuickOnboardDraft,
  password: string,
): { ok: true } | { ok: false; error: string } {
  if (!draft.categoryMatched || !draft.resolvedCategory.trim()) {
    return {
      ok: false,
      error:
        "Pick a category from the list — the AI category must match FinderB taxonomy.",
    };
  }

  const payload = toRegistrationPayload(draft, password);
  const result = validateAndNormalizeMerchantRegistration(payload);
  if (!result.ok) return result;
  return { ok: true };
}

export function normalizeDraftPhones(
  draft: QuickOnboardDraft,
): QuickOnboardDraft {
  return {
    ...draft,
    mobile:
      normalizeIndianPhoneForStorage(draft.mobile) || digitsPhone(draft.mobile),
    publicPhone:
      normalizeIndianPhoneForStorage(draft.publicPhone) ||
      digitsPhone(draft.publicPhone) ||
      digitsPhone(draft.mobile),
  };
}

export { EMPTY_FIELDS };
