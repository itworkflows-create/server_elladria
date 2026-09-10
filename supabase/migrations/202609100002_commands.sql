-- One settings-row lock serializes mutations/quota reservations across this internal
-- workspace. This favors correctness over write throughput and prevents write skew.
create function public.elladria_command(command jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles; d uuid; target uuid; parent uuid; old_folder public.folders;
  old_file public.files; label text; action text; typ text; recipient public.profiles;
begin
  perform 1 from public.workspace_settings where id for update;
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null then raise exception 'APP_SESSION' using errcode='42501'; end if;
  target := nullif(command->>'id','')::uuid;
  label := btrim(command->>'name');
  case command->>'kind'
    when 'department' then
      if actor.role='executive' or (actor.role='department_member' and actor.department_id is not null) then raise exception 'APP_DEPARTMENT_LIMIT'; end if;
      insert into public.departments(name,description,owner_id,created_by) values(label,coalesce(command->>'description',''),actor.id,actor.id) returning id into d;
      if actor.role='department_member' then update public.profiles set department_id=d where id=actor.id; end if;
      target:=d; action:='created department'; typ:='department';
    when 'renameDepartment' then
      perform private.require_admin(); d:=target; perform private.require_manage(d);
      update public.departments set name=label where id=d;
      action:='renamed department'; typ:='department';
    when 'quota' then
      perform private.require_admin(); d:=(command->>'departmentId')::uuid; perform private.require_manage(d);
      update public.departments set storage_quota_bytes=(command->>'storageQuotaBytes')::bigint where id=d returning name into label;
      target:=d; action:='changed storage quota'; typ:='department';
    when 'createFolder' then
      d:=(command->>'departmentId')::uuid; parent:=nullif(command->>'parentFolderId','')::uuid;
      perform private.require_manage(d); perform private.assert_folder(d,parent);
      insert into public.folders(department_id,parent_folder_id,name,created_by) values(d,parent,label,actor.id) returning id into target;
      action:='created folder'; typ:='folder';
    when 'renameFolder','moveFolder' then
      select * into old_folder from public.folders where id=target;
      if not found then raise exception 'APP_NOT_FOUND'; end if;
      d:=old_folder.department_id; perform private.require_manage(d);
      if command->>'kind'='renameFolder' then
        update public.folders set name=label where id=target; action:='renamed folder';
      else
        parent:=nullif(command->>'parentFolderId','')::uuid;
        perform private.assert_folder(d,parent);
        update public.folders set parent_folder_id=parent where id=target;
        label:=old_folder.name; action:='moved folder';
      end if;
      typ:='folder';
    when 'renameFile','moveFile' then
      select * into old_file from public.files where id=target and status='ready';
      if not found then raise exception 'APP_NOT_FOUND'; end if;
      d:=old_file.department_id; perform private.require_manage(d);
      if command->>'kind'='renameFile' then
        update public.files set file_name=label where id=target; action:='renamed';
      else
        parent:=nullif(command->>'folderId','')::uuid; perform private.assert_folder(d,parent);
        update public.files set folder_id=parent where id=target;
        label:=old_file.file_name; action:='moved file';
      end if;
      typ:='file';
    when 'role' then
      perform private.require_admin();
      if target=actor.id then raise exception 'APP_SELF_ADMIN'; end if;
      update public.profiles set role=command->>'role' where id=target returning display_name into label;
      if not found then raise exception 'APP_NOT_FOUND'; end if;
      action:='changed role'; typ:='user';
    when 'permission' then
      perform private.require_admin();
      select * into recipient from public.profiles where id=(command->>'userId')::uuid;
      d:=(command->>'departmentId')::uuid;
      if recipient.id is null or recipient.role<>'department_member' or recipient.department_id=d then raise exception 'APP_PERMISSION_TARGET'; end if;
      perform private.require_manage(d);
      insert into public.department_permissions(user_id,department_id,permission_level,granted_by) values(recipient.id,d,command->>'access',actor.id)
      on conflict(user_id,department_id) do update set permission_level=excluded.permission_level,granted_by=excluded.granted_by returning id into target;
      label:=recipient.display_name; action:='granted access to'; typ:='permission';
    when 'revoke' then
      perform private.require_admin();
      delete from public.department_permissions where id=target returning department_id into d;
      if not found then raise exception 'APP_NOT_FOUND'; end if;
      label:='Department access'; action:='revoked'; typ:='permission';
    when 'profile' then
      update public.profiles set display_name=label where id=actor.id;
      target:=actor.id; action:='updated profile'; typ:='user';
    else raise exception 'APP_INVALID_COMMAND';
  end case;
  perform private.log_event(d,action,typ,target,label,command - 'password');
end $$;

-- Consistent, RLS-filtered snapshot, not subject to the REST row-count limit.
create function public.elladria_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profiles',(select coalesce(jsonb_agg(p),'[]') from public.profiles p),
    'departments',(select coalesce(jsonb_agg(d),'[]') from public.departments d),
    'permissions',(select coalesce(jsonb_agg(g),'[]') from public.department_permissions g),
    'folders',(select coalesce(jsonb_agg(f),'[]') from public.folders f),
    'files',(select coalesce(jsonb_agg(f order by created_at desc),'[]') from public.files f),
    'activities',(select coalesce(jsonb_agg(a order by created_at desc),'[]') from public.activity_logs a),
    'total_capacity_bytes',(select total_capacity_bytes from public.workspace_settings where id),
    'deletion_jobs',(select coalesce(jsonb_agg(j),'[]') from public.deletion_jobs j),
    'upload_reservations',(select coalesce(jsonb_agg(r),'[]') from public.upload_reservations r)
  )
