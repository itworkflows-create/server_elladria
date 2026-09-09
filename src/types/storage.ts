import type { Department } from "../types";

export type StorageStatus = "Normal" | "Warning" | "Critical" | "Full";
export interface StorageConfiguration {
  totalCapacityBytes: number;
}
export interface StorageUsage {
  usedBytes: number;
  capacityBytes: number;
  remainingBytes: number;
  usagePercentage: number;
  fileCount: number;
  status: StorageStatus;
}
export interface DepartmentStorageUsage extends StorageUsage {
  department: Department;
}
export interface SystemStorageUsage extends StorageUsage {
  departments: DepartmentStorageUsage[];
  largestDepartment: DepartmentStorageUsage | null;
  allocatedQuotaBytes: number;
}
