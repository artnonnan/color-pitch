-- Color Pitch: one row of app state per profile ("art" and "guest").
-- No login and no PIN (by choice): anyone with the site can read and save either profile.
-- Writes go through cp_save, which only accepts the two known ids and never replaces a
-- newer copy with an older one (compared by the client's save time).

create table if not exists public.cp_profiles (
  id text primary key check (id in ('art', 'guest')),
  state jsonb not null,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.cp_profiles enable row level security;

drop policy if exists cp_profiles_read on public.cp_profiles;
create policy cp_profiles_read on public.cp_profiles for select to anon, authenticated using (true);
grant select on public.cp_profiles to anon, authenticated;

create or replace function public.cp_save(p_id text, p_state jsonb, p_ts bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_id not in ('art', 'guest') then
    raise exception 'unknown profile %', p_id;
  end if;
  if octet_length(p_state::text) > 5000000 then
    raise exception 'state too large';
  end if;
  insert into public.cp_profiles (id, state, client_updated_at, updated_at)
  values (p_id, p_state, p_ts, now())
  on conflict (id) do update
    set state = excluded.state,
        client_updated_at = excluded.client_updated_at,
        updated_at = now()
    where public.cp_profiles.client_updated_at <= excluded.client_updated_at;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cp_save(text, jsonb, bigint) from public;
grant execute on function public.cp_save(text, jsonb, bigint) to anon, authenticated;