$$;

create function private.file_format(ext text) returns table(mime text,category text) language sql immutable set search_path = '' as $$
  select m,c from (values
    ('pdf','application/pdf','document'),('doc','application/msword','document'),
    ('docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','document'),
    ('jpg','image/jpeg','image'),('jpeg','image/jpeg','image'),('png','image/png','image'),
    ('mp3','audio/mpeg','audio'),('wav','audio/wav','audio'),('m4a','audio/mp4','audio'),('aac','audio/aac','audio'),
    ('mp4','video/mp4','video'),('mov','video/quicktime','video'),('webm','video/webm','video'),
    ('xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','spreadsheet')
  ) f(e,m,c) where e=ext
$$;
create function public.elladria_reserve_upload(department uuid, folder uuid, file_name text, size_bytes bigint, description text default '') returns jsonb language plpgsql security definer set search_path = '' as $$
declare target uuid:=gen_random_uuid(); ext text; fmt record; used bigint; reserved bigint; capacity bigint; path text;
begin
  perform 1 from public.workspace_settings where id for update;
  perform private.require_manage(department); perform private.assert_folder(department,folder);
  if size_bytes not between 1 and 2000000 or file_name is null or length(btrim(file_name)) not between 1 and 180 or file_name ~ '[/\\[:cntrl:]]' then raise exception 'APP_FILE_VALIDATION'; end if;
  ext:=lower(regexp_replace(file_name,'^.*\.',''));
  select * into fmt from private.file_format(ext);
  if not found then raise exception 'APP_FILE_VALIDATION'; end if;
  select coalesce(sum(file_size_bytes),0) into used from public.files where department_id=department;
  select coalesce(sum(file_size_bytes),0) into reserved from public.upload_reservations where department_id=department;
  select storage_quota_bytes into capacity from public.departments where id=department;
  if used+reserved+size_bytes>capacity then raise exception 'APP_QUOTA'; end if;
  select coalesce(sum(file_size_bytes),0) into used from public.files;
  select coalesce(sum(file_size_bytes),0) into reserved from public.upload_reservations;
  select total_capacity_bytes into capacity from public.workspace_settings where id;
  if used+reserved+size_bytes>capacity then raise exception 'APP_SYSTEM_QUOTA'; end if;
  path:='departments/'||department::text||'/'||target::text||'/original.'||ext;
  insert into public.upload_reservations(id,department_id,folder_id,actor_id,storage_path,file_name,file_size_bytes,mime_type,extension,file_category,description)
  values(target,department,folder,auth.uid(),path,btrim(file_name),size_bytes,fmt.mime,ext,fmt.category,left(description,500));
  return jsonb_build_object('id',target,'storage_path',path,'mime_type',fmt.mime);
