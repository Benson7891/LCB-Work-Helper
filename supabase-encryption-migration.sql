-- Phase 1: key infrastructure and immutable safety backups.
-- This does not change existing account credentials or matter content.

create table if not exists public.lcb_public_keys (
  user_id text primary key,
  public_jwk jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.lcb_private_keys (
  user_id text primary key,
  salt text not null,
  private_iv text not null,
  private_cipher text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.lcb_matter_keys (
  matter_id text not null references public.matters(id) on delete cascade,
  user_id text not null,
  wrapped_key text not null,
  created_at timestamptz not null default now(),
  primary key (matter_id, user_id)
);

alter table public.lcb_public_keys enable row level security;
alter table public.lcb_private_keys enable row level security;
alter table public.lcb_matter_keys enable row level security;

drop policy if exists lcb_public_keys_read on public.lcb_public_keys;
drop policy if exists lcb_public_keys_own_insert on public.lcb_public_keys;
drop policy if exists lcb_public_keys_own_update on public.lcb_public_keys;
drop policy if exists lcb_private_keys_own_read on public.lcb_private_keys;
drop policy if exists lcb_private_keys_own_insert on public.lcb_private_keys;
drop policy if exists lcb_private_keys_own_update on public.lcb_private_keys;
drop policy if exists lcb_matter_keys_own_read on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_owner_insert on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_owner_update on public.lcb_matter_keys;
drop policy if exists lcb_matter_keys_owner_delete on public.lcb_matter_keys;

create policy lcb_public_keys_read on public.lcb_public_keys for select to authenticated
using (public.lcb_team_id() is not null);
create policy lcb_public_keys_own_insert on public.lcb_public_keys for insert to authenticated
with check (user_id = public.lcb_team_id());
create policy lcb_public_keys_own_update on public.lcb_public_keys for update to authenticated
using (user_id = public.lcb_team_id()) with check (user_id = public.lcb_team_id());

create policy lcb_private_keys_own_read on public.lcb_private_keys for select to authenticated
using (user_id = public.lcb_team_id());
create policy lcb_private_keys_own_insert on public.lcb_private_keys for insert to authenticated
with check (user_id = public.lcb_team_id());
create policy lcb_private_keys_own_update on public.lcb_private_keys for update to authenticated
using (user_id = public.lcb_team_id()) with check (user_id = public.lcb_team_id());

create policy lcb_matter_keys_own_read on public.lcb_matter_keys for select to authenticated
using (user_id = public.lcb_team_id());
create policy lcb_matter_keys_owner_insert on public.lcb_matter_keys for insert to authenticated
with check (exists (select 1 from public.matters m where m.id = matter_id and
  (public.lcb_team_id() = 'carol' or m.data ->> 'owner' = public.lcb_team_id())));
create policy lcb_matter_keys_owner_update on public.lcb_matter_keys for update to authenticated
using (exists (select 1 from public.matters m where m.id = matter_id and
  (public.lcb_team_id() = 'carol' or m.data ->> 'owner' = public.lcb_team_id())))
with check (exists (select 1 from public.matters m where m.id = matter_id and
  (public.lcb_team_id() = 'carol' or m.data ->> 'owner' = public.lcb_team_id())));
create policy lcb_matter_keys_owner_delete on public.lcb_matter_keys for delete to authenticated
using (exists (select 1 from public.matters m where m.id = matter_id and
  (public.lcb_team_id() = 'carol' or m.data ->> 'owner' = public.lcb_team_id())));

revoke all on public.lcb_public_keys, public.lcb_private_keys, public.lcb_matter_keys from anon;
grant select, insert, update on public.lcb_public_keys, public.lcb_private_keys to authenticated;
grant select, insert, update, delete on public.lcb_matter_keys to authenticated;

-- Do not create plaintext backups here. Export an encrypted backup separately if needed.
