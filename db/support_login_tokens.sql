-- One-time tokens for Admin → Merchant support login (FinderB).
create table if not exists public.support_login_tokens (
  id uuid primary key default gen_random_uuid(),
  jti text not null unique,
  business_id uuid not null,
  admin_id text,
  admin_email text,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists support_login_tokens_business_id_idx
  on public.support_login_tokens (business_id);

create index if not exists support_login_tokens_expires_at_idx
  on public.support_login_tokens (expires_at);

alter table public.support_login_tokens enable row level security;
