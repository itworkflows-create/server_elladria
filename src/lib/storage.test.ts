import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import {
  bytesToMB,
  bytesToGB,
  calculateRemainingStorage,
  calculateUsagePercentage,
  formatFileSize,
  getDepartmentStorage,
  getStorageStatus,
  getSystemStorage,
  getUploadStorageError,
  QUOTA_EXCEEDED_MESSAGE,
} from "./storage";
describe("storage calculations", () => {
  it("uses decimal units consistently and formats small and large files", () => {
    expect(bytesToMB(2_500_000)).toBe(2.5);
    expect(bytesToGB(1_500_000_000)).toBe(1.5);
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1)).toBe("1 B");
    expect(formatFileSize(4200000)).toBe("4.2 MB");
    expect(formatFileSize(50_000_000_000)).toBe("50 GB");
  });
  it.each([
    [0, "Normal"],
    [79.999, "Normal"],
    [80, "Warning"],
    [94.99, "Warning"],
    [95, "Critical"],
    [99.999, "Critical"],
    [100, "Full"],
    [150, "Full"],
  ] as const)("classifies %s percent as %s", (percentage, status) =>
    expect(getStorageStatus(percentage)).toBe(status),
  );
  it("handles empty, zero-capacity, and over-quota calculations without NaN or negative remaining space", () => {
    expect(calculateUsagePercentage(0, 0)).toBe(0);
    expect(calculateUsagePercentage(1, 0)).toBe(100);
    expect(calculateUsagePercentage(150, 100)).toBe(150);
    expect(calculateRemainingStorage(150, 100)).toBe(0);
  });
  it("sums files across every storage space in a department without cross-department leakage", () => {
    const design = getDepartmentStorage(seed, "design");
    expect(design.usedBytes).toBe(6_500_000);
    expect(design.fileCount).toBe(2);
    const system = getSystemStorage(seed);
    expect(system.usedBytes).toBe(
      seed.files.reduce((n, f) => n + f.fileSizeBytes, 0),
    );
    expect(system.fileCount).toBe(seed.files.length);
    expect(system.largestDepartment?.department.id).toBe("engineering");
    expect(
      getSystemStorage({ ...seed, files: [] }).largestDepartment,
    ).toBeNull();
  });
  it("allows an exact-fit upload but rejects one byte over quota", () => {
    const db = structuredClone(seed);
    db.departments.find((d) => d.id === "design")!.storageQuotaBytes =
      6_500_100;
    expect(getUploadStorageError(db, "design", 100)).toBeNull();
    expect(getUploadStorageError(db, "design", 101)).toBe(
      QUOTA_EXCEEDED_MESSAGE,
    );
    expect(getUploadStorageError(db, "design", -1)).toContain("positive");
    expect(getUploadStorageError(db, "design", NaN)).toContain("positive");
  });
  it("also honors total system capacity even when a department has free quota", () => {
    const db = structuredClone(seed);
    db.storage.totalCapacityBytes = getSystemStorage(db).usedBytes;
    expect(getUploadStorageError(db, "design", 1)).toContain(
      "total system storage capacity",
    );
  });
});
