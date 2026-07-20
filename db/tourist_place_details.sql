-- Richer tourist place fields + tagged tour/travel merchants.
-- Run in Supabase SQL editor after deploying application code.

ALTER TABLE tourist_places
  ADD COLUMN IF NOT EXISTS best_time TEXT,
  ADD COLUMN IF NOT EXISTS visit_duration TEXT,
  ADD COLUMN IF NOT EXISTS entry_fee TEXT,
  ADD COLUMN IF NOT EXISTS how_to_reach TEXT,
  ADD COLUMN IF NOT EXISTS highlights TEXT,
  ADD COLUMN IF NOT EXISTS tips TEXT;

COMMENT ON COLUMN tourist_places.best_time IS 'Best season/months to visit, e.g. Oct – Mar';
COMMENT ON COLUMN tourist_places.visit_duration IS 'Typical visit duration, e.g. 2–3 hrs';
COMMENT ON COLUMN tourist_places.entry_fee IS 'Entry fee summary, e.g. Free / ₹50 adults';
COMMENT ON COLUMN tourist_places.how_to_reach IS 'How to reach the destination';
COMMENT ON COLUMN tourist_places.highlights IS 'Key highlights / what to see';
COMMENT ON COLUMN tourist_places.tips IS 'Visitor tips';

-- Tagged merchants (typically Tour & Travels) shown on the place profile.
CREATE TABLE IF NOT EXISTS tourist_place_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_place_id UUID NOT NULL REFERENCES tourist_places(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tourist_place_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_tourist_place_merchants_place
  ON tourist_place_merchants (tourist_place_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_tourist_place_merchants_business
  ON tourist_place_merchants (business_id);

COMMENT ON TABLE tourist_place_merchants IS 'Tour & travel (or related) merchants tagged to a tourist place for “how to get there”';

ALTER TABLE tourist_place_merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tourist_place_merchants_anon_all ON tourist_place_merchants;
CREATE POLICY tourist_place_merchants_anon_all
  ON tourist_place_merchants FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
