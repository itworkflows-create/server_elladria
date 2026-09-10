import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const ids = { admin: "10000000-0000-4000-8000-000000000001", executive: "10000000-0000-4000-8000-000000000002", member: "10000000-0000-4000-8000-000000000003", guest: "10000000-0000-4000-8000-000000000004", design: "20000000-0000-4000-8000-000000000001", finance: "20000000-0000-4000-8000-000000000002" };
let db: PGlite;
async function act<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    return (await tx.query<T>(sql,params)).rows;
  });
}
const command = (user: string, cmd: object) => act(user,"select public.elladria_command($1::jsonb)",[JSON.stringify(cmd)]);
async function folder(name: string, parent: string | null = null, department=ids.design) {
  await command(ids.admin,{kind:"createFolder",departmentId:department,parentFolderId:parent,name});
  return (await db.query<{id:string}>("select id from folders where name=$1 and department_id=$2 and parent_folder_id is not distinct from $3::uuid",[name,department,parent])).rows[0].id;
}
async function reserve(user=ids.member,size=10,folderId:string|null=null) {
  return (await act<{r:{id:string;storage_path:string}}>(user,"select elladria_reserve_upload($1,$2,'Contract.pdf',$3,'') r",[ids.design,folderId,size]))[0].r;
}
async function finish(r:{id:string;storage_path:string}, user=ids.member,size=10) {
  await db.query<Record<string, unknown>>("insert into storage.objects(bucket_id,name,metadata) values('company-files',$1,$2::jsonb)",[r.storage_path,JSON.stringify({size})]);
  return act(user,"select elladria_finish_upload($1)",[r.id]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select on storage.objects to authenticated;
    grant all on storage.objects,storage.buckets to service_role;
  `);
  for (const migration of ["202609100001_schema.sql","202609100002_commands.sql","202609100003_storage.sql","202609100004_user_deletion.sql"])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${migration}`,import.meta.url),"utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("truncate public.profiles,public.departments,public.folders,public.files,public.department_permissions,public.activity_logs,public.upload_reservations,public.deletion_jobs,auth.users,storage.objects restart identity cascade");
  await db.query<Record<string, unknown>>("update workspace_settings set total_capacity_bytes=50000000000");
  for (const [name,id] of Object.entries(ids).filter(([name])=>!["design","finance"].includes(name)))
    await db.query<Record<string, unknown>>("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",[id,`${name}@example.test`,JSON.stringify({display_name:name,role:"admin"})]);
  await db.query<Record<string, unknown>>("update profiles set role='admin' where id=$1",[ids.admin]);
  await db.query<Record<string, unknown>>("update profiles set role='executive' where id=$1",[ids.executive]);
  await db.query<Record<string, unknown>>("insert into departments(id,name) values($1,'Design'),($2,'Finance')",[ids.design,ids.finance]);
  await db.query<Record<string, unknown>>("update profiles set department_id=$1 where id=$2",[ids.design,ids.member]);
});
afterAll(async () => { await db?.close(); });
describe("Supabase migrations and actual PostgreSQL RLS (offline auth/storage stubs)", () => {
  it("creates profiles without trusting metadata roles and blocks direct privilege escalation", async () => {
    expect((await act(ids.guest,"select role from profiles where id=auth.uid()"))[0].role).toBe("department_member");
    await expect(act(ids.guest,"update profiles set role='admin' where id=auth.uid()")).rejects.toThrow(/permission denied/i);
    await expect(act(ids.guest,"insert into department_permissions(user_id,department_id,permission_level) values($1,$2,'manage')",[ids.guest,ids.design])).rejects.toThrow(/permission denied/i);
    await expect(act(ids.guest,"select elladria_provision_profile($1,$2,'admin',null)",[ids.admin,ids.guest])).rejects.toThrow(/permission denied/i);
    expect(await act(ids.guest,"select * from departments")).toHaveLength(0);
    expect(await act(ids.executive,"select * from departments")).toHaveLength(2);
    await expect(command(ids.executive,{kind:"quota",departmentId:ids.design,storageQuotaBytes:10})).rejects.toThrow("APP_PERMISSION");
  });
  it("enforces own-department, shared View/Manage and revoked access for folder RPCs", async () => {
    const f=await folder("Private");
    await expect(command(ids.guest,{kind:"renameFolder",id:f,name:"Denied"})).rejects.toThrow("APP_PERMISSION");
    await command(ids.admin,{kind:"permission",userId:ids.guest,departmentId:ids.design,access:"view"});
    expect(await act(ids.guest,"select * from folders")).toHaveLength(1);
    await expect(command(ids.guest,{kind:"moveFolder",id:f,parentFolderId:null})).rejects.toThrow("APP_PERMISSION");
    await expect(command(ids.executive,{kind:"renameFolder",id:f,name:"Denied"})).rejects.toThrow("APP_PERMISSION");
    await command(ids.admin,{kind:"permission",userId:ids.guest,departmentId:ids.design,access:"manage"});
    await command(ids.guest,{kind:"renameFolder",id:f,name:"Shared"});
    const grant=(await db.query<{id:string}>("select id from department_permissions")).rows[0].id;
    await command(ids.admin,{kind:"revoke",id:grant});
    expect(await act(ids.guest,"select * from folders")).toHaveLength(0);
    await expect(command(ids.guest,{kind:"renameFolder",id:f,name:"Denied"})).rejects.toThrow("APP_PERMISSION");
  });
  it("enforces sibling uniqueness, same-department parents, self/descendant moves and extension preservation", async () => {
    const a=await folder("A"), b=await folder("B",a), c=await folder("C",b), other=await folder("Other",null,ids.finance);
    await expect(folder("a")).rejects.toThrow(/duplicate key/i);
    await expect(folder("B",a)).rejects.toThrow(/duplicate key/i);
    await folder("B",c);
    for(const parent of [a,b,c]) await expect(command(ids.admin,{kind:"moveFolder",id:a,parentFolderId:parent})).rejects.toThrow("APP_FOLDER_CYCLE");
    await expect(command(ids.admin,{kind:"moveFolder",id:a,parentFolderId:other})).rejects.toThrow("APP_FOLDER_DESTINATION");
    await command(ids.member,{kind:"moveFolder",id:c,parentFolderId:null});
    expect((await db.query<Record<string, unknown>>("select parent_folder_id from folders where id=$1",[c])).rows[0].parent_folder_id).toBeNull();
    const r=await reserve(); await finish(r);
    await expect(command(ids.member,{kind:"renameFile",id:r.id,name:"Contract.exe"})).rejects.toThrow("APP_FILE_EXTENSION");
  });
  it("reserves quota before uploads and validates object size and permission again on finalization", async () => {
    await command(ids.admin,{kind:"quota",departmentId:ids.design,storageQuotaBytes:15});
    const first=await reserve();
    await expect(reserve()).rejects.toThrow("APP_QUOTA");
    await expect(act(ids.member,"select elladria_finish_upload($1)",[first.id])).rejects.toThrow("APP_UPLOAD_INCOMPLETE");
    await finish(first);
    expect((await db.query<Record<string, unknown>>("select sum(file_size_bytes) used from files")).rows[0].used).toBe("10");
    await expect(reserve(ids.executive)).rejects.toThrow("APP_PERMISSION");
    await command(ids.admin,{kind:"permission",userId:ids.guest,departmentId:ids.design,access:"manage"});
    const pending=await reserve(ids.guest,5);
    await command(ids.admin,{kind:"permission",userId:ids.guest,departmentId:ids.design,access:"view"});
    await expect(finish(pending,ids.guest,5)).rejects.toThrow("APP_PERMISSION");
    expect((await db.query<Record<string, unknown>>("select count(*) n from files")).rows[0].n).toBe(1);
  });
  it("checks system capacity and capacity reductions before metadata commit", async () => {
    await db.query<Record<string, unknown>>("update workspace_settings set total_capacity_bytes=15");
    const first=await reserve();
    await expect(reserve()).rejects.toThrow("APP_SYSTEM_QUOTA");
    await command(ids.admin,{kind:"quota",departmentId:ids.design,storageQuotaBytes:5});
    await expect(finish(first)).rejects.toThrow("APP_QUOTA");
    expect((await db.query<Record<string, unknown>>("select count(*) n from files")).rows[0].n).toBe(0);
  });
  it("keeps storage private and prevents guessed paths, uncommitted objects and direct writes", async () => {
    const r=await reserve(); await finish(r);
    expect((await db.query<Record<string, unknown>>("select public from storage.buckets where id='company-files'")).rows[0].public).toBe(false);
    expect(await act(ids.guest,"select * from storage.objects")).toHaveLength(0);
    expect(await act(ids.member,"select * from storage.objects")).toHaveLength(1);
    expect(await act(ids.executive,"select * from storage.objects")).toHaveLength(1);
    await expect(act(ids.member,"insert into storage.objects(bucket_id,name) values('company-files','guessed')")).rejects.toThrow(/permission denied/i);
    await db.query<Record<string, unknown>>("insert into storage.objects(bucket_id,name,metadata) values('company-files','uncommitted','{}')");
    expect(await act(ids.admin,"select * from storage.objects")).toHaveLength(1);
  });
  it("keeps quota unchanged on file/folder moves and logs every mutation", async () => {
    const a=await folder("A"), b=await folder("B",a); const r=await reserve(ids.member,10,b); await finish(r);
    await command(ids.member,{kind:"moveFile",id:r.id,folderId:null});
    await command(ids.member,{kind:"moveFolder",id:b,parentFolderId:null});
    const row=(await db.query<Record<string, unknown>>("select folder_id,file_size_bytes,storage_path from files where id=$1",[r.id])).rows[0];
    expect(row).toMatchObject({folder_id:null,file_size_bytes:10,storage_path:r.storage_path});
    expect((await act(ids.member,"select action from activity_logs")).map(a=>a.action)).toEqual(expect.arrayContaining(["created folder","uploaded","moved file","moved folder"]));
    expect(await act(ids.guest,"select * from activity_logs")).toHaveLength(0);
  });
  it("protects nonempty deletion and recovers deletion only after object cleanup", async () => {
    const a=await folder("A"), b=await folder("B",a);const r=await reserve(ids.member,10,b);await finish(r);
    await expect(act(ids.member,"select elladria_begin_delete('folder',$1,false)",[a])).rejects.toThrow("APP_CONFIRM_DELETE");
    const job=(await act<{j:{id:string}}>(ids.member,"select elladria_begin_delete('folder',$1,true) j",[a]))[0].j;
    await expect(command(ids.member,{kind:"createFolder",name:"Blocked",departmentId:ids.design,parentFolderId:null})).rejects.toThrow("APP_DELETION_PENDING");
    await expect(act(ids.member,"select elladria_finish_delete($1)",[job.id])).rejects.toThrow("APP_CLEANUP_PENDING");
    expect(await act(ids.member,"select * from storage.objects")).toHaveLength(0);
    expect((await db.query<Record<string, unknown>>("select sum(file_size_bytes) used from files")).rows[0].used).toBe("10");
    await db.query<Record<string, unknown>>("delete from storage.objects where name=$1",[r.storage_path]);
    await act(ids.member,"select elladria_finish_delete($1)",[job.id]);
    expect(await act(ids.member,"select * from folders")).toHaveLength(0);
    expect(await act(ids.member,"select * from files")).toHaveLength(0);
    expect(await act(ids.member,"select * from deletion_jobs")).toHaveLength(0);
  });
  it("serializes upload abort against commit and retains a cleanup tombstone", async () => {
    const r=await reserve();
    await act(ids.member,"select elladria_abort_upload($1)",[r.id]);
    await expect(finish(r)).rejects.toThrow("APP_NOT_FOUND");
    await expect(act(ids.member,"select elladria_cancel_upload($1)",[r.id])).rejects.toThrow("APP_CLEANUP_PENDING");
    await db.query<Record<string, unknown>>("delete from storage.objects where name=$1",[r.storage_path]);
    await act(ids.member,"select elladria_cancel_upload($1)",[r.id]);
    expect((await db.query<Record<string, unknown>>("select status from upload_reservations where id=$1",[r.id])).rows[0].status).toBe("cancelling");
    await db.query<Record<string, unknown>>("update upload_reservations set created_at=now()-interval '11 minutes' where id=$1",[r.id]);
    await act(ids.member,"select elladria_cancel_upload($1)",[r.id]);
    expect((await db.query<Record<string, unknown>>("select * from upload_reservations")).rows).toHaveLength(0);
    const good=await reserve(); await finish(good);
    expect((await act<{r:{committed:boolean}}>(ids.member,"select elladria_abort_upload($1) r",[good.id]))[0].r.committed).toBe(true);
  });
  it("allows a member to create one owned department and prevents Executive creation", async () => {
    await command(ids.guest,{kind:"department",name:"Own team",description:"Test"});
    await expect(command(ids.guest,{kind:"department",name:"Another",description:"Test"})).rejects.toThrow("APP_DEPARTMENT_LIMIT");
    expect((await db.query<Record<string, unknown>>("select owner_id from departments where name='Own team'")).rows[0].owner_id).toBe(ids.guest);
    await expect(command(ids.executive,{kind:"department",name:"Denied"})).rejects.toThrow("APP_DEPARTMENT_LIMIT");
    await expect(command(ids.admin,{kind:"role",id:ids.admin,role:"department_member"})).rejects.toThrow("APP_SELF_ADMIN");
    await expect(command(ids.guest,{kind:"role",id:ids.guest,role:"admin"})).rejects.toThrow("APP_PERMISSION");
  });
  it("guards user deletion inside the Auth transaction and retains uploaded files", async () => {
    const r=await reserve();await finish(r);
    await expect(db.query<Record<string, unknown>>("delete from auth.users where id=$1",[ids.admin])).rejects.toThrow("APP_PERMISSION");
    await expect(act(ids.member,"select elladria_authorize_user_delete($1,$2)",[ids.admin,ids.member])).rejects.toThrow(/permission denied/i);
    await db.query<Record<string, unknown>>("select elladria_authorize_user_delete($1,$2)",[ids.admin,ids.member]);
    await db.query<Record<string, unknown>>("delete from auth.users where id=$1",[ids.member]);
    expect((await db.query<Record<string, unknown>>("select uploaded_by from files where id=$1",[r.id])).rows[0].uploaded_by).toBeNull();
    expect((await db.query<Record<string, unknown>>("select action from activity_logs where action='removed user'")).rows).toHaveLength(1);
  });
});
