-- Google Places star rating, stored separately from FinderB platform rating.
ALTER TABLE public."Business"
ADD COLUMN IF NOT EXISTS "googleRating" numeric(3, 1);

COMMENT ON COLUMN public."Business"."googleRating" IS
  'Google Business / Places star rating (1.0–5.0), imported from Maps — not FinderB reviews.';
