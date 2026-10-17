export type SearchDoc = {
  key: string;
  kind: string;
  focusKind: string;
  tab: string;
  title: string;
  subtitle: string;
  targetId: string | null;
  titleFold: string;
  hayFold: string;
  titleTokens: string[];
  hayTokens: string[];
  digits: string;
};

export type SearchHit = {
  key: string;
  kind: string;
  focusKind: string;
  tab: string;
  title: string;
  subtitle: string;
  targetId: string | null;
  score: number;
};

const TAB_ALIASES: Record<string, string[]> = {
  Dashboard: ["home", "overview", "stats", "console"],
  Users: ["user", "users", "customer", "customers", "account", "accounts"],
  Merchants: ["merchant", "merchants", "business", "businesses", "listing", "listings", "partner", "partners"],
  "Business Onboarding": ["onboarding", "merchant form", "register business"],
  "Quick Onboard": ["quick onboard", "maps link", "google maps"],
  Leads: ["lead", "leads", "enquiry", "enquiries", "inquiry", "inquiries"],
  Reviews: ["review", "reviews", "rating", "ratings"],
  "Change Requests": ["change request", "change requests", "profile edit", "listing edit"],
  "Ownership Requests": ["ownership", "claim business", "transfer ownership"],
  "Merchant Support Login": ["support login", "impersonate", "login as merchant"],
  "Payments & Subscriptions": ["payment", "payments", "revenue", "subscription", "subscriptions", "razorpay", "billing", "invoice"],
  "FinderB Jobs": ["job", "jobs", "hiring", "vacancy", "vacancies"],
  "Job Reports": ["job report", "job reports", "flagged job", "takedown"],
  Categories: ["category", "categories"],
  Blogs: ["blog", "blogs", "article", "articles", "post"],
  "YouTube Playlists": ["youtube", "playlist", "playlists", "video", "videos", "tutorial", "tutorials"],
  "Tourist Places": ["tourist", "place", "places", "destination", "destinations"],
  Broadcasts: ["broadcast", "broadcasts", "notification", "notifications", "push"],
  "Broadcast Email": ["email", "emails", "mail", "resend"],
  Settings: ["settings", "setting", "maintenance", "site mode"],
  "Manage Admins": ["admin", "admins", "controller", "developer", "staff"],
  News: ["news"],
  Movies: ["movie", "movies", "film", "films"],
  "FinderB E-commerce": ["ecommerce", "e-commerce", "shop", "store"],
};

export function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9@.+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

export function clipText(value: string | null | undefined, max = 160): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function makeSearchDoc(input: {
  key: string;
  kind: string;
  focusKind?: string;
  tab: string;
  title: string;
  subtitle?: string;
  targetId?: string | null;
  extra?: Array<string | null | undefined>;
}): SearchDoc {
  const title = input.title.trim() || "Untitled";
  const extra = (input.extra || []).filter((part): part is string => Boolean(part && String(part).trim()));
  const hay = [title, input.subtitle || "", ...extra].join(" ");
  const titleFold = foldText(title);
  const hayFold = foldText(hay);
  return {
    key: input.key,
    kind: input.kind,
    focusKind: input.focusKind || input.kind.toLowerCase(),
    tab: input.tab,
    title,
    subtitle: input.subtitle || "",
    targetId: input.targetId ?? null,
    titleFold,
    hayFold,
    titleTokens: uniqueTokens(titleFold),
    hayTokens: uniqueTokens(hayFold).slice(0, 80),
    digits: digitsOf(hay),
  };
}

export function tabSearchDoc(name: string): SearchDoc {
  return makeSearchDoc({
    key: `tab:${name}`,
    kind: "Menu",
    focusKind: "tab",
    tab: name,
    title: name,
    subtitle: "Open this tab",
    extra: TAB_ALIASES[name] || [],
  });
}

function uniqueTokens(folded: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of folded.split(" ")) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    let rowMin = next[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (next[j] < rowMin) rowMin = next[j];
    }
    if (rowMin > 2) return 3;
    for (let j = 0; j <= b.length; j += 1) prev[j] = next[j];
  }
  return prev[b.length];
}

function tokenScore(queryToken: string, tokens: string[]): number {
  let best = 0;
  for (const token of tokens) {
    if (token === queryToken) return 100;
    if (token.startsWith(queryToken) || queryToken.startsWith(token)) {
      best = Math.max(best, queryToken.length >= 2 ? 82 : 50);
      continue;
    }
    if (queryToken.length >= 3 && (token.includes(queryToken) || queryToken.includes(token))) {
      best = Math.max(best, 64);
      continue;
    }
    if (queryToken.length >= 4 && token.length >= 4) {
      const limit = queryToken.length >= 8 ? 2 : 1;
      const distance = levenshtein(queryToken, token);
      if (distance <= limit) best = Math.max(best, 48 - distance * 10);
    }
  }
  return best;
}

export function searchDocs(docs: SearchDoc[], rawQuery: string, limit = 12): SearchHit[] {
  const query = foldText(rawQuery);
  if (query.length < 1) return [];
  const tokens = query.split(" ").filter(Boolean);
  const digitQuery = digitsOf(rawQuery);
  const hits: SearchHit[] = [];

  for (const doc of docs) {
    let score = 0;
    if (doc.titleFold === query) score += 520;
    else if (doc.titleFold.startsWith(query)) score += 340;
    else if (doc.titleFold.includes(query)) score += 250;
    else if (doc.hayFold.includes(query)) score += 170;

    if (digitQuery.length >= 4 && doc.digits.includes(digitQuery)) {
      score += digitQuery.length >= 8 ? 280 : 180;
    }

    let missed = false;
    for (const token of tokens) {
      const numeric = /^\d+$/.test(token);
      if (numeric && digitQuery.length >= 4 && doc.digits.includes(token)) {
        score += 90;
        continue;
      }
      const onTitle = tokenScore(token, doc.titleTokens);
      const onHay = onTitle >= 90 ? onTitle : tokenScore(token, doc.hayTokens);
      const best = Math.max(onTitle, onHay);
      if (best <= 0) {
        missed = true;
        break;
      }
      score += onTitle > 0 ? onTitle * 2 : onHay;
    }
    if (missed) continue;
    if (score <= 0) continue;
    if (doc.kind === "Menu") score += 24;
    hits.push({
      key: doc.key,
      kind: doc.kind,
      focusKind: doc.focusKind,
      tab: doc.tab,
      title: doc.title,
      subtitle: doc.subtitle,
      targetId: doc.targetId,
      score,
    });
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const seen = new Set<string>();
  const unique: SearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);
    unique.push(hit);
    if (unique.length >= limit) break;
  }
  return unique;
}
