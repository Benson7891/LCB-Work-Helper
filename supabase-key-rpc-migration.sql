begin;

-- Remove the failed pending test. It contains no client/title/notes plaintext.
delete from public.logs where matter_id = '52';
delete from public.lcb_matter_keys where matter_id = '52';
delete from public.matters where id = '52';

create or replace function public.lcb_store_wrapped_keys(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  actor text := public.lcb_team_id();
  item jsonb;
  target_matter public.matters%rowtype;
begin
  if actor is null then raise exception 'unknown team member'; end if;
  if jsonb_typeof(payload) <> 'array' then raise exception 'payload must be an array'; end if;

  for item in select value from jsonb_array_elements(payload)
  loop
    select * into target_matter from public.matters where id = item ->> 'matter_id';
    if not found then raise exception 'matter does not exist'; end if;
    if actor <> 'carol' and not coalesce(target_matter.data -> 'team', '[]'::jsonb) ? actor then
      raise exception 'actor is not a matter member';
    end if;
    if item ->> 'user_id' <> 'carol'
       and not coalesce(target_matter.data -> 'team', '[]'::jsonb) ? (item ->> 'user_id') then
      raise exception 'recipient is not authorized';
    end if;
    insert into public.lcb_matter_keys(matter_id, user_id, wrapped_key)
    values(item ->> 'matter_id', item ->> 'user_id', item ->> 'wrapped_key')
    on conflict (matter_id, user_id) do update set wrapped_key = excluded.wrapped_key;
  end loop;
end $$;

revoke all on function public.lcb_store_wrapped_keys(jsonb) from public;
grant execute on function public.lcb_store_wrapped_keys(jsonb) to authenticated;

drop policy if exists lcb_matter_keys_owner_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_owner_update on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_member_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_member_update on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_rescue_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_rescue_update on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_authenticated_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_authenticated_update on public.lcb_matter_keys;

revoke insert, update, delete on public.lcb_matter_keys from authenticated;
grant select on public.lcb_matter_keys to authenticated;

commit;
