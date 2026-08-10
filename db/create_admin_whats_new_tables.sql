-- Admin "What's New" changelog + per-admin read receipts.
-- Run in Supabase SQL editor (or via DATABASE_URL).

CREATE TABLE IF NOT EXISTS admin_whats_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_whats_new_reads (
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES admin_whats_new(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_id, item_id)
);

CREATE INDEX IF NOT EXISTS admin_whats_new_published_at_idx
  ON admin_whats_new (published_at DESC);

CREATE INDEX IF NOT EXISTS admin_whats_new_reads_admin_id_idx
  ON admin_whats_new_reads (admin_id);

ALTER TABLE admin_whats_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_whats_new_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_whats_new'
      AND policyname = 'Allow all access to admin_whats_new'
  ) THEN
    CREATE POLICY "Allow all access to admin_whats_new"
      ON admin_whats_new FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_whats_new_reads'
      AND policyname = 'Allow all access to admin_whats_new_reads'
  ) THEN
    CREATE POLICY "Allow all access to admin_whats_new_reads"
      ON admin_whats_new_reads FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed recent enhancements (idempotent by title).
INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Default payment modes on onboarding',
  'Quick Onboard and Business Onboarding now show payment mode checkboxes. Cash, UPI, and Net Banking are pre-selected and can be changed before create. Chosen modes are saved on the merchant profile.',
  TIMESTAMPTZ '2026-08-10 18:15:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Default payment modes on onboarding'
);

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'What''s New panel for admins',
  'A right-side What''s New panel lists product enhancements with dates. Each admin has their own unread / read state — mark items as read independently of other accounts.',
  TIMESTAMPTZ '2026-08-10 23:50:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'What''s New panel for admins'
);
