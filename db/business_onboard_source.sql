-- Who created the listing.
-- 'self'  = the merchant signed up on FinderB
-- 'admin' = someone created the profile from the admin panel
-- Older rows stay null. New signups write the value.
-- Safe to re-run.

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "onboardSource" text;

ALTER TABLE "Business" DROP CONSTRAINT IF EXISTS "Business_onboardSource_check";
ALTER TABLE "Business"
  ADD CONSTRAINT "Business_onboardSource_check"
  CHECK ("onboardSource" IS NULL OR "onboardSource" IN ('self', 'admin'));
