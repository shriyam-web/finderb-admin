-- Ensure Business.images never rejects empty galleries during onboarding.
-- Admin registration forms do not require image upload at create time.
ALTER TABLE public."Business"
  ALTER COLUMN "images" SET DEFAULT '{}'::text[];

UPDATE public."Business"
SET "images" = '{}'::text[]
WHERE "images" IS NULL;

ALTER TABLE public."Business"
  ALTER COLUMN "images" SET NOT NULL;

-- Changelog entry for admins.
INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Registration works without gallery images',
  'Business Onboarding and Quick Onboard no longer fail when no photos are uploaded. New merchants are created with an empty image gallery, and photos can be added later from the merchant profile.',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Registration works without gallery images'
);
