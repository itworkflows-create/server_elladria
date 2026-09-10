import { beforeEach, describe, expect, it, vi } from "vitest";
import { seed } from "./seed";
import { migrateFolders } from "./folder-migration";
import { getDepartmentStorage } from "../lib/storage";
import type { Database } from "../types";
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
describe("folder migration and repository integration", () => {
  it("migrates existing spaces once, retaining IDs, file bytes, descriptions, quotas and grants", async () => {
    const { folders, files, ...rest } = structuredClone(seed);
    const legacy = {
      ...rest,
      spaces: folders.map(({ id, departmentId, name, description }) => ({
        id,
        departmentId,
        name,
        description,
      })),
      files: files.map(({ folderId, ...file }) => ({
        ...file,
        spaceId: folderId,
      })),
    };
    storage.set("elladria-demo-v1", JSON.stringify(legacy));
    const { repository } = await import("./repository");
    const migrated = await repository.getDatabase();
    expect(migrated.folders).toEqual(seed.folders);
    expect(migrated.files).toEqual(seed.files);
    expect(migrated.permissions).toEqual(seed.permissions);
    expect(migrated.departments).toEqual(seed.departments);
    expect(migrated).not.toHaveProperty("spaces");
    expect(migrated.files[0]).not.toHaveProperty("spaceId");
    expect(migrateFolders(migrated)).toEqual(migrated);
  });
  it("persists folder CRUD, file moves and corresponding activity records across reload", async () => {
    const { repository } = await import("./repository");
    await repository.execute("u3", {
      kind: "createFolder",
      departmentId: "design",
      parentFolderId: "s1",
      name: "Candidates",
    });
    const created = (await repository.getDatabase()).folders.find(
      (f) => f.name === "Candidates",
    )!;
    await repository.execute("u3", {
      kind: "renameFolder",
      id: created.id,
      name: "Interviews",
    });
    await repository.execute("u3", {
      kind: "moveFolder",
      id: created.id,
      parentFolderId: null,
    });
    await repository.execute("u3", {
      kind: "moveFile",
      id: "f1",
      folderId: created.id,
    });
    const before = await repository.getDatabase();
    await expect(
      repository.execute("u3", { kind: "deleteFolder", id: created.id }),
    ).rejects.toThrow("confirmation");
    expect(await repository.getDatabase()).toEqual(before);
    vi.resetModules();
    const reloaded = (await import("./repository")).repository;
    expect(await reloaded.getDatabase()).toEqual(before);
    expect((await reloaded.getFile("u3", "f1")).folderId).toBe(created.id);
    await reloaded.execute("u3", {
      kind: "deleteFolder",
      id: created.id,
      confirmRecursive: true,
    });
    const after = await reloaded.getDatabase();
    expect(after.activities.slice(0, 5).map((a) => a.action)).toEqual([
      "deleted folder",
      "moved file",
      "moved folder",
      "renamed folder",
      "created folder",
    ]);
    await expect(reloaded.getFile("u3", "f1")).rejects.toThrow("access");
  });
  it("supports root uploads, preview reads, renames and deletion while enforcing quota and access", async () => {
    const { repository } = await import("./repository");
    const before = await repository.getDatabase();
    await repository.execute("u3", {
      kind: "upload",
      file: {
        departmentId: "design",
        folderId: null,
        name: "Root.pdf",
        fileSizeBytes: 10,
        content: "root",
        dataUrl: "data:application/pdf;base64,JVBERg==",
      },
    });
    const db = await repository.getDatabase();
    const file = db.files[0];
    expect(file.folderId).toBeNull();
    expect((await repository.getFile("u3", file.id)).dataUrl).toBe(
      file.dataUrl,
    );
    expect(getDepartmentStorage(db, "design").usedBytes).toBe(
      getDepartmentStorage(before, "design").usedBytes + 10,
    );
    await repository.execute("u3", {
      kind: "renameFile",
      id: file.id,
      name: "Renamed.pdf",
    });
    await expect(
      repository.execute("u2", {
        kind: "moveFile",
        id: file.id,
        folderId: "s1",
      }),
    ).rejects.toThrow("permission");
    await expect(repository.getFile("u4", file.id)).rejects.toThrow("access");
    await repository.execute("u3", { kind: "deleteFile", id: file.id });
    expect(
      getDepartmentStorage(await repository.getDatabase(), "design").usedBytes,
    ).toBe(getDepartmentStorage(before, "design").usedBytes);
  });
  it("rejects forged department destinations and direct unauthorized commands without changes", async () => {
    const { repository } = await import("./repository");
    const before = await repository.getDatabase();
    await expect(
      repository.execute("u1", {
        kind: "upload",
        file: {
          departmentId: "design",
          folderId: "s6",
          name: "Bad.pdf",
          fileSizeBytes: 10,
          content: "",
        },
      }),
    ).rejects.toThrow("same department");
    for (const userId of ["u2", "u3"]) {
      await expect(
        repository.execute(userId, {
          kind: "createFolder",
          departmentId: "marketing",
          parentFolderId: null,
          name: "Denied",
        }),
      ).rejects.toThrow("permission");
      await expect(
        repository.execute(userId, {
          kind: "renameFolder",
          id: "s6",
          name: "Denied",
        }),
      ).rejects.toThrow("permission");
      await expect(
        repository.execute(userId, {
          kind: "moveFolder",
          id: "s6",
          parentFolderId: null,
        }),
      ).rejects.toThrow("permission");
      await expect(
        repository.execute(userId, {
          kind: "deleteFolder",
          id: "s6",
          confirmRecursive: true,
        }),
      ).rejects.toThrow("permission");
      await expect(
        repository.execute(userId, {
          kind: "moveFile",
          id: "f5",
          folderId: null,
        }),
      ).rejects.toThrow("permission");
    }
    expect(await repository.getDatabase()).toEqual(before);
  });
  it("rolls back folder operations and activity when persistence fails", async () => {
    const { repository } = await import("./repository");
    const before = await repository.getDatabase();
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("full");
      },
    });
    await expect(
      repository.execute("u3", {
        kind: "moveFolder",
        id: "s1",
        parentFolderId: "s2",
      }),
    ).rejects.toThrow("Browser storage");
    expect(await repository.getDatabase()).toEqual(before);
  });
  it("keeps department root files at root on repeated migrations", () => {
    const db: Database = structuredClone(seed);
    db.files[0].folderId = null;
    expect(migrateFolders(migrateFolders(db))).toEqual(db);
  });
});
