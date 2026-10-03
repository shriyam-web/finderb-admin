-- Authenticator secret for admin login. Empty until that admin confirms a code.
-- Service role only; do not expose this column to the browser.

alter table public.admins
  add column if not exists totp_secret text;

alter table public.admins
  add column if not exists totp_confirmed_at timestamptz;
