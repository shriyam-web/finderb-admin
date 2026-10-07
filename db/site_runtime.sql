create table if not exists public.site_runtime (
  id text primary key,
  mode text not null default 'normal',
  message text,
  until timestamptz,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_runtime_mode_check'
  ) then
    alter table public.site_runtime
      add constraint site_runtime_mode_check
      check (mode in ('normal', 'text_only', 'maintenance'));
  end if;
end $$;

insert into public.site_runtime (id, mode)
values ('finderb', 'normal')
on conflict (id) do nothing;

alter table public.site_runtime enable row level security;

drop policy if exists site_runtime_read on public.site_runtime;
create policy site_runtime_read on public.site_runtime
  for select using (true);

grant select on table public.site_runtime to anon, authenticated;