end $$;
create function public.elladria_finish_upload(reservation uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.upload_reservations; actual bigint; used bigint; capacity bigint;
begin
  perform 1 from public.workspace_settings where id for update;
  select * into r from public.upload_reservations where id=reservation and actor_id=auth.uid() and status='pending';
  if not found then raise exception 'APP_NOT_FOUND'; end if;
  perform private.require_manage(r.department_id); perform private.assert_folder(r.department_id,r.folder_id);
  select (metadata->>'size')::bigint into actual from storage.objects where bucket_id='company-files' and name=r.storage_path;
  if actual is distinct from r.file_size_bytes then raise exception 'APP_UPLOAD_INCOMPLETE'; end if;
  -- Recheck after a quota reduction or grant revocation while bytes were in flight.
  select coalesce(sum(file_size_bytes),0) into used from public.files where department_id=r.department_id;
  select storage_quota_bytes into capacity from public.departments where id=r.department_id;
  if used+r.file_size_bytes>capacity then raise exception 'APP_QUOTA'; end if;
  select coalesce(sum(file_size_bytes),0) into used from public.files;
  select total_capacity_bytes into capacity from public.workspace_settings where id;
  if used+r.file_size_bytes>capacity then raise exception 'APP_SYSTEM_QUOTA'; end if;
  insert into public.files(id,department_id,folder_id,file_name,original_file_name,storage_path,file_size_bytes,mime_type,extension,file_category,description,uploaded_by)
  values(r.id,r.department_id,r.folder_id,r.file_name,r.file_name,r.storage_path,r.file_size_bytes,r.mime_type,r.extension,r.file_category,r.description,r.actor_id);
  delete from public.upload_reservations where id=r.id;
  perform private.log_event(r.department_id,'uploaded','file',r.id,r.file_name);
  return r.id;
end $$;
create function public.elladria_cancel_upload(reservation uuid) returns void language plpgsql security definer set search_path = '' as $$
declare r public.upload_reservations;
begin
  perform 1 from public.workspace_settings where id for update;
  select * into r from public.upload_reservations where id=reservation;
  if not found then return; end if;
  if r.actor_id is distinct from auth.uid() and private.app_role() is distinct from 'admin' then raise exception 'APP_PERMISSION'; end if;
  if exists(select 1 from storage.objects where bucket_id='company-files' and name=r.storage_path) then raise exception 'APP_CLEANUP_PENDING'; end if;
  -- Keep an abort tombstone through the maximum expected in-flight request window.
  -- A later retry removes any late-arriving object before releasing quota.
  if r.created_at < now()-interval '10 minutes' then
    delete from public.upload_reservations where id=r.id;
  else update public.upload_reservations set status='cancelling' where id=r.id; end if;
end $$;
create function public.elladria_abort_upload(reservation uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.upload_reservations;
begin
  perform 1 from public.workspace_settings where id for update;
  if exists(select 1 from public.files where id=reservation and (uploaded_by=auth.uid() or private.app_role()='admin')) then return jsonb_build_object('committed',true); end if;
  select * into r from public.upload_reservations where id=reservation;
  if not found then raise exception 'APP_NOT_FOUND'; end if;
  if r.actor_id is distinct from auth.uid() and private.app_role() is distinct from 'admin' then raise exception 'APP_PERMISSION'; end if;
  update public.upload_reservations set status='cancelling' where id=r.id;
  return jsonb_build_object('committed',false,'storage_path',r.storage_path);
end $$;

create function public.elladria_begin_delete(target_type text, target_id uuid, confirm_recursive boolean default false) returns jsonb language plpgsql security definer set search_path = '' as $$
declare d uuid; label text; fids uuid[]:='{}'; dirs uuid[]:='{}'; paths text[]:='{}'; job public.deletion_jobs;
begin
  perform 1 from public.workspace_settings where id for update;
  case target_type
    when 'department' then perform private.require_admin(); select id,name into d,label from public.departments where id=target_id;
    when 'folder' then select department_id,name into d,label from public.folders where id=target_id;
    when 'file' then select department_id,file_name into d,label from public.files where id=target_id;
    else raise exception 'APP_INVALID_COMMAND';
  end case;
  if d is null then raise exception 'APP_NOT_FOUND'; end if;
  if not private.can_manage(d) then raise exception 'APP_PERMISSION'; end if;
  select * into job from public.deletion_jobs j where j.department_id=d;
  if found then
    if job.target_type=target_type and job.target_id=target_id then return to_jsonb(job); end if;
    raise exception 'APP_DELETION_PENDING';
  end if;
  if exists(select 1 from public.upload_reservations where department_id=d) then raise exception 'APP_UPLOAD_PENDING'; end if;
  if target_type='department' then
    select coalesce(array_agg(id),'{}') into dirs from public.folders where department_id=d;
    select coalesce(array_agg(id),'{}'),coalesce(array_agg(storage_path),'{}') into fids,paths from public.files where department_id=d;
  elsif target_type='folder' then
    with recursive tree as (select id from public.folders where id=target_id union select f.id from public.folders f join tree t on f.parent_folder_id=t.id)
    select coalesce(array_agg(id),'{}') into dirs from tree;
    select coalesce(array_agg(id),'{}'),coalesce(array_agg(storage_path),'{}') into fids,paths from public.files where folder_id=any(dirs);
    if (cardinality(dirs)>1 or cardinality(fids)>0) and confirm_recursive is distinct from true then raise exception 'APP_CONFIRM_DELETE'; end if;
  else
    select array[id],array[storage_path] into fids,paths from public.files where id=target_id;
  end if;
  insert into public.deletion_jobs(department_id,actor_id,target_type,target_id,target_name,file_ids,folder_ids,storage_paths)
  values(d,auth.uid(),target_type,target_id,label,fids,dirs,paths) returning * into job;
  update public.departments set mutation_lock=job.id where id=d;
  update public.files set status='deleting' where id=any(fids);
  return to_jsonb(job);
end $$;
create function public.elladria_finish_delete(job_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare j public.deletion_jobs;
begin
  perform 1 from public.workspace_settings where id for update;
  select * into j from public.deletion_jobs where id=job_id;
  if not found then return; end if;
  if not private.can_manage(j.department_id) or (j.target_type='department' and private.app_role()<>'admin') then raise exception 'APP_PERMISSION'; end if;
  if exists(select 1 from storage.objects where bucket_id='company-files' and name=any(j.storage_paths)) then raise exception 'APP_CLEANUP_PENDING'; end if;
  delete from public.files where id=any(j.file_ids);
  -- FK NO ACTION is checked after the statement; remove the entire subtree together.
  delete from public.folders where id=any(j.folder_ids);
  delete from public.deletion_jobs where id=j.id;
  update public.departments set mutation_lock=null where id=j.department_id;
  perform private.log_event(j.department_id,case j.target_type when 'file' then 'deleted' else 'deleted '||j.target_type end,j.target_type,j.target_id,j.target_name);
  if j.target_type='department' then delete from public.departments where id=j.department_id; end if;
end $$;

-- Service-only finalization for Auth user provisioning; caller ID comes exclusively
-- from Edge auth.getUser(), never from the request body.
create function public.elladria_provision_profile(actor uuid, target uuid, assigned_role text, department uuid) returns void language plpgsql security definer set search_path = '' as $$
declare label text;
begin
  perform 1 from public.workspace_settings where id for update;
  if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'APP_PERMISSION'; end if;
  if actor=target then raise exception 'APP_SELF_ADMIN'; end if;
  update public.profiles set role=assigned_role,department_id=department where id=target returning display_name into label;
  if not found then raise exception 'APP_NOT_FOUND'; end if;
  insert into public.activity_logs(actor_id,action,target_type,target_id,target_name) values(actor,'added user','user',target,label);
end $$;

revoke execute on function public.elladria_command(jsonb),public.elladria_snapshot(),public.elladria_reserve_upload(uuid,uuid,text,bigint,text),public.elladria_finish_upload(uuid),public.elladria_cancel_upload(uuid),public.elladria_begin_delete(text,uuid,boolean),public.elladria_finish_delete(uuid),public.elladria_provision_profile(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.elladria_command(jsonb),public.elladria_snapshot(),public.elladria_reserve_upload(uuid,uuid,text,bigint,text),public.elladria_finish_upload(uuid),public.elladria_cancel_upload(uuid),public.elladria_begin_delete(text,uuid,boolean),public.elladria_finish_delete(uuid) to authenticated;
revoke execute on function public.elladria_provision_profile(uuid,uuid,text,uuid) from authenticated;
grant execute on function public.elladria_provision_profile(uuid,uuid,text,uuid) to service_role;
revoke execute on function public.elladria_abort_upload(uuid) from public,anon;
grant execute on function public.elladria_abort_upload(uuid) to authenticated;
revoke execute on all functions in schema private from public;
