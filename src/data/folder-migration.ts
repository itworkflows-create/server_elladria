import type { Database, Folder } from "../types";

/** Upgrade storage spaces once, retaining IDs, descriptions and every file byte. */
export function migrateFolders(input: Database): Database {
  const legacy = input as Database & {
    spaces?: Array<{
      id: string;
      departmentId: string;
      name: string;
      description?: string;
    }>;
  };
  const { spaces: oldSpaces, ...rest } = legacy;
  const folders: Folder[] =
    legacy.folders ??
    (oldSpaces ?? []).map((space) => ({
      ...space,
      parentFolderId: null,
      createdBy:
        input.users.find((u) => u.role === "Admin")?.id ??
        input.users[0]?.id ??
        "legacy",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    }));
  return {
    ...rest,
    folders,
    files: input.files.map((file) => {
      const { spaceId, ...fields } = file as typeof file & { spaceId?: string };
      const folderId =
        file.folderId === undefined ? (spaceId ?? null) : file.folderId;
      return {
        ...fields,
        folderId,
        departmentId:
          folders.find((f) => f.id === folderId)?.departmentId ??
          file.departmentId,
      };
    }),
  };
}
