-- Application data. All browser writes go through explicitly authorized RPCs.
create schema if not exists private;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  email text not null default '',
  role text not null default 'department_member' check (role in ('admin','executive','department_member')),
  department_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  description text not null default '', color text not null default 'teal',
  owner_id uuid references public.profiles(id) on delete set null,
  storage_quota_bytes bigint not null default 5000000000 check (storage_quota_bytes between 1 and 9007199254740991),
  created_by uuid references public.profiles(id) on delete set null,
  mutation_lock uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index departments_name_unique on public.departments (lower(btrim(name)));
alter table public.profiles add constraint profiles_department_fk foreign key (department_id) references public.departments(id) on delete set null;
create index profiles_department_idx on public.profiles(department_id);
create table public.department_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  permission_level text not null check (permission_level in ('view','manage')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, department_id)
);
create index permissions_department_idx on public.department_permissions(department_id);
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  parent_folder_id uuid references public.folders(id),
  name text not null check (length(btrim(name)) between 1 and 80 and name not in ('.','..') and name !~ '[/\\[:cntrl:]]'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(parent_folder_id is distinct from id)
);
create unique index folders_sibling_name_unique on public.folders(department_id, parent_folder_id, lower(btrim(name))) where parent_folder_id is not null;
create unique index folders_root_name_unique on public.folders(department_id, lower(btrim(name))) where parent_folder_id is null;
create index folders_parent_idx on public.folders(parent_folder_id);
create table public.files (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  file_name text not null check (length(btrim(file_name)) between 1 and 180 and file_name !~ '[/\\[:cntrl:]]'),
  original_file_name text not null,
  storage_path text not null unique,
  file_size_bytes bigint not null check(file_size_bytes between 1 and 2000000),
  mime_type text not null, extension text not null,
  file_category text not null check(file_category in ('document','image','audio','video','spreadsheet','other')),
  description text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  status text not null default 'ready' check(status in ('ready','deleting')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index files_department_idx on public.files(department_id);
create index files_folder_idx on public.files(folder_id);
create index files_uploader_idx on public.files(uploaded_by);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  action text not null, target_type text, target_id uuid, target_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_department_idx on public.activity_logs(department_id);
create index activity_created_idx on public.activity_logs(created_at desc);
create table public.workspace_settings (
  id boolean primary key default true check(id),
  total_capacity_bytes bigint not null check(total_capacity_bytes between 1 and 9007199254740991)
);
insert into public.workspace_settings values(true,50000000000);
-- Reservations count toward quota until finalized or explicitly cleaned up.
create table public.upload_reservations (
  id uuid primary key,
  department_id uuid not null references public.departments(id),
  folder_id uuid references public.folders(id),
  actor_id uuid references public.profiles(id) on delete set null,
  storage_path text not null unique,
  file_name text not null, file_size_bytes bigint not null check(file_size_bytes between 1 and 2000000),
  mime_type text not null, extension text not null, file_category text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
alter table public.upload_reservations add column status text not null default 'pending' check(status in ('pending','cancelling'));
create index upload_reservations_department_idx on public.upload_reservations(department_id);
-- Durable deletion jobs recover failures between Storage and PostgreSQL.
create table public.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null check(target_type in ('file','folder','department')),
  target_id uuid not null, target_name text not null,
  file_ids uuid[] not null, folder_ids uuid[] not null,
  storage_paths text[] not null,
  created_at timestamptz not null default now()
);
create unique index deletion_department_unique on public.deletion_jobs(department_id);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','departments','department_permissions','folders','files'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end $$;
create function private.handle_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name,email,role)
  values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Member'),80),coalesce(new.email,''),'department_member')
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
create trigger create_profile after insert or update of email on auth.users for each row execute function private.handle_auth_user();
-- Backfill existing Auth accounts without elevating metadata-provided roles.
insert into public.profiles(id,display_name,email)
select id,left(coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(email,'@',1),'Member'),80),coalesce(email,'') from auth.users on conflict(id) do nothing;

create function private.app_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id=auth.uid()
$$;
create function private.can_view(d uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and
    (p.role in ('admin','executive') or p.department_id=d or exists(select 1 from public.department_permissions g where g.user_id=p.id and g.department_id=d)))
$$;
create function private.can_manage(d uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and
    (p.role='admin' or (p.role='department_member' and (p.department_id=d or exists(select 1 from public.department_permissions g where g.user_id=p.id and g.department_id=d and g.permission_level='manage')))))
