-- Add is_disabled and allowed_tabs columns to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allowed_tabs TEXT[] DEFAULT NULL;

-- controller.dev@finderb.com is a Controller (all tabs except Manage Admins).
-- See db/seed_developer_account.sql for the Developer variety.
