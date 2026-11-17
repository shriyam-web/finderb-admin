-- Lets the admin panel hear that What's New changed, without exposing the notes.
-- The browser only receives a revision number, then reloads the list through the signed-in admin proxy.

create table if not exists public.admin_whats_new_signal (
  id integer primary key,
  revision bigint not null default 0,
  constraint admin_whats_new_signal_singleton check (id = 1)
);

insert into public.admin_whats_new_signal (id, revision)
values (1, 0)
on conflict (id) do nothing;

alter table public.admin_whats_new_signal replica identity full;

create or replace function public.bump_admin_whats_new_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_whats_new_signal
  set revision = revision + 1
  where id = 1;
  return null;
end;
$$;

drop trigger if exists admin_whats_new_signal_items on public.admin_whats_new;
create trigger admin_whats_new_signal_items
after insert or update or delete on public.admin_whats_new
for each statement
execute function public.bump_admin_whats_new_signal();

drop trigger if exists admin_whats_new_signal_reads on public.admin_whats_new_reads;
create trigger admin_whats_new_signal_reads
after insert or update or delete on public.admin_whats_new_reads
for each statement
execute function public.bump_admin_whats_new_signal();

alter table public.admin_whats_new_signal enable row level security;

drop policy if exists "Read the what's new signal" on public.admin_whats_new_signal;
create policy "Read the what's new signal"
  on public.admin_whats_new_signal
  for select
  using (true);

grant select on public.admin_whats_new_signal to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_whats_new_signal'
  ) then
    alter publication supabase_realtime add table public.admin_whats_new_signal;
  end if;
end $$;
