export const SNOOZE_REASONS = [
  "Registration is from outside India",
  "City is outside the areas we cover",
  "Category is not a priority right now",
  "Details look incomplete, keep it for later",
  "Possible duplicate, check later",
];

export const REJECT_REASONS = [
  "Not a genuine business",
  "Duplicate registration",
  "Incomplete or invalid details",
  "Category is not allowed",
  "Spam or test registration",
];

export function isListingIgnored(status: string | null | undefined) {
  return (status || "").toLowerCase() === "ignored";
}

type ListingTable = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export async function saveListingDecision(
  db: ListingTable,
  input: {
    id: string;
    mode: "snooze" | "reject" | "activate";
    reason?: string;
  },
) {
  const now = new Date().toISOString();
  const status =
    input.mode === "snooze"
      ? "Ignored"
      : input.mode === "reject"
        ? "Rejected"
        : "Active";
  const reason =
    input.mode === "activate" ? null : (input.reason || "").trim() || null;
  const { error } = await db
    .from("Business")
    .update({
      status,
      listingHoldReason: reason,
      listingHoldAt: input.mode === "activate" ? null : now,
      updatedAt: now,
    })
    .eq("id", input.id);
  return {
    error,
    status,
    reason,
    at: input.mode === "activate" ? null : now,
  };
}
