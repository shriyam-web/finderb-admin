-- Titles a Developer removed from What's New. Seeds must not put them back.
-- Run in the Supabase SQL editor (or via DATABASE_URL).

CREATE TABLE IF NOT EXISTS admin_whats_new_removed (
  title TEXT PRIMARY KEY,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_by UUID REFERENCES admins(id) ON DELETE SET NULL
);

ALTER TABLE admin_whats_new_removed ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_whats_new_removed'
      AND policyname = 'Allow all access to admin_whats_new_removed'
  ) THEN
    CREATE POLICY "Allow all access to admin_whats_new_removed"
      ON admin_whats_new_removed FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO admin_whats_new_removed (title)
VALUES ('Site Configurations is under Platform')
ON CONFLICT (title) DO NOTHING;

DELETE FROM admin_whats_new
WHERE title = 'Site Configurations is under Platform';

CREATE OR REPLACE FUNCTION admin_whats_new_skip_retired()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM admin_whats_new_removed WHERE title = NEW.title
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_whats_new_skip_retired_trg ON admin_whats_new;
CREATE TRIGGER admin_whats_new_skip_retired_trg
BEFORE INSERT ON admin_whats_new
FOR EACH ROW
EXECUTE FUNCTION admin_whats_new_skip_retired();
