-- Singleton copy for the locked-login modal. Editable from Manage Admins.

CREATE TABLE IF NOT EXISTS public.admin_lock_modal (
  id TEXT PRIMARY KEY,
  eyebrow TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  footer TEXT NOT NULL,
  logout_seconds INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_lock_modal ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_lock_modal'
      AND policyname = 'Allow all access to admin_lock_modal'
  ) THEN
    CREATE POLICY "Allow all access to admin_lock_modal"
      ON public.admin_lock_modal FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.admin_lock_modal (
  id, eyebrow, title, body, footer, logout_seconds
) VALUES (
  'default',
  'Security alert',
  'Suspicious activity detected',
  'You''ll be auto logged out in {countdown}.',
  'This session cannot continue. Contact a Developer to enable login.',
  60
)
ON CONFLICT (id) DO UPDATE
SET logout_seconds = GREATEST(public.admin_lock_modal.logout_seconds, 60);
