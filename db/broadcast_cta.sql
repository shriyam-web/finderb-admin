-- Optional CTA + datetime visibility on broadcasts, plus per-reader counts.
-- Same schema as FinderB/supabase/broadcast_cta.sql — run once on the shared project.

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS cta_url TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS show_datetime BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS broadcast_reads (
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  reader_type TEXT NOT NULL DEFAULT 'user',
  read_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (broadcast_id, reader_type, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_reads_broadcast ON broadcast_reads (broadcast_id);

ALTER TABLE broadcast_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_reads_deny_anon" ON broadcast_reads;
CREATE POLICY "broadcast_reads_deny_anon"
  ON broadcast_reads FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
