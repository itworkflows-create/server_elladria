import type { FileMetadata } from "./types/files";
export type Role = "Admin" | "Executive" | "Department Member";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
  initials: string;
}
export interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  members: number;
  storageQuotaBytes: number;
}
export interface Folder {
  id: string;
  departmentId: string;
  name: string;
  parentFolderId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}
export interface DocumentFile extends FileMetadata {
  id: string;
  folderId: string | null;
  name: string;
  fileSizeBytes: number;
  uploadedBy: string;
  date: string;
  content: string;
  dataUrl?: string;
}
export interface Permission {
  id: string;
  userId: string;
  departmentId: string;
  access: "View" | "Manage";
}
export interface Activity {
  id: string;
  userId: string;
  action: string;
  target: string;
  departmentId?: string;
  date: string;
}
export interface Database {
  fileExamplesVersion?: number;
  storage: import("./types/storage").StorageConfiguration;
  users: User[];
  departments: Department[];
  folders: Folder[];
  files: DocumentFile[];
  permissions: Permission[];
  activities: Activity[];
}
