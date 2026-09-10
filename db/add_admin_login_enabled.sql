-- Suspicious-activity login lock for every account except Developer.
-- login_enabled = FALSE → they can sign in, see the warning modal, then auto logout.
-- Developer can set login_enabled = TRUE from Manage Admins to restore full login.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT FALSE;

UPDATE public.admins
SET login_enabled = TRUE
WHERE role = 'developer';

UPDATE public.admins
SET login_enabled = FALSE
WHERE role IS DISTINCT FROM 'developer' OR role IS NULL;
