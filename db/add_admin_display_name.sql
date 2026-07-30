-- Optional display name for admin profile (sidebar / profile modal)
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS display_name TEXT;
