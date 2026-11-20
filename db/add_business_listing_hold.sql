-- Reason kept when a listing registration is snoozed or rejected.
-- Ignored rows stay off the public site, the to-do list, and the sidebar count.
-- Safe to re-run.

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "listingHoldReason" text;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "listingHoldAt" timestamptz;

NOTIFY pgrst, 'reload schema';
