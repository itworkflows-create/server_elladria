import type { Database, DocumentFile, Role, User } from "../types";
export type BackendRole = "admin" | "executive" | "department_member";
export function mapRole(role: string): Role {
  if (role === "admin") return "Admin";
  if (role === "executive") return "Executive";
  if (role === "department_member") return "Department Member";
  throw new Error("The account has an unsupported role. Contact an administrator.");
}
export function backendRole(role: Role): BackendRole {
  return role === "Admin" ? "admin" : role === "Executive" ? "executive" : "department_member";
}
export function mapPermission(level: string): "View" | "Manage" {
  if (level === "view") return "View";
  if (level === "manage") return "Manage";
  throw new Error("The workspace contains an unsupported permission.");
}
export interface ProfileRow { id: string; display_name: string; email: string; role: string; department_id: string | null }
export function mapProfile(row: ProfileRow): User {
  return { id: row.id, name: row.display_name, email: row.email, role: mapRole(row.role), departmentId: row.department_id ?? undefined, initials: row.display_name.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() };
}
export interface FileRow {
  id: string; department_id: string; folder_id: string | null; file_name: string; original_file_name: string;
  storage_path: string; file_size_bytes: number; mime_type: string; extension: string;
  file_category: DocumentFile["fileCategory"]; uploaded_by: string | null; created_at: string; updated_at: string; description: string; status: string;
}
export function mapFile(row: FileRow): DocumentFile {
  return { id: row.id, departmentId: row.department_id, folderId: row.folder_id, name: row.file_name, originalFileName: row.original_file_name, storageBucket: "company-files", storagePath: row.storage_path, fileSizeBytes: Number(row.file_size_bytes), mimeType: row.mime_type, extension: row.extension, fileCategory: row.file_category, uploadedBy: row.uploaded_by ?? "", date: row.created_at, updatedAt: row.updated_at, content: row.description, pendingDeletion: row.status === "deleting" };
}
export interface Snapshot {
  profiles: ProfileRow[];
  departments: { id: string; name: string; description: string; color: string; storage_quota_bytes: number }[];
  folders: { id: string; department_id: string; parent_folder_id: string | null; name: string; created_by: string | null; created_at: string; updated_at: string }[];
  permissions: { id: string; user_id: string; department_id: string; permission_level: string }[];
  files: FileRow[];
  activities: { id: string; actor_id: string | null; department_id: string | null; action: string; target_name: string; created_at: string }[];
  total_capacity_bytes: number;
  deletion_jobs: { id: string; target_name: string; target_type: string; target_id: string; department_id: string }[];
  upload_reservations: { id: string; file_name: string; created_at: string }[];
}
export function mapSnapshot(raw: Snapshot): Database {
  return {
    users: raw.profiles.map(mapProfile),
    departments: raw.departments.map((d) => ({ id: d.id, name: d.name, description: d.description, color: d.color, storageQuotaBytes: Number(d.storage_quota_bytes), members: raw.profiles.filter((p) => p.department_id === d.id).length })),
    folders: raw.folders.map((f) => ({ id: f.id, departmentId: f.department_id, parentFolderId: f.parent_folder_id, name: f.name, createdBy: f.created_by ?? "", createdAt: f.created_at, updatedAt: f.updated_at })),
    files: raw.files.map(mapFile),
    permissions: raw.permissions.map((g) => ({ id: g.id, userId: g.user_id, departmentId: g.department_id, access: mapPermission(g.permission_level) })),
    activities: raw.activities.map((a) => ({ id: a.id, userId: a.actor_id ?? "", departmentId: a.department_id ?? undefined, action: a.action, target: a.target_name, date: a.created_at })),
    storage: { totalCapacityBytes: Number(raw.total_capacity_bytes) },
    pendingOperations: [
      ...raw.deletion_jobs.map((j) => ({ id: j.id, name: j.target_name, kind: "deletion" as const })),
      ...raw.upload_reservations.filter((r) => Date.now() - Date.parse(r.created_at) > 10 * 60_000).map((r) => ({ id: r.id, name: r.file_name, kind: "upload" as const })),
    ],
  };
}
