import { seed } from "./seed";
import { canAdmin, canManage } from "../lib/access";
import type { Database, DocumentFile, Permission, Role, User } from "../types";
const KEY = "elladria-demo-v1";
function read(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (
        parsed.users?.length &&
        parsed.departments &&
        parsed.spaces &&
        parsed.files &&
        parsed.permissions &&
        parsed.activities
      )
        return parsed;
    }
  } catch {
    /* Start fresh if browser data is unavailable. */
  }
  return structuredClone(seed);
}
let database = read();
export type Command =
  | { kind: "department"; name: string; description: string }
  | { kind: "space"; name: string; description: string; departmentId: string }
  | { kind: "upload"; file: Omit<DocumentFile, "id" | "date" | "uploadedBy"> }
  | { kind: "deleteFile"; id: string }
  | { kind: "renameFile"; id: string; name: string }
  | { kind: "deleteDepartment"; id: string }
  | { kind: "renameDepartment"; id: string; name: string }
  | {
      kind: "user";
      name: string;
      email: string;
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
  execute(userId: string, command: Command): Promise<void>;
}
export const repository: Repository = {
  async getDatabase() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return structuredClone(database);
  },
  async execute(userId, command) {
    const db = structuredClone(database);
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("Please sign in again.");
    const requireAdmin = () => {
      if (!canAdmin(user)) throw new Error("Administrator access required.");
    };
    const requireManage = (id: string) => {
      if (!canManage(user, id, db))
        throw new Error(
          "You do not have permission to manage this department.",
        );
    };
    let target = "";
    let departmentId: string | undefined;
    switch (command.kind) {
      case "department": {
        if (
          user.role === "Executive" ||
          (user.role === "Department Member" && user.departmentId)
        )
          throw new Error(
            "You already belong to a department or cannot create one.",
          );
        const id = crypto.randomUUID();
        db.departments.push({
          id,
          name: command.name,
          description: command.description,
          color: "teal",
          members: 1,
        });
        if (user.role === "Department Member") user.departmentId = id;
        target = command.name;
        departmentId = id;
        break;
      }
      case "space":
        requireManage(command.departmentId);
        db.spaces.push({
          id: crypto.randomUUID(),
          name: command.name,
          description: command.description,
          departmentId: command.departmentId,
        });
        target = command.name;
        departmentId = command.departmentId;
        break;
      case "upload": {
        const space = db.spaces.find((s) => s.id === command.file.spaceId);
        if (!space) throw new Error("Select a storage space.");
        requireManage(space.departmentId);
        db.files.unshift({
          ...command.file,
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          uploadedBy: user.id,
        });
        target = command.file.name;
        departmentId = space.departmentId;
        break;
      }
      case "deleteFile":
      case "renameFile": {
        const file = db.files.find((f) => f.id === command.id);
        if (!file) throw new Error("File not found.");
        departmentId = db.spaces.find(
          (s) => s.id === file.spaceId,
        )?.departmentId;
        requireManage(departmentId ?? "");
        target = file.name;
        if (command.kind === "deleteFile")
          db.files = db.files.filter((f) => f.id !== command.id);
        else file.name = command.name;
        break;
      }
      case "deleteDepartment": {
        requireAdmin();
        const department = db.departments.find((d) => d.id === command.id);
        if (!department) throw new Error("Department not found.");
        target = department.name;
        const spaceIds = new Set(
          db.spaces
            .filter((s) => s.departmentId === command.id)
            .map((s) => s.id),
        );
        db.files = db.files.filter((f) => !spaceIds.has(f.spaceId));
        db.spaces = db.spaces.filter((s) => s.departmentId !== command.id);
        db.departments = db.departments.filter((d) => d.id !== command.id);
        db.permissions = db.permissions.filter(
          (p) => p.departmentId !== command.id,
        );
        db.users.forEach((u) => {
          if (u.departmentId === command.id) u.departmentId = undefined;
        });
        break;
      }
      case "renameDepartment": {
        requireAdmin();
        const d = db.departments.find((d) => d.id === command.id);
        if (!d) throw new Error("Department not found.");
        d.name = command.name;
        target = command.name;
        departmentId = d.id;
        break;
      }
      case "user": {
        requireAdmin();
        if (
          db.users.some(
            (u) => u.email.toLowerCase() === command.email.toLowerCase(),
          )
        )
          throw new Error("A user with this email already exists.");
        const initials = command.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        db.users.push({
          id: crypto.randomUUID(),
          name: command.name,
          email: command.email,
          role: command.role,
          departmentId: command.departmentId || undefined,
          initials,
        });
        target = command.name;
        break;
      }
      case "role": {
        requireAdmin();
        if (command.id === user.id)
          throw new Error("You cannot change your own administrator role.");
        const u = db.users.find((u) => u.id === command.id);
        if (!u) throw new Error("User not found.");
        u.role = command.role;
        target = `${u.name} → ${command.role}`;
        break;
      }
      case "deleteUser": {
        requireAdmin();
        if (command.id === user.id)
          throw new Error("You cannot remove yourself.");
        target = db.users.find((u) => u.id === command.id)?.name ?? "";
        db.users = db.users.filter((u) => u.id !== command.id);
        db.permissions = db.permissions.filter((p) => p.userId !== command.id);
        break;
      }
      case "permission": {
        requireAdmin();
        const recipient = db.users.find((u) => u.id === command.userId);
        if (
          !recipient ||
          recipient.role !== "Department Member" ||
          recipient.departmentId === command.departmentId ||
          !db.departments.some((d) => d.id === command.departmentId)
        )
          throw new Error("Select a department member and another department.");
        db.permissions = db.permissions.filter(
          (p) =>
            !(
              p.userId === command.userId &&
              p.departmentId === command.departmentId
            ),
        );
        db.permissions.push({
          id: crypto.randomUUID(),
          userId: command.userId,
          departmentId: command.departmentId,
          access: command.access,
        });
        target = `${recipient.name} · ${command.access} access`;
        departmentId = command.departmentId;
        break;
      }
      case "revoke":
        requireAdmin();
        target = "Department access";
        db.permissions = db.permissions.filter((p) => p.id !== command.id);
        break;
      case "profile":
        user.name = command.name;
        user.initials = command.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        target = user.name;
        break;
    }
    db.activities.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      action: {
        department: "created department",
        space: "created storage space",
        upload: "uploaded",
        deleteFile: "deleted",
        renameFile: "renamed",
        deleteDepartment: "deleted department",
        renameDepartment: "renamed department",
        user: "added user",
        role: "changed role",
        deleteUser: "removed user",
        permission: "granted access to",
        revoke: "revoked",
        profile: "updated profile",
      }[command.kind],
      target,
      departmentId,
      date: new Date().toISOString(),
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      throw new Error(
        "Browser storage is full. Try a smaller file or remove an uploaded file.",
      );
    }
    database = db;
  },
};
export const demoUsers: User[] = seed.users;
