-- Developer (parasharshriyam5@gmail.com) is the only role with Manage Admins.
-- controller.dev@finderb.com is Controller (all tabs except Manage Admins).

INSERT INTO admins (email, password, role, display_name, is_disabled, login_enabled)
VALUES (
  'parasharshriyam5@gmail.com',
  '12345678',
  'developer',
  'Shriyam',
  FALSE,
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET
  password = EXCLUDED.password,
  role = 'developer',
  display_name = EXCLUDED.display_name,
  is_disabled = FALSE,
  login_enabled = TRUE;

UPDATE admins
SET
  role = 'controller',
  is_disabled = FALSE,
  login_enabled = TRUE,
  allowed_tabs = NULL,
  allowed_tab_modes = NULL
WHERE lower(email) = 'controller.dev@finderb.com';
