export type RecipientKind =
  | "all-users"
  | "all-businesses"
  | "all-both"
  | "one-user"
  | "one-business"
  | "addresses"
  | "unknown";

export const RECIPIENT_FILTERS: { id: "all" | RecipientKind; label: string }[] = [
  { id: "all", label: "All recipients" },
  { id: "all-both", label: "All users and businesses" },
  { id: "all-users", label: "All users" },
  { id: "all-businesses", label: "All businesses" },
  { id: "one-user", label: "One user" },
  { id: "one-business", label: "One business" },
  { id: "addresses", label: "Specific emails" },
];

const KIND_ORDER: RecipientKind[] = [
  "all-both",
  "all-users",
  "all-businesses",
  "one-user",
  "one-business",
  "addresses",
  "unknown",
];

function audienceValues(audience: unknown): string[] {
  if (!Array.isArray(audience)) return [];
  return audience.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
}

export function notificationRecipient(row: {
  target_audience?: string[] | null;
  target_user_id?: string | null;
  target_business_id?: string | null;
  target_label?: string | null;
}): { kind: RecipientKind; label: string } {
  const audience = audienceValues(row.target_audience);
  const name = String(row.target_label || "").trim();
  const oneUser = Boolean(row.target_user_id) || audience.includes("direct-user");
  const oneBusiness = Boolean(row.target_business_id) || audience.includes("direct-business");

  if (oneUser && !oneBusiness) {
    return { kind: "one-user", label: name ? `One user · ${name}` : "One user" };
  }
  if (oneBusiness && !oneUser) {
    return { kind: "one-business", label: name ? `One business · ${name}` : "One business" };
  }

  const users = audience.some((value) => value === "users" || value === "all");
  const businesses = audience.some(
    (value) => value === "merchants" || value === "businesses" || value === "all",
  );
  if (users && businesses) {
    return { kind: "all-both", label: "All users and all businesses" };
  }
  if (users) return { kind: "all-users", label: "All users" };
  if (businesses) return { kind: "all-businesses", label: "All businesses" };
  return { kind: "unknown", label: name || "Recipient not recorded" };
}

export function emailRecipient(input: {
  to?: string[];
  cc?: string[];
  bcc?: string[];
}): { kind: RecipientKind; label: string } {
  const parts: string[] = [];
  if (input.to?.length) parts.push(`To ${input.to.join(", ")}`);
  if (input.cc?.length) parts.push(`Cc ${input.cc.join(", ")}`);
  if (input.bcc?.length) parts.push(`Bcc ${input.bcc.join(", ")}`);
  return {
    kind: "addresses",
    label: parts.join(" · ") || "Specific emails",
  };
}

export function matchesRecipientFilter(kind: RecipientKind, filter: string): boolean {
  return !filter || filter === "all" || filter === kind;
}

export function compareRecipientHistory(
  a: { kind: RecipientKind; at: string },
  b: { kind: RecipientKind; at: string },
  mode: "newest" | "recipient",
): number {
  if (mode === "recipient") {
    const delta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (delta) return delta;
  }
  return new Date(b.at).getTime() - new Date(a.at).getTime();
}
