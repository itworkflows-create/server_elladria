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
export interface Space {
  id: string;
  departmentId: string;
  name: string;
  description: string;
}
export interface DocumentFile {
  id: string;
  spaceId: string;
  name: string;
  type: "PDF" | "DOCX" | "XLSX" | "PNG";
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
  storage: import("./types/storage").StorageConfiguration;
  users: User[];
  departments: Department[];
  spaces: Space[];
  files: DocumentFile[];
  permissions: Permission[];
  activities: Activity[];
}
