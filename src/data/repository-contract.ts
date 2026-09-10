import type { Database, DocumentFile, Permission, Role } from "../types";
export type Command =
  | { kind: "retryOperation"; id: string; operation: "upload" | "deletion" }
  | { kind: "quota"; departmentId: string; storageQuotaBytes: number }
  | { kind: "department"; name: string; description: string }
  | {
      kind: "createFolder";
      name: string;
      departmentId: string;
      parentFolderId: string | null;
    }
  | { kind: "renameFolder"; id: string; name: string }
  | { kind: "moveFolder"; id: string; parentFolderId: string | null }
  | { kind: "deleteFolder"; id: string; confirmRecursive?: boolean }
  | { kind: "moveFile"; id: string; folderId: string | null }
  | {
      kind: "upload";
      file: Pick<
        DocumentFile,
        "folderId" | "name" | "fileSizeBytes" | "content"
      > & { departmentId?: string; mimeType?: string; dataUrl?: string; sourceFile?: File };
    }
  | { kind: "deleteFile"; id: string }
  | { kind: "renameFile"; id: string; name: string }
  | { kind: "deleteDepartment"; id: string }
  | { kind: "renameDepartment"; id: string; name: string }
  | {
      kind: "user";
      name: string;
      email: string;
      password?: string;
      role: Role;
      departmentId?: string;
    }
  | { kind: "role"; id: string; role: Role }
  | { kind: "deleteUser"; id: string }
  | {
      kind: "permission";
      userId: string;
      departmentId: string;
      access: Permission["access"];
    }
  | { kind: "revoke"; id: string }
  | { kind: "profile"; name: string };
export interface Repository {
  getDatabase(): Promise<Database>;
  getFile(userId: string, fileId: string): Promise<DocumentFile>;
  execute(userId: string, command: Command): Promise<void>;
}
