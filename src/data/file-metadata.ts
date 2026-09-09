import type { Database, DocumentFile } from "../types";
import {
  getFileCategory,
  getFileExtension,
  getMimeType,
} from "../lib/file-types";

type ExistingFile = Pick<
  DocumentFile,
  | "id"
  | "spaceId"
  | "name"
  | "fileSizeBytes"
  | "uploadedBy"
  | "date"
  | "content"
> &
  Partial<DocumentFile> & { type?: string };
export function enrichFile(
  file: ExistingFile,
  departmentId: string,
): DocumentFile {
  const { type: legacyType, ...rest } = file;
  void legacyType;
  return {
    ...rest,
    originalFileName: file.originalFileName ?? file.name,
    extension: file.extension ?? getFileExtension(file.name),
    mimeType: file.mimeType ?? getMimeType(file.name),
    fileCategory:
      file.fileCategory ?? getFileCategory(file.name, file.mimeType),
    departmentId,
    updatedAt: file.updatedAt ?? file.date,
  };
}
export function migrateFileMetadata(db: Database): Database {
  return {
    ...db,
    files: db.files.map((file) =>
      enrichFile(
        file,
        db.spaces.find((s) => s.id === file.spaceId)?.departmentId ?? "",
      ),
    ),
  };
}
