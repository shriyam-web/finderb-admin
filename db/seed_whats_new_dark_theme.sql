-- Announce dark theme switch for admin / super_admin (idempotent by title).

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Dark theme switch for Admin & Super Admin',
  'Admin and Super Admin accounts can now switch between light and dark console themes from the top bar. Preference is saved on this device. Controllers keep the separate gold premium console — that look stays exclusive.',
  TIMESTAMPTZ '2026-09-04 03:00:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Dark theme switch for Admin & Super Admin'
);
