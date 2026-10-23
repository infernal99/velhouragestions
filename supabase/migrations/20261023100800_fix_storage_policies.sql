-- Bug fix: inside `exists (select ... from public.files f where f.storage_path = name)`
-- the bare `name` resolved to `f.name` (the files table also has a `name` column),
-- so no object was ever readable through its files row. Qualify it explicitly.

drop policy if exists "company-files: read via files row" on storage.objects;
create policy "company-files: read via files row" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-files'
    and exists (select 1 from public.files f where f.storage_path = storage.objects.name)
  );

drop policy if exists "company-files: delete via files row" on storage.objects;
create policy "company-files: delete via files row" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-files'
    and (
      exists (
        select 1 from public.files f
        where f.storage_path = storage.objects.name
          and (f.uploaded_by = (select auth.uid()) or private.is_admin(f.company_id))
      )
      -- orphaned upload (files row never created) can be cleaned by its owner
      or (
        storage.objects.owner_id = (select auth.uid())::text
        and not exists (select 1 from public.files f where f.storage_path = storage.objects.name)
      )
    )
  );
