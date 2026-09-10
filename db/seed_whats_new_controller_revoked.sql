-- Announce Controller credential change from an unlisted IP and auto-revoked actions.

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Controller actions auto-revoked after unlisted IP change',
  'Controller credentials were changed from an unlisted IP address. Controller actions have been automatically revoked.',
  TIMESTAMPTZ '2026-09-10 21:00:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Controller actions auto-revoked after unlisted IP change'
);
