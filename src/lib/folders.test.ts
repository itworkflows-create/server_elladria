import { beforeEach, describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import {
  createFolder,
  deleteFolder,
  getChildFolders,
  getFilePath,
  getFilesByFolder,
  getFolder,
  getFolderBreadcrumbs,
  moveFile,
  moveFolder,
  renameFolder,
} from "./folders";
import { getDepartmentStorage, getSystemStorage } from "./storage";

let db = structuredClone(seed);
const admin = seed.users[0];
const member = seed.users[2];
beforeEach(() => {
  db = structuredClone(seed);
});
const create = (name: string, parentFolderId: string | null = null) =>
  createFolder(db, member, "design", parentFolderId, name);
describe("hierarchical folders", () => {
  it("creates root folders and arbitrarily nested folders with creator and timestamps", () => {
    const root = create("Recruitment");
    const child = create("Romania", root.id);
    const grandchild = create("Candidates", child.id);
    expect(root.parentFolderId).toBeNull();
    expect(child.parentFolderId).toBe(root.id);
    expect(grandchild.createdBy).toBe(member.id);
    expect(Number.isNaN(Date.parse(grandchild.createdAt))).toBe(false);
    expect(grandchild.updatedAt).toBe(grandchild.createdAt);
    expect(getChildFolders(db, member, "design", root.id)).toEqual([child]);
    expect(getFolder(db, admin, grandchild.id)).toBe(grandchild);
  });
  it("renames folders and rejects duplicate sibling names case-insensitively", () => {
    const a = create("A");
    const b = create("B");
    renameFolder(db, member, a.id, "  New name  ");
    expect(a.name).toBe("New name");
    expect(() => renameFolder(db, member, b.id, "new NAME")).toThrow(
      "already exists",
    );
    expect(() => create(" New name ")).toThrow("already exists");
    expect(create("New name", a.id).name).toBe("New name");
    expect(create("New name", b.id).name).toBe("New name");
  });
  it.each(["", "   ", ".", "..", "a/b", "a\\b", "x".repeat(81)])(
    "rejects invalid name %s",
    (name) => {
      expect(() => create(name)).toThrow();
    },
  );
  it("moves a whole subtree and moves it back to department root", () => {
    const a = create("A");
    const b = create("B");
    const c = create("C", a.id);
    moveFolder(db, member, a.id, b.id);
    expect(a.parentFolderId).toBe(b.id);
    expect(c.parentFolderId).toBe(a.id);
    expect(getFolderBreadcrumbs(db, member, c.id).map((f) => f.name)).toEqual([
      "B",
      "A",
      "C",
    ]);
    moveFolder(db, member, a.id, null);
    expect(getFolderBreadcrumbs(db, member, c.id).map((f) => f.name)).toEqual([
      "A",
      "C",
    ]);
    expect(getFolderBreadcrumbs(db, member, null)).toEqual([]);
  });
  it("rejects moves into self, descendants, other departments and missing destinations", () => {
    const a = create("A");
    const b = create("B", a.id);
    const c = create("C", b.id);
    for (const destination of [a.id, b.id, c.id])
      expect(() => moveFolder(db, member, a.id, destination)).toThrow(
        "descendant",
      );
    for (const destination of ["s6", "missing"]) {
      expect(() => moveFolder(db, admin, a.id, destination)).toThrow(
        "same department",
      );
      expect(() => create("Invalid", destination)).toThrow("same department");
    }
    expect(a.parentFolderId).toBeNull();
  });
  it("rejects duplicate folder names on moving to another folder or root", () => {
    const a = create("A");
    const b = create("B");
    const child = create("A", b.id);
    expect(() => moveFolder(db, member, child.id, null)).toThrow(
      "already exists",
    );
    create("A", a.id);
    expect(() => moveFolder(db, member, child.id, a.id)).toThrow(
      "already exists",
    );
  });
  it("detects circular relationships without hanging", () => {
    const a = create("A");
    const b = create("B", a.id);
    a.parentFolderId = b.id;
    expect(() => getFolderBreadcrumbs(db, member, b.id)).toThrow("Circular");
    expect(() => create("C", a.id)).toThrow("Circular");
  });
  it("deletes empty folders, protects nonempty folders, and explicitly deletes all nested content", () => {
    const empty = create("Empty");
    deleteFolder(db, member, empty.id);
    expect(db.folders.some((f) => f.id === empty.id)).toBe(false);
    const a = create("A");
    const b = create("B", a.id);
    moveFile(db, member, "f1", b.id);
    const before = structuredClone(db);
    expect(() => deleteFolder(db, member, a.id)).toThrow("confirmation");
    expect(db).toEqual(before);
    deleteFolder(db, member, a.id, true);
    expect(db.folders.some((f) => [a.id, b.id].includes(f.id))).toBe(false);
    expect(db.files.some((f) => f.id === "f1")).toBe(false);
    expect(db.files.some((f) => f.id === "f2")).toBe(true);
    expect(getSystemStorage(db).usedBytes).toBe(
      getSystemStorage(before).usedBytes -
        before.files.find((f) => f.id === "f1")!.fileSizeBytes,
    );
  });
  it("requires confirmation for child-only folders as well as file-only folders", () => {
    const a = create("A");
    create("B", a.id);
    expect(() => deleteFolder(db, member, a.id)).toThrow("confirmation");
    expect(() => deleteFolder(db, member, "s1")).toThrow("confirmation");
  });
  it("moves files between nested folders and root without changing bytes, metadata or usage", () => {
    const a = create("A");
    const b = create("B", a.id);
    const beforeFile = structuredClone(db.files.find((f) => f.id === "f1")!);
    const departmentUsage = getDepartmentStorage(db, "design");
    const systemUsage = getSystemStorage(db);
    moveFile(db, member, "f1", b.id);
    expect(
      getFilesByFolder(db, member, "design", b.id).map((f) => f.id),
    ).toEqual(["f1"]);
    expect(
      getFilePath(
        db,
        member,
        db.files.find((f) => f.id === "f1")!,
      ),
    ).toBe(`Design & Creative / A / B / ${beforeFile.name}`);
    moveFolder(db, member, a.id, "s2");
    expect(getDepartmentStorage(db, "design")).toEqual(departmentUsage);
    expect(getSystemStorage(db)).toEqual(systemUsage);
    moveFile(db, member, "f1", null);
    const moved = getFilesByFolder(db, member, "design", null)[0];
    expect({
      ...moved,
      folderId: beforeFile.folderId,
      updatedAt: beforeFile.updatedAt,
    }).toEqual(beforeFile);
    expect(getSystemStorage(db)).toEqual(systemUsage);
    expect(() => moveFile(db, admin, "f1", "s6")).toThrow("same department");
  });
  it("enforces Executive, View, Manage, own-department and revoked access in services", () => {
    const executive = db.users[1];
    expect(
      getChildFolders(db, executive, "design", null).length,
    ).toBeGreaterThan(0);
    expect(
      getFilesByFolder(db, member, "marketing", "s6").length,
    ).toBeGreaterThan(0);
    const denied = (
      user: typeof member,
      departmentId: string,
      folderId: string,
      fileId: string,
    ) =>
      [
        () => createFolder(db, user, departmentId, null, "Denied"),
        () => renameFolder(db, user, folderId, "Denied"),
        () => moveFolder(db, user, folderId, null),
        () => deleteFolder(db, user, folderId, true),
        () => moveFile(db, user, fileId, null),
      ].forEach((operation) => expect(operation).toThrow("permission"));
    denied(executive, "design", "s1", "f1");
    denied(member, "marketing", "s6", "f5");
    const grant = db.permissions.find(
      (p) => p.userId === member.id && p.departmentId === "marketing",
    )!;
    grant.access = "Manage";
    const shared = createFolder(db, member, "marketing", null, "Shared");
    renameFolder(db, member, shared.id, "Updated");
    moveFolder(db, member, shared.id, "s6");
    moveFile(db, member, "f5", shared.id);
    db.permissions = db.permissions.filter((p) => p.id !== grant.id);
    expect(() => getFolder(db, member, shared.id)).toThrow("permission");
    expect(() => getFilesByFolder(db, member, "marketing", shared.id)).toThrow(
      "permission",
    );
    expect(() => deleteFolder(db, member, shared.id, true)).toThrow(
      "permission",
    );
    expect(() => getChildFolders(db, member, "finance", null)).toThrow(
      "permission",
    );
  });
});
