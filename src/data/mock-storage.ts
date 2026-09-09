import type { Database } from "../types";
import { GB } from "../lib/storage";

export const DEFAULT_DEPARTMENT_QUOTA_BYTES = 5 * GB;
export const mockStorageConfiguration = { totalCapacityBytes: 50 * GB };
const departmentQuotas: Record<string, number> = {
  design: 10 * GB,
  finance: 5 * GB,
  engineering: 8 * GB,
  people: 8 * GB,
  marketing: 4 * GB,
  operations: 15 * GB,
};
export const getMockDepartmentQuota = (id: string) =>
  departmentQuotas[id] ?? DEFAULT_DEPARTMENT_QUOTA_BYTES;
const validBytes = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

// Upgrade the existing local demo in place without discarding uploads or edits.
// The legacy `size` field is read only here; all app code uses fileSizeBytes.
export function migrateStorageData(db: Database): Database {
  return {
    ...db,
    storage: {
      totalCapacityBytes: validBytes(db.storage?.totalCapacityBytes)
        ? db.storage.totalCapacityBytes
        : mockStorageConfiguration.totalCapacityBytes,
    },
    departments: db.departments.map((d) => ({
      ...d,
      storageQuotaBytes: validBytes(d.storageQuotaBytes)
        ? d.storageQuotaBytes
        : getMockDepartmentQuota(d.id),
    })),
    files: db.files.map((file) => {
      const { size, ...rest } = file as typeof file & { size?: number };
      return {
        ...rest,
        fileSizeBytes: validBytes(file.fileSizeBytes)
          ? file.fileSizeBytes
          : validBytes(size)
            ? size
            : 0,
      };
    }),
  };
}
