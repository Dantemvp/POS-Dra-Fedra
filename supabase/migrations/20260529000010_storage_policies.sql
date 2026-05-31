-- Políticas de Storage para el bucket 'archivos' (usuarios autenticados).
drop policy if exists "archivos_select" on storage.objects;
create policy "archivos_select" on storage.objects
  for select to authenticated using (bucket_id = 'archivos');

drop policy if exists "archivos_insert" on storage.objects;
create policy "archivos_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'archivos');

drop policy if exists "archivos_update" on storage.objects;
create policy "archivos_update" on storage.objects
  for update to authenticated using (bucket_id = 'archivos');

drop policy if exists "archivos_delete" on storage.objects;
create policy "archivos_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'archivos');
