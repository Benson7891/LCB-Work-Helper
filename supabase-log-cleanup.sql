-- Remove activity records whose matters were already permanently deleted.
delete from public.logs l
where not exists (select 1 from public.matters m where m.id = l.matter_id);

-- Future matter deletion also removes its activity atomically.
alter table public.logs drop constraint if exists logs_matter_id_fkey;
alter table public.logs
  add constraint logs_matter_id_fkey foreign key (matter_id)
  references public.matters(id) on delete cascade;
