import type { Database, DocumentFile } from "../types";
import type {
  DepartmentStorageUsage,
  StorageStatus,
  StorageUsage,
  SystemStorageUsage,
} from "../types/storage";

// Decimal units match cloud storage pricing: 1 GB = 1,000,000,000 bytes.
export const MB = 1_000_000;
export const GB = 1_000_000_000;
export const bytesToMB = (bytes: number) => bytes / MB;
export const bytesToGB = (bytes: number) => bytes / GB;
export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.max(0, Math.floor(Math.log10(Math.max(1, bytes)) / 3)),
    units.length - 1,
  );
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(bytes / 1000 ** index)} ${units[index]}`;
}
export function calculateUsagePercentage(
  usedBytes: number,
  capacityBytes: number,
) {
  if (capacityBytes <= 0) return usedBytes > 0 ? 100 : 0;
  return (usedBytes / capacityBytes) * 100;
}
export const calculateRemainingStorage = (
  usedBytes: number,
  capacityBytes: number,
) => Math.max(0, capacityBytes - usedBytes);
export function getStorageStatus(percentage: number): StorageStatus {
  if (percentage >= 100) return "Full";
  if (percentage >= 95) return "Critical";
  if (percentage >= 80) return "Warning";
  return "Normal";
}
export const sumFileSizes = (files: DocumentFile[]) =>
  files.reduce((sum, file) => sum + file.fileSizeBytes, 0);
export function calculateStorageUsage(
  files: DocumentFile[],
  capacityBytes: number,
): StorageUsage {
  const usedBytes = sumFileSizes(files);
  const usagePercentage = calculateUsagePercentage(usedBytes, capacityBytes);
  return {
    usedBytes,
    capacityBytes,
    remainingBytes: calculateRemainingStorage(usedBytes, capacityBytes),
    usagePercentage,
    fileCount: files.length,
    status: capacityBytes === 0 ? "Full" : getStorageStatus(usagePercentage),
  };
}
export function getDepartmentStorage(
  db: Database,
  departmentId: string,
): DepartmentStorageUsage {
  const department = db.departments.find((d) => d.id === departmentId);
  if (!department) throw new Error("Department not found.");

  return {
    ...calculateStorageUsage(
      db.files.filter((f) => f.departmentId === departmentId),
      department.storageQuotaBytes,
    ),
    department,
  };
}
export function getSystemStorage(db: Database): SystemStorageUsage {
  const departments = db.departments.map((d) => getDepartmentStorage(db, d.id));
  return {
    ...calculateStorageUsage(db.files, db.storage.totalCapacityBytes),
    departments,
    largestDepartment: departments.reduce<DepartmentStorageUsage | null>(
      (largest, current) =>
        current.usedBytes > (largest?.usedBytes ?? 0) ? current : largest,
      null,
    ),
    allocatedQuotaBytes: departments.reduce(
      (sum, d) => sum + d.capacityBytes,
      0,
    ),
  };
}
export const QUOTA_EXCEEDED_MESSAGE =
  "This upload would exceed the department storage quota.";
export function getUploadStorageError(
  db: Database,
  departmentId: string,
  fileSizeBytes: number,
): string | null {
  if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0)
    return "File size must be a positive whole number of bytes.";
  const department = getDepartmentStorage(db, departmentId);
  if (fileSizeBytes > department.remainingBytes) return QUOTA_EXCEEDED_MESSAGE;
  if (fileSizeBytes > getSystemStorage(db).remainingBytes)
    return "This upload would exceed the total system storage capacity.";
  return null;
}
