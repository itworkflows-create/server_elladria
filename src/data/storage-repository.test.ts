import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDepartmentStorage, QUOTA_EXCEEDED_MESSAGE } from "../lib/storage";
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
describe("storage quota commands", () => {
  it("allows only Admin to edit quotas, including against direct service calls", async () => {
    const { repository } = await import("./repository");
    for (const userId of ["u2", "u3", "u4"])
      await expect(
        repository.execute(userId, {
          kind: "quota",
          departmentId: "design",
          storageQuotaBytes: 10,
        }),
      ).rejects.toThrow("Administrator");
    await repository.execute("u1", {
      kind: "quota",
      departmentId: "design",
      storageQuotaBytes: 8_000_000,
    });
    const db = await repository.getDatabase();
    expect(getDepartmentStorage(db, "design").status).toBe("Warning");
    expect(db.activities[0].action).toBe("changed storage quota");
    vi.resetModules();
    const reloaded = await import("./repository");
    expect(
      getDepartmentStorage(await reloaded.repository.getDatabase(), "design")
        .capacityBytes,
    ).toBe(8_000_000);
  });
  it("validates quotas and department existence without committing changes", async () => {
    const { repository } = await import("./repository");
    const before = await repository.getDatabase();
    for (const storageQuotaBytes of [
      0,
      -1,
      1.2,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      await expect(
        repository.execute("u1", {
          kind: "quota",
          departmentId: "design",
          storageQuotaBytes,
        }),
      ).rejects.toThrow("positive whole");
    await expect(
      repository.execute("u1", {
        kind: "quota",
        departmentId: "missing",
        storageQuotaBytes: 100,
      }),
    ).rejects.toThrow("not found");
    expect(await repository.getDatabase()).toEqual(before);
  });
  it("rejects over-quota uploads atomically, permits exact fits, and frees quota on deletion", async () => {
    const { repository } = await import("./repository");
    await repository.execute("u1", {
      kind: "quota",
      departmentId: "design",
      storageQuotaBytes: 6_500_100,
    });
    const before = await repository.getDatabase();
    const file = {
      spaceId: "s1",
      name: "Test.pdf",
      type: "PDF" as const,
      fileSizeBytes: 101,
      content: "Mock upload",
    };
    await expect(
      repository.execute("u3", { kind: "upload", file }),
    ).rejects.toThrow(QUOTA_EXCEEDED_MESSAGE);
    expect(await repository.getDatabase()).toEqual(before);
    await repository.execute("u3", {
      kind: "upload",
      file: { ...file, fileSizeBytes: 100 },
    });
    const full = await repository.getDatabase();
    expect(getDepartmentStorage(full, "design").status).toBe("Full");
    await expect(
      repository.execute("u1", {
        kind: "upload",
        file: { ...file, fileSizeBytes: 1 },
      }),
    ).rejects.toThrow(QUOTA_EXCEEDED_MESSAGE);
    await repository.execute("u3", {
      kind: "deleteFile",
      id: full.files[0].id,
    });
    expect(
      getDepartmentStorage(await repository.getDatabase(), "design")
        .remainingBytes,
    ).toBe(100);
  });
  it("preserves existing files when lowering quota below current usage", async () => {
    const { repository } = await import("./repository");
    const before = await repository.getDatabase();
    await repository.execute("u1", {
      kind: "quota",
      departmentId: "design",
      storageQuotaBytes: 1_000_000,
    });
    const db = await repository.getDatabase();
    expect(db.files).toEqual(before.files);
    expect(getDepartmentStorage(db, "design").usagePercentage).toBe(650);
    expect(getDepartmentStorage(db, "design").remainingBytes).toBe(0);
  });
});
