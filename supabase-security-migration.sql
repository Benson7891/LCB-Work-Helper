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
