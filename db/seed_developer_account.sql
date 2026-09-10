-- Super admin (demoted from controller). No Manage Admins.
-- Developer (shriyam@finderb.com) is the only role with Manage Admins.

INSERT INTO admins (email, password, role, display_name, is_disabled, login_enabled)
VALUES (
  'shriyam@finderb.com',
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
  role = 'super_admin',
  is_disabled = FALSE,
  login_enabled = FALSE,
  allowed_tabs = ARRAY[
    'Dashboard',
    'Users',
    'Merchants',
    'Business Onboarding',
    'Quick Onboard',
    'Leads',
    'Categories',
    'Movies',
    'Tourist Places',
    'Payments & Subscriptions',
    'Broadcasts',
    'Blogs',
    'YouTube Playlists',
    'FinderB Jobs',
    'Settings'
  ],
  allowed_tab_modes = '{
    "Dashboard": "edit",
    "Users": "edit",
    "Merchants": "edit",
    "Business Onboarding": "edit",
    "Quick Onboard": "edit",
    "Leads": "edit",
    "Categories": "edit",
    "Movies": "edit",
    "Tourist Places": "edit",
    "Payments & Subscriptions": "edit",
    "Broadcasts": "edit",
    "Blogs": "edit",
    "YouTube Playlists": "edit",
    "FinderB Jobs": "edit",
    "Settings": "edit"
  }'::jsonb
WHERE lower(email) = 'controller.dev@finderb.com';
