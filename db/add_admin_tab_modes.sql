-- Per-tab read/edit modes for admin accounts (controllers always have full access).
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS allowed_tab_modes JSONB DEFAULT NULL;

COMMENT ON COLUMN public.admins.allowed_tab_modes IS
  'Map of tab name → read|edit. When null/empty, allowed_tabs string[] is treated as edit for each listed tab.';
