import { clients, cors, failure, json, uuid } from "../_shared/http.ts";
import { validateIncomingFile } from "../_shared/files.ts";
Deno.serve(async request => {
  let headers: Record<string,string> = {};
  try {
    headers = cors(request);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return json({ error: "APP_INVALID_COMMAND" }, headers, 405);
    const { user, service } = await clients(request);
    const bucket = service.storage.from("company-files");
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (Number(request.headers.get("content-length") ?? 0)>3000000) throw new Error("APP_FILE_VALIDATION");
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("APP_FILE_VALIDATION");
      const mime = validateIncomingFile(file);
      const { data: reservation, error } = await user.rpc("elladria_reserve_upload", { department: uuid(form.get("departmentId")), folder: form.get("folderId") ? uuid(form.get("folderId")) : null, file_name: file.name, size_bytes: file.size, description: String(form.get("description") ?? "").slice(0,500) });
      if (error) throw error;
      try {
        const uploaded = await bucket.upload(reservation.storage_path, file, { contentType: mime, upsert: false });
        if (uploaded.error) throw uploaded.error;
        const finished = await user.rpc("elladria_finish_upload", { reservation: reservation.id });
        if (finished.error) throw finished.error;
        return json({ id: finished.data }, headers);
      } catch (uploadError) {
        // Serialize abort against finalization: never delete an object whose
        // metadata committed but whose success response was lost in transit.
        const abort = await user.rpc("elladria_abort_upload", { reservation: reservation.id });
        if (abort.error) throw new Error("APP_CLEANUP_PENDING");
        if (abort.data.committed) return json({ id: reservation.id }, headers);
        const removed = await bucket.remove([reservation.storage_path]);
        if (removed.error) throw new Error("APP_CLEANUP_PENDING");
        const cancelled = await user.rpc("elladria_cancel_upload", { reservation: reservation.id });
        if (cancelled.error) throw new Error("APP_CLEANUP_PENDING");
        throw uploadError;
      }
    }
    const command = await request.json();
    if (command.kind === "retryOperation" && command.operation === "upload") {
      const id = uuid(command.id);
      const { data: reservation, error } = await user.from("upload_reservations").select("id,created_at").eq("id",id).single();
      if (error || !reservation) throw new Error("APP_NOT_FOUND");
      if (Date.now()-Date.parse(reservation.created_at)<10*60_000) throw new Error("APP_UPLOAD_PENDING");
      const abort = await user.rpc("elladria_abort_upload", { reservation: id });
      if (abort.error) throw abort.error;
      if (!abort.data.committed) {
        const removed = await bucket.remove([abort.data.storage_path]);
        if (removed.error) throw new Error("APP_CLEANUP_PENDING");
        const cancelled = await user.rpc("elladria_cancel_upload", { reservation: id });
        if (cancelled.error) throw cancelled.error;
      }
      return json({ ok: true }, headers);
    }
    let targetType: string; let targetId: string; let confirmed = command.confirmRecursive === true;
    if (command.kind === "retryOperation" && command.operation === "deletion") {
      const { data: job, error } = await user.from("deletion_jobs").select("target_type,target_id").eq("id",uuid(command.id)).single();
      if (error || !job) throw new Error("APP_NOT_FOUND");
      targetType=job.target_type; targetId=job.target_id; confirmed=true;
    } else {
      targetType = ({ deleteFile: "file", deleteFolder: "folder", deleteDepartment: "department" } as Record<string,string>)[command.kind];
      if (!targetType) throw new Error("APP_INVALID_COMMAND");
      targetId=uuid(command.id);
    }
    const { data: job, error } = await user.rpc("elladria_begin_delete", { target_type: targetType, target_id: targetId, confirm_recursive: confirmed });
    if (error) throw error;
    // Retry remains safe if a previous batch succeeded: Storage remove is idempotent.
    for (let i=0; i<job.storage_paths.length; i+=100) {
      const removed = await bucket.remove(job.storage_paths.slice(i,i+100));
      if (removed.error) throw new Error("APP_CLEANUP_PENDING");
    }
    const finished = await user.rpc("elladria_finish_delete", { job_id: job.id });
    if (finished.error) throw finished.error;
    return json({ ok: true }, headers);
  } catch (error) { return failure(error,headers); }
});
