import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
describe("mock repository authorization", () => {
  it("allows only admins to delete a department and cleans up related resources", async () => {
    const { repository } = await import("./mock-repository");
    await expect(
      repository.execute("u2", { kind: "deleteDepartment", id: "design" }),
    ).rejects.toThrow("Administrator");
    await expect(
      repository.execute("u3", { kind: "deleteDepartment", id: "design" }),
    ).rejects.toThrow("Administrator");
    await repository.execute("u1", { kind: "deleteDepartment", id: "design" });
    const db = await repository.getDatabase();
    expect(db.departments.some((d) => d.id === "design")).toBe(false);
    expect(db.folders.some((s) => s.departmentId === "design")).toBe(false);
    expect(db.files.some((f) => f.folderId === "s1" || f.folderId === "s2")).toBe(
      false,
    );
    expect(db.permissions.some((p) => p.departmentId === "design")).toBe(false);
    expect(db.users.find((u) => u.id === "u3")?.departmentId).toBeUndefined();
    expect(db.files.some((f) => f.id === "f2")).toBe(true);
  });
  it("rejects executive and member admin operations", async () => {
    const { repository } = await import("./mock-repository");
    await expect(
      repository.execute("u2", {
        kind: "department",
        name: "Test",
        description: "Testing",
      }),
    ).rejects.toThrow();
    await expect(
      repository.execute("u3", { kind: "role", id: "u4", role: "Admin" }),
    ).rejects.toThrow("Administrator");
    await expect(
      repository.execute("u2", { kind: "deleteFile", id: "f1" }),
    ).rejects.toThrow("permission");
  });
  it("allows a new member to create exactly one owned department", async () => {
    const { repository } = await import("./mock-repository");
    await repository.execute("u7", {
      kind: "department",
      name: "Customer Success",
      description: "Customer resources",
    });
    const db = await repository.getDatabase();
    const dept = db.departments.find((d) => d.name === "Customer Success");
    expect(db.users.find((u) => u.id === "u7")?.departmentId).toBe(dept?.id);
    await expect(
      repository.execute("u7", {
        kind: "department",
        name: "Second",
        description: "Second department",
      }),
    ).rejects.toThrow();
  });
  it("applies grants and revocations to file mutations immediately", async () => {
    const { repository } = await import("./mock-repository");
    await expect(
      repository.execute("u3", {
        kind: "renameFile",
        id: "f5",
        name: "Campaign.pdf",
      }),
    ).rejects.toThrow("permission");
    await repository.execute("u1", {
      kind: "permission",
      userId: "u3",
      departmentId: "marketing",
      access: "Manage",
    });
    await repository.execute("u3", {
      kind: "renameFile",
      id: "f5",
      name: "Campaign.pdf",
    });
    const db = await repository.getDatabase();
    expect(db.files.find((f) => f.id === "f5")?.name).toBe("Campaign.pdf");
    const grant = db.permissions.find(
      (p) => p.userId === "u3" && p.departmentId === "marketing",
    )!;
    await repository.execute("u1", { kind: "revoke", id: grant.id });
    await expect(
      repository.execute("u3", { kind: "deleteFile", id: "f5" }),
    ).rejects.toThrow("permission");
  });
  it("protects the active admin and retains files when removing a user", async () => {
    const { repository } = await import("./mock-repository");
    await expect(
      repository.execute("u1", { kind: "deleteUser", id: "u1" }),
    ).rejects.toThrow("yourself");
    await repository.execute("u1", { kind: "deleteUser", id: "u3" });
    const db = await repository.getDatabase();
    expect(db.users.some((u) => u.id === "u3")).toBe(false);
    expect(db.permissions.some((p) => p.userId === "u3")).toBe(false);
    expect(db.files.some((f) => f.uploadedBy === "u3")).toBe(true);
  });
});
