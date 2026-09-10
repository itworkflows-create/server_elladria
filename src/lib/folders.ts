import type { Database, Folder, User } from "../types";
import { canManage, canView } from "./access";

export function requireFolderAccess(
  db: Database,
  user: User,
  departmentId: string,
  write = false,
) {
  if (!db.departments.some((d) => d.id === departmentId))
    throw new Error("Department not found.");
  if (
    !(write
      ? canManage(user, departmentId, db)
      : canView(user, departmentId, db))
  )
    throw new Error("You do not have permission to access this department.");
}
export function getFolder(db: Database, user: User, id: string): Folder {
  const folder = db.folders.find((f) => f.id === id);
  if (!folder) throw new Error("Folder not found.");
  requireFolderAccess(db, user, folder.departmentId);
  return folder;
}
export function validateDestination(
  db: Database,
  departmentId: string,
  parentFolderId: string | null,
) {
  if (
    parentFolderId !== null &&
    !db.folders.some(
      (f) => f.id === parentFolderId && f.departmentId === departmentId,
    )
  )
    throw new Error("Choose a folder in the same department.");
}
export function getChildFolders(
  db: Database,
  user: User,
  departmentId: string,
  parentFolderId: string | null,
) {
  requireFolderAccess(db, user, departmentId);
  validateDestination(db, departmentId, parentFolderId);
  return db.folders
    .filter(
      (f) =>
        f.departmentId === departmentId && f.parentFolderId === parentFolderId,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function getFolderBreadcrumbs(
  db: Database,
  user: User,
  folderId: string | null,
): Folder[] {
  const result: Folder[] = [];
  const seen = new Set<string>();
  let id = folderId;
  while (id !== null) {
    if (seen.has(id)) throw new Error("Circular folder relationship.");
    seen.add(id);
    const folder = getFolder(db, user, id);
    if (result.length && result[0].departmentId !== folder.departmentId)
      throw new Error("Invalid folder department.");
    result.unshift(folder);
    id = folder.parentFolderId;
  }
  return result;
}
export function getDescendantIds(db: Database, folderId: string): Set<string> {
  const ids = new Set([folderId]);
  const queue = [folderId];
  for (let i = 0; i < queue.length; i++) {
    for (const child of db.folders.filter(
      (f) => f.parentFolderId === queue[i],
    )) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return ids;
}
export function getFilesByFolder(
  db: Database,
  user: User,
  departmentId: string,
  folderId: string | null,
) {
  requireFolderAccess(db, user, departmentId);
  validateDestination(db, departmentId, folderId);
  return db.files.filter(
    (f) => f.departmentId === departmentId && f.folderId === folderId,
  );
}
export function validateFolderName(
  db: Database,
  departmentId: string,
  parentFolderId: string | null,
  name: string,
  exceptId?: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80)
    return "Use a folder name between 1 and 80 characters.";
  if (
    /[\\/]/.test(trimmed) ||
    [...trimmed].some((character) => character.charCodeAt(0) < 32) ||
    trimmed === "." ||
    trimmed === ".."
  )
    return "Folder names cannot contain slashes, control characters, or be . or ..";
  if (
    db.folders.some(
      (f) =>
        f.id !== exceptId &&
        f.departmentId === departmentId &&
        f.parentFolderId === parentFolderId &&
        f.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
  )
    return "A folder with this name already exists in this location.";
  return null;
}
function checkName(
  db: Database,
  departmentId: string,
  parentFolderId: string | null,
  name: string,
  exceptId?: string,
) {
  const error = validateFolderName(
    db,
    departmentId,
    parentFolderId,
    name,
    exceptId,
  );
  if (error) throw new Error(error);
}
export function createFolder(
  db: Database,
  user: User,
  departmentId: string,
  parentFolderId: string | null,
  name: string,
) {
  requireFolderAccess(db, user, departmentId, true);
  validateDestination(db, departmentId, parentFolderId);
  getFolderBreadcrumbs(db, user, parentFolderId);
  checkName(db, departmentId, parentFolderId, name);
  const now = new Date().toISOString();
  const folder: Folder = {
    id: crypto.randomUUID(),
    departmentId,
    parentFolderId,
    name: name.trim(),
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  };
  db.folders.push(folder);
  return folder;
}
export function renameFolder(
  db: Database,
  user: User,
  id: string,
  name: string,
) {
  const folder = getFolder(db, user, id);
  requireFolderAccess(db, user, folder.departmentId, true);
  checkName(db, folder.departmentId, folder.parentFolderId, name, id);
  folder.name = name.trim();
  folder.updatedAt = new Date().toISOString();
  return folder;
}
export function moveFolder(
  db: Database,
  user: User,
  id: string,
  parentFolderId: string | null,
) {
  const folder = getFolder(db, user, id);
  requireFolderAccess(db, user, folder.departmentId, true);
  validateDestination(db, folder.departmentId, parentFolderId);
  if (parentFolderId !== null && getDescendantIds(db, id).has(parentFolderId))
    throw new Error("Cannot move a folder into itself or a descendant.");
  getFolderBreadcrumbs(db, user, parentFolderId);
  checkName(db, folder.departmentId, parentFolderId, folder.name, id);
  folder.parentFolderId = parentFolderId;
  folder.updatedAt = new Date().toISOString();
  return folder;
}
export function deleteFolder(
  db: Database,
  user: User,
  id: string,
  confirmRecursive = false,
) {
  const folder = getFolder(db, user, id);
  requireFolderAccess(db, user, folder.departmentId, true);
  const ids = getDescendantIds(db, id);
  const files = db.files.filter(
    (f) => f.folderId !== null && ids.has(f.folderId),
  );
  if ((ids.size > 1 || files.length > 0) && confirmRecursive !== true)
    throw new Error(
      "This folder contains files or subfolders. Explicit confirmation is required.",
    );
  db.files = db.files.filter(
    (f) => f.folderId === null || !ids.has(f.folderId),
  );
  db.folders = db.folders.filter((f) => !ids.has(f.id));
  return folder;
}
export function moveFile(
  db: Database,
  user: User,
  id: string,
  folderId: string | null,
) {
  const file = db.files.find((f) => f.id === id);
  if (!file) throw new Error("File not found.");
  requireFolderAccess(db, user, file.departmentId, true);
  validateDestination(db, file.departmentId, folderId);
  getFolderBreadcrumbs(db, user, folderId);
  file.folderId = folderId;
  file.updatedAt = new Date().toISOString();
  return file;
}
export function getFilePath(
  db: Database,
  user: User,
  file: Database["files"][number],
) {
  requireFolderAccess(db, user, file.departmentId);
  return [
    db.departments.find((d) => d.id === file.departmentId)?.name,
    ...getFolderBreadcrumbs(db, user, file.folderId).map((f) => f.name),
    file.name,
  ].join(" / ");
}
