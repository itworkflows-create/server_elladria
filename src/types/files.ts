export type FileCategory = "document" | "image" | "audio" | "video" | "other";
export type FileIconKind =
  "pdf" | "word" | "image" | "audio" | "video" | "spreadsheet" | "file";
export interface FileMetadata {
  originalFileName: string;
  mimeType: string;
  extension: string;
  fileCategory: FileCategory;
  departmentId: string;
  updatedAt: string;
  previewUrl?: string;
  /** Future private-storage adapter can use these instead of local data URLs. */
  storageBucket?: string;
  storagePath?: string;
}
