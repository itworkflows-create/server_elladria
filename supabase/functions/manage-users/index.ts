import { clients, cors, failure, json, uuid } from "../_shared/http.ts";
Deno.serve(async request => {
  let headers: Record<string,string> = {};
  try {
    headers=cors(request);
    if(request.method==="OPTIONS") return new Response(null,{headers});
    if(request.method!=="POST") return json({error:"APP_INVALID_COMMAND"},headers,405);
    const { user, service, actor }=await clients(request);
    const profile=await user.from("profiles").select("role").eq("id",actor).single();
    if(profile.error || profile.data?.role!=="admin") throw new Error("APP_PERMISSION");
    const command=await request.json();
    if(command.kind==="user") {
      const { name, email, password, role }=command;
      if(typeof name!=="string" || name.trim().length<2 || name.length>80 || typeof email!=="string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password!=="string" || password.length<12 || password.length>128 || !["admin","executive","department_member"].includes(role)) throw new Error("APP_USER_INPUT");
      const department=command.departmentId ? uuid(command.departmentId) : null;
      if(department) { const exists=await user.from("departments").select("id").eq("id",department).single(); if(exists.error) throw new Error("APP_NOT_FOUND"); }
      const created=await service.auth.admin.createUser({ email:email.trim(), password, email_confirm:true, user_metadata:{display_name:name.trim()} });
      if(created.error || !created.data.user) throw new Error("APP_USER_CREATE");
      const assigned=await service.rpc("elladria_provision_profile",{actor,target:created.data.user.id,assigned_role:role,department});
      if(assigned.error) {
        // Provisioning may have committed despite a lost response. Confirm before
        // compensating, and leave uncertain accounts for Admin reconciliation.
        const check=await service.from("profiles").select("role,department_id").eq("id",created.data.user.id).single();
        if(!check.error && check.data.role===role && check.data.department_id===department) return json({id:created.data.user.id},headers);
        if(!check.error) {
          const authorization=await service.rpc("elladria_authorize_user_delete",{actor,target:created.data.user.id});
          if(!authorization.error) await service.auth.admin.deleteUser(created.data.user.id);
        }
        throw new Error("APP_USER_CREATE");
      }
      return json({id:created.data.user.id},headers);
    }
    if(command.kind==="deleteUser") {
      const target=uuid(command.id);
      if(target===actor) throw new Error("APP_SELF_ADMIN");
      const existing=await user.from("profiles").select("display_name").eq("id",target).single();
      if(existing.error) throw new Error("APP_NOT_FOUND");
      // An Auth trigger serializes deletion, preserves the last Admin and logs
      // the verified actor from a service-only authorization record.
      const authorization=await service.rpc("elladria_authorize_user_delete",{actor,target});
      if(authorization.error) throw authorization.error;
      const removed=await service.auth.admin.deleteUser(target);
      if(removed.error) throw new Error("APP_USER_DELETE");
      return json({ok:true},headers);
    }
    throw new Error("APP_INVALID_COMMAND");
  } catch(error) { return failure(error,headers); }
});
