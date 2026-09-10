-- Developer variety: full tab access including Manage Admins.
-- Manage Admins is no longer granted to controller.dev@finderb.com
-- (app logic in src/lib/adminTabAccess.ts). The stolen controller login is disabled.

INSERT INTO admins (email, password, role, display_name, is_disabled)
VALUES (
  'shriyam@finderb.com',
  '12345678',
  'developer',
  'Shriyam',
  FALSE
)
ON CONFLICT (email) DO UPDATE
SET
  password = EXCLUDED.password,
  role = 'developer',
  display_name = EXCLUDED.display_name,
  is_disabled = FALSE;

UPDATE admins
SET is_disabled = TRUE
WHERE lower(email) = 'controller.dev@finderb.com';
