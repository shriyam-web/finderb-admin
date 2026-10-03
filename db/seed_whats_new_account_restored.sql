-- Announce restored admin account access.

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Your account access is restored',
  'You can now use your account again.',
  TIMESTAMPTZ '2026-09-11 00:03:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Your account access is restored'
);
