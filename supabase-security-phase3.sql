begin;

-- Matter numbers now live only inside the encrypted payload.
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
  if new.id <> old.id or new.data ->> 'owner' <> old.data ->> 'owner' then
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
revoke execute on function public.lcb_guard_matter_write() from public;

insert into storage.buckets (id, name, public, file_size_limit)
values ('lcb-encrypted-files', 'lcb-encrypted-files', false, 28000000)
on conflict (id) do update set public=false, file_size_limit=28000000;

drop policy if exists lcb_files_read on storage.objects;
drop policy if exists lcb_files_add on storage.objects;
drop policy if exists lcb_files_remove on storage.objects;

create policy lcb_files_read on storage.objects for select to authenticated
using (
  bucket_id='lcb-encrypted-files' and exists (
    select 1 from public.matters m
    where m.id=(storage.foldername(name))[1]
      and (public.lcb_team_id()='carol' or m.data->>'owner'=public.lcb_team_id()
        or coalesce(m.data->'team','[]'::jsonb) ? public.lcb_team_id())
  )
);
create policy lcb_files_add on storage.objects for insert to authenticated
with check (
  bucket_id='lcb-encrypted-files' and exists (
    select 1 from public.matters m
    where m.id=(storage.foldername(name))[1]
      and (public.lcb_team_id()='carol' or m.data->>'owner'=public.lcb_team_id()
        or coalesce(m.data->'team','[]'::jsonb) ? public.lcb_team_id())
  )
);
create policy lcb_files_remove on storage.objects for delete to authenticated
using (
  bucket_id='lcb-encrypted-files' and exists (
    select 1 from public.matters m
    where m.id=(storage.foldername(name))[1]
      and (public.lcb_team_id()='carol' or m.data->>'owner'=public.lcb_team_id())
  )
);

commit;
