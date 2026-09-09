import { describe, expect, it } from "vitest";
import { seed } from "./seed";
import { migrateStorageData } from "./mock-storage";
import type { Database } from "../types";
describe("storage data migration", () => {
  it("preserves existing users, file bytes, and edits when upgrading legacy data", () => {
    const { storage: removedStorage, ...existing } = structuredClone(seed);
    expect(removedStorage.totalCapacityBytes).toBeGreaterThan(0);
    const legacy = {
      ...existing,
      departments: existing.departments.map(({ storageQuotaBytes, ...d }) => {
        expect(storageQuotaBytes).toBeGreaterThan(0);
        return d;
      }),
      files: existing.files.map(({ fileSizeBytes, ...f }) => ({
        ...f,
        size: fileSizeBytes,
        dataUrl: "data:application/pdf;base64,JVBERg==",
      })),
    };
    const upgraded = migrateStorageData(legacy as unknown as Database);
    expect(upgraded.storage.totalCapacityBytes).toBe(50_000_000_000);
    expect(upgraded.users).toEqual(existing.users);
    expect(upgraded.files[0].fileSizeBytes).toBe(4_200_000);
    expect(upgraded.files[0].dataUrl).toBe(legacy.files[0].dataUrl);
    expect(upgraded.files[0]).not.toHaveProperty("size");
    expect(
      upgraded.departments.find((d) => d.id === "finance")?.storageQuotaBytes,
    ).toBe(5_000_000_000);
  });
  it("retains saved quotas, sizes, and configuration on subsequent loads", () => {
    const db = structuredClone(seed);
    db.departments[0].storageQuotaBytes = 1234;
    db.files[0].fileSizeBytes = 100;
    db.storage.totalCapacityBytes = 9999;
    expect(migrateStorageData(db)).toEqual(db);
  });
});
