begin;

delete from public.logs where matter_id = '51';
delete from public.lcb_matter_keys where matter_id = '51';
delete from public.matters where id = '51';

drop policy if exists lcb_matter_keys_rescue_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_rescue_update on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_member_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_member_update on public.lcb_matter_keys;

create policy lcb_matter_keys_member_insert on public.lcb_matter_keys
for insert to authenticated
with check (
  public.lcb_team_id() is not null
  and exists (
    select 1 from public.matters m
    where m.id = lcb_matter_keys.matter_id
      and (lcb_matter_keys.user_id = 'carol'
        or coalesce(m.data -> 'team', '[]'::jsonb) ? lcb_matter_keys.user_id)
  )
);

create policy lcb_matter_keys_member_update on public.lcb_matter_keys
for update to authenticated
using (
  public.lcb_team_id() is not null
  and exists (select 1 from public.matters m where m.id = lcb_matter_keys.matter_id)
)
with check (
  public.lcb_team_id() is not null
  and exists (
    select 1 from public.matters m
    where m.id = lcb_matter_keys.matter_id
      and (lcb_matter_keys.user_id = 'carol'
        or coalesce(m.data -> 'team', '[]'::jsonb) ? lcb_matter_keys.user_id)
  )
);

commit;
