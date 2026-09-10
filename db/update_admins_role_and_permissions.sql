-- Add is_disabled and allowed_tabs columns to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allowed_tabs TEXT[] DEFAULT NULL;

-- Insert or update controller admin
-- Manage Admins now belongs to the Developer variety (see db/seed_developer_account.sql).
INSERT INTO admins (email, password, role)
VALUES ('controller.dev@finderb.com', 'controller123', 'controller')
ON CONFLICT (email) DO UPDATE 
    SET role = 'controller';
