import type { SupabaseClient } from "@supabase/supabase-js";

/** Rows that point at a business and are not set to remove themselves. */
const CHILD_TABLES = [
  "job_applications",
  "jobs",
  "job_reports",
  "leads",
  "ownership_requests",
  "business_change_requests",
  "review_moderation",
  "review_reports",
  "merchant_notifications",
  "tourist_place_merchants",
  "business_team_members",
  "business_user_links",
  "profile_views",
  "user_push_tokens",
  "promotion_audit",
  "promotion_orders",
  "promotion_custom_requests",
  "business_verifications",
  "merchant_payments",
  "support_login_tokens",
] as const;

function ignorable(message: string) {
  return /does not exist|schema cache|could not find the table|column .* does not exist|invalid input syntax/i.test(
    message,
  );
}

async function dropChildRows(supabase: SupabaseClient, table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("business_id", id);
  if (error && !ignorable(error.message)) return error.message;
  return null;
}

/** Deletes the listing after the rows that reference it, so the database can accept the delete. */
export async function deleteMerchantProfile(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  for (const slot of [1, 2, 3, 4, 5]) {
    const column = `position_${slot}_business_id`;
    const { error } = await supabase.from("categories").update({ [column]: null }).eq(column, id);
    if (error && !ignorable(error.message)) return { error: error.message };
  }

  for (const table of CHILD_TABLES) {
    const error = await dropChildRows(supabase, table, id);
    if (error) return { error };
  }

  const { error } = await supabase.from("Business").delete().eq("id", id);
  return { error: error?.message ?? null };
}
