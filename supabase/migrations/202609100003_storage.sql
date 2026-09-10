insert into storage.buckets(id,name,public,file_size_limit)
values('company-files','company-files',false,2000000)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;
-- Objects are uploaded/deleted exclusively by Edge Functions. Guessed paths and
-- uncommitted uploads have no readable file row, so they cannot be signed/read.
create policy company_files_private_read on storage.objects for select to authenticated
using(bucket_id='company-files' and exists(
  select 1 from public.files f where f.storage_path=name and f.status='ready' and private.can_view(f.department_id)
));
-- No INSERT/UPDATE/DELETE policies for browser roles. Do not add public policies.
