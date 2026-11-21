-- Panel PIN and a session generation. Bumping session_epoch signs out every saved login.
-- The PIN hash lives in admin_panel_pins. The browser proxy must not read that table.

alter table public.admins
  add column if not exists session_epoch integer not null default 0;

create table if not exists public.admin_panel_pins (
  admin_id uuid primary key references public.admins(id) on delete cascade,
  pin_hash text not null,
  fail_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.admin_panel_pins enable row level security;
