import type { Database, User } from "../types";
export function canView(user: User, departmentId: string, db: Database) {
  return (
    user.role !== "Department Member" ||
    user.departmentId === departmentId ||
    db.permissions.some(
      (p) => p.userId === user.id && p.departmentId === departmentId,
    )
  );
}
export function canManage(user: User, departmentId: string, db: Database) {
  return (
    user.role === "Admin" ||
    (user.role === "Department Member" &&
      (user.departmentId === departmentId ||
        db.permissions.some(
          (p) =>
            p.userId === user.id &&
            p.departmentId === departmentId &&
            p.access === "Manage",
        )))
  );
}
export const canAdmin = (user: User) => user.role === "Admin";
export const canViewLogs = (user: User) => user.role !== "Department Member";