$$;
create function private.require_manage(d uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage(d) then raise exception 'APP_PERMISSION' using errcode='42501'; end if;
  if not exists(select 1 from public.departments where id=d) then raise exception 'APP_NOT_FOUND'; end if;
  if exists(select 1 from public.departments where id=d and mutation_lock is not null) then raise exception 'APP_DELETION_PENDING'; end if;
end $$;
create function private.require_admin() returns void language plpgsql security definer set search_path = '' as $$
begin if private.app_role() is distinct from 'admin' then raise exception 'APP_PERMISSION' using errcode='42501'; end if; end $$;
create function private.assert_folder(d uuid, f uuid) returns void language plpgsql security definer set search_path = '' as $$
begin if f is not null and not exists(select 1 from public.folders where id=f and department_id=d) then raise exception 'APP_FOLDER_DESTINATION'; end if; end $$;
create function private.log_event(d uuid, action text, typ text, target uuid, label text, metadata jsonb default '{}'::jsonb) returns void language sql security definer set search_path = '' as $$
  insert into public.activity_logs(actor_id,department_id,action,target_type,target_id,target_name,metadata) values(auth.uid(),d,action,typ,target,label,metadata)
$$;
-- Constraints still protect hierarchy when trusted maintenance writes to tables.
create function private.check_hierarchy() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.workspace_settings where id for update;
  if tg_table_name='folders' then
    if tg_op='UPDATE' and new.department_id<>old.department_id then raise exception 'APP_FOLDER_DESTINATION'; end if;
    perform private.assert_folder(new.department_id,new.parent_folder_id);
    if exists(with recursive descendants as (select id from public.folders where parent_folder_id=new.id union select f.id from public.folders f join descendants d on f.parent_folder_id=d.id) select 1 from descendants where id=new.parent_folder_id) or new.parent_folder_id=new.id then raise exception 'APP_FOLDER_CYCLE'; end if;
  else
    if tg_op='UPDATE' and (new.department_id<>old.department_id or new.storage_path<>old.storage_path or new.file_size_bytes<>old.file_size_bytes or new.extension<>old.extension) then raise exception 'APP_FILE_IMMUTABLE'; end if;
    perform private.assert_folder(new.department_id,new.folder_id);
    if lower(regexp_replace(new.file_name,'^.*\.',''))<>new.extension then raise exception 'APP_FILE_EXTENSION'; end if;
  end if;
  return new;
end $$;
create trigger folder_hierarchy before insert or update on public.folders for each row execute function private.check_hierarchy();
create trigger file_hierarchy before insert or update on public.files for each row execute function private.check_hierarchy();

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.department_permissions enable row level security;
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.activity_logs enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.upload_reservations enable row level security;
alter table public.deletion_jobs enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.app_role() in ('admin','executive') or private.can_view(department_id));
create policy departments_read on public.departments for select to authenticated using(private.can_view(id));
create policy permissions_read on public.department_permissions for select to authenticated using(user_id=auth.uid() or private.app_role() in ('admin','executive'));
create policy folders_read on public.folders for select to authenticated using(private.can_view(department_id));
create policy files_read on public.files for select to authenticated using(private.can_view(department_id));
create policy activity_read on public.activity_logs for select to authenticated using(private.app_role() in ('admin','executive') or private.can_view(department_id));
create policy settings_read on public.workspace_settings for select to authenticated using(auth.uid() is not null);
create policy reservations_read on public.upload_reservations for select to authenticated using(actor_id=auth.uid() or private.app_role()='admin');
create policy deletion_jobs_read on public.deletion_jobs for select to authenticated using(actor_id=auth.uid() or private.app_role()='admin');
revoke all on public.profiles,public.departments,public.department_permissions,public.folders,public.files,public.activity_logs,public.workspace_settings,public.upload_reservations,public.deletion_jobs from anon,authenticated;
grant select on public.profiles,public.departments,public.department_permissions,public.folders,public.files,public.activity_logs,public.workspace_settings,public.upload_reservations,public.deletion_jobs to authenticated;
grant all on public.profiles,public.departments,public.department_permissions,public.folders,public.files,public.activity_logs,public.workspace_settings,public.upload_reservations,public.deletion_jobs to service_role;
revoke all on schema private from public;
grant usage on schema private to authenticated,service_role;
revoke execute on all functions in schema private from public;
grant execute on function private.app_role(),private.can_view(uuid),private.can_manage(uuid) to authenticated;
