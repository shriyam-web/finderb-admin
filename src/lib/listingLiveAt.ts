import { createClient } from "../../utils/supabase/client";

/** First time a listing becomes Active. Ignores a missing column so approval still works. */
export async function stampListingLiveAt(businessId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("Business")
    .update({ listingLiveAt: new Date().toISOString() })
    .eq("id", businessId)
    .is("listingLiveAt", null);
  if (error && !/listingLiveAt/i.test(error.message || "")) {
    console.warn("listingLiveAt", error.message);
  }
}
