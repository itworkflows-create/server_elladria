import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repository, Command } from "./repository-contract";
import { backendRole, mapFile, mapSnapshot, type Snapshot, type FileRow } from "./supabase-mappers";
import { getSupabase } from "../lib/supabase";
import { edgeError, publicError } from "../lib/service-errors";
export function createSupabaseRepository(client: () => SupabaseClient = getSupabase): Repository {
  return {
    async getDatabase() {
      const { data, error } = await client().rpc("elladria_snapshot");
      if (error) throw publicError(error);
      return mapSnapshot(data as Snapshot);
    },
    async getFile(_userId, fileId) {
      const { data, error } = await client().from("files").select("*").eq("id", fileId).eq("status", "ready").single();
      if (error || !data) throw publicError({ message: "APP_NOT_FOUND" });
      return mapFile(data as FileRow);
    },
    async execute(_userId, command) {
      if (command.kind === "upload") {
        if (!command.file.sourceFile || !command.file.departmentId) throw publicError({ message: "APP_FILE_VALIDATION" });
        const body = new FormData();
        body.set("file", command.file.sourceFile);
        body.set("departmentId", command.file.departmentId);
        body.set("folderId", command.file.folderId ?? "");
        body.set("description", command.file.content);
        const { error } = await client().functions.invoke("workspace-files", { body });
        if (error) throw await edgeError(error);
        return;
      }
      if (["deleteFile", "deleteFolder", "deleteDepartment", "retryOperation"].includes(command.kind)) {
        const { error } = await client().functions.invoke("workspace-files", { body: command });
        if (error) throw await edgeError(error);
        return;
      }
      if (command.kind === "user" || command.kind === "deleteUser") {
        const body = command.kind === "user" ? { ...command, role: backendRole(command.role) } : command;
        const { error } = await client().functions.invoke("manage-users", { body });
        if (error) throw await edgeError(error);
        return;
      }
      const { error } = await client().rpc("elladria_command", { command: mapCommand(command) });
      if (error) throw publicError(error);
    },
  };
}
export function mapCommand(command: Command) {
  if (command.kind === "role") return { ...command, role: backendRole(command.role) };
  if (command.kind === "permission") return { ...command, access: command.access.toLowerCase() };
  return command;
}
