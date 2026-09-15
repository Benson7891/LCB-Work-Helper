-- Run after creating the three existing email/password pairs in Supabase Auth.
-- Existing matters and logs are preserved.

create or replace function public.lcb_team_id() returns text
language sql stable security definer set search_path = public as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when '13726111370@163.com' then 'carol'
    when 'cdavila@lcbabogados.com' then 'carlos'
    when 'hlujan@lcbabogados.com' then 'hector'
    else null end
$$;
revoke all on function public.lcb_team_id() from public;
grant execute on function public.lcb_team_id() to authenticated;

alter table public.matters enable row level security;
alter table public.logs enable row level security;
alter table public.meta enable row level security;

drop policy if exists lcb_all on public.matters;
drop policy if exists lcb_matters_read on public.matters;
drop policy if exists lcb_matters_insert on public.matters;
drop policy if exists lcb_matters_update on public.matters;
drop policy if exists lcb_matters_delete on public.matters;
create policy lcb_matters_read on public.matters for select to authenticated
using (public.lcb_team_id() = 'carol' or coalesce(data -> 'team', '[]'::jsonb) ? public.lcb_team_id());
create policy lcb_matters_insert on public.matters for insert to authenticated
with check (public.lcb_team_id() = 'carol' or coalesce(data -> 'team', '[]'::jsonb) ? public.lcb_team_id());
create policy lcb_matters_update on public.matters for update to authenticated
using (public.lcb_team_id() = 'carol' or coalesce(data -> 'team', '[]'::jsonb) ? public.lcb_team_id())
with check (public.lcb_team_id() = 'carol' or coalesce(data -> 'team', '[]'::jsonb) ? public.lcb_team_id());
create policy lcb_matters_delete on public.matters for delete to authenticated
using (public.lcb_team_id() = 'carol' or data ->> 'owner' = public.lcb_team_id());

drop policy if exists lcb_all on public.logs;
drop policy if exists lcb_logs_read on public.logs;
drop policy if exists lcb_logs_insert on public.logs;
drop policy if exists lcb_logs_update on public.logs;
drop policy if exists lcb_logs_delete on public.logs;
create policy lcb_logs_read on public.logs for select to authenticated
using (exists (select 1 from public.matters m where m.id = logs.matter_id));
create policy lcb_logs_insert on public.logs for insert to authenticated
with check (exists (select 1 from public.matters m where m.id = logs.matter_id));
create policy lcb_logs_update on public.logs for update to authenticated
using (exists (select 1 from public.matters m where m.id = logs.matter_id))
with check (exists (select 1 from public.matters m where m.id = logs.matter_id));
create policy lcb_logs_delete on public.logs for delete to authenticated
using (exists (select 1 from public.matters m where m.id = logs.matter_id
  and (public.lcb_team_id() = 'carol' or m.data ->> 'owner' = public.lcb_team_id())));

drop policy if exists lcb_all on public.meta;
drop policy if exists lcb_meta_read on public.meta;
drop policy if exists lcb_meta_write on public.meta;
create policy lcb_meta_read on public.meta for select to authenticated
using (public.lcb_team_id() is not null);
create policy lcb_meta_write on public.meta for all to authenticated
using (public.lcb_team_id() is not null) with check (public.lcb_team_id() is not null);

revoke all on public.matters, public.logs, public.meta from anon;
grant select, insert, update, delete on public.matters, public.logs, public.meta to authenticated;

-- Defense in depth: RLS decides which rows are reachable; these triggers protect
-- security-sensitive fields even when a signed-in user bypasses the web UI.
create or replace function public.lcb_guard_matter_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor text := public.lcb_team_id();
begin
  if actor is null then raise exception 'unknown team member'; end if;
  if actor = 'carol' then return new; end if;

  if tg_op = 'INSERT' then
    if new.data ->> 'owner' <> actor then raise exception 'owner must be current user'; end if;
    if not coalesce(new.data -> 'team', '[]'::jsonb) ? actor then raise exception 'creator must remain a member'; end if;
    return new;
  end if;

  if new.id <> old.id or new.data ->> 'owner' <> old.data ->> 'owner' or new.data ->> 'no' <> old.data ->> 'no' then
    raise exception 'protected matter identity cannot be changed';
  end if;
  if old.data ->> 'owner' <> actor and coalesce(new.data -> 'team', '[]'::jsonb) <> coalesce(old.data -> 'team', '[]'::jsonb) then
    raise exception 'only the matter owner can change members';
  end if;
  if not coalesce(new.data -> 'team', '[]'::jsonb) ? (old.data ->> 'owner') then
    raise exception 'matter owner must remain a member';
  end if;
  return new;
end $$;

drop trigger if exists lcb_guard_matter_write on public.matters;
create trigger lcb_guard_matter_write before insert or update on public.matters
for each row execute function public.lcb_guard_matter_write();

create or replace function public.lcb_guard_log_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor text := public.lcb_team_id();
begin
  if actor is null then raise exception 'unknown team member'; end if;
  if tg_op = 'INSERT' then
    if new.data ->> 'by' <> actor then raise exception 'log author mismatch'; end if;
    return new;
  end if;
  if new.id <> old.id or new.matter_id <> old.matter_id or
     (new.data - 'readBy' - 'deletedFor') <> (old.data - 'readBy' - 'deletedFor') then
    raise exception 'activity history is append-only';
  end if;
  return new;
end $$;

drop trigger if exists lcb_guard_log_write on public.logs;
create trigger lcb_guard_log_write before insert or update on public.logs
for each row execute function public.lcb_guard_log_write();

revoke execute on function public.lcb_guard_matter_write() from public;
revoke execute on function public.lcb_guard_log_write() from public;
