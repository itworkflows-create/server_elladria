create table private.user_deletion_authorizations (
  target_id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
create function public.elladria_authorize_user_delete(actor uuid,target uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.workspace_settings where id for update;
  if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'APP_PERMISSION'; end if;
  if actor=target then raise exception 'APP_SELF_ADMIN'; end if;
  if not exists(select 1 from public.profiles where id=target) then raise exception 'APP_NOT_FOUND'; end if;
  insert into private.user_deletion_authorizations(target_id,actor_id,expires_at) values(target,actor,now()+interval '1 minute')
  on conflict(target_id) do update set actor_id=excluded.actor_id,expires_at=excluded.expires_at;
end $$;
create function private.guard_auth_user_deletion() returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; label text;
begin
  perform 1 from public.workspace_settings where id for update;
  select a.actor_id into actor from private.user_deletion_authorizations a join public.profiles p on p.id=a.actor_id where a.target_id=old.id and a.expires_at>now() and p.role='admin';
  if actor is null then raise exception 'APP_PERMISSION'; end if;
  if actor=old.id then raise exception 'APP_SELF_ADMIN'; end if;
  if exists(select 1 from public.profiles where id=old.id and role='admin') and (select count(*) from public.profiles where role='admin')<=1 then raise exception 'APP_LAST_ADMIN'; end if;
  if exists(select 1 from public.upload_reservations where actor_id=old.id) then raise exception 'APP_UPLOAD_PENDING'; end if;
  select display_name into label from public.profiles where id=old.id;
  insert into public.activity_logs(actor_id,action,target_type,target_id,target_name) values(actor,'removed user','user',old.id,label);
  delete from private.user_deletion_authorizations where target_id=old.id;
  return old;
end $$;
create trigger guard_auth_user_deletion before delete on auth.users for each row execute function private.guard_auth_user_deletion();
revoke all on private.user_deletion_authorizations from public,anon,authenticated;
revoke execute on function public.elladria_authorize_user_delete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.elladria_authorize_user_delete(uuid,uuid) to service_role;
revoke execute on function private.guard_auth_user_deletion() from public;
