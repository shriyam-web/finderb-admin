-- Idempotent What's New seeds for the three-level catalog, hours editor, and overlay stacking.

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Category catalog: Parent → Category → Subcategory',
  'Categories now have three clear levels. Parent Category is a grouping folder (violet). Category is what merchants join (teal). Subcategory is a more specific type under a Category (amber).

Subcategories sit in an accordion that starts collapsed. The add/edit form uses three cards instead of a Kind dropdown, shows the path preview, and lets you add a Category or Subcategory from the tree.',
  TIMESTAMPTZ '2026-09-09 00:30:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Category catalog: Parent → Category → Subcategory'
);

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Working hours match the merchant panel',
  'Merchant detail and Quick Onboard now use the same working-hours editor as the merchant dashboard: Open 24 hours, Closed, and Apply same to all days from Monday.',
  TIMESTAMPTZ '2026-09-09 00:32:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Working hours match the merchant panel'
);

INSERT INTO admin_whats_new (title, body, published_at)
SELECT
  'Tab access and other dialogs stay on top',
  'The Manage Admins tab-access dialog, profile, jobs review, What''s New, and onboard chooser now render above the sidebar and sticky header so they are no longer hidden behind chrome.',
  TIMESTAMPTZ '2026-09-09 00:34:00+05:30'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_whats_new
  WHERE title = 'Tab access and other dialogs stay on top'
);
