import { isDemoMode } from "./supabase";
import { createSupabaseFileService } from "./supabase-file-service";
import type { FileService } from "./mock-file-service";
export type { FileService, PreviewSource } from "./mock-file-service";
const live = createSupabaseFileService();
async function adapter(): Promise<FileService> {
  return isDemoMode ? (await import("./mock-file-service")).fileService : live;
}
export const fileService: FileService = {
  upload: async (file) => (await adapter()).upload(file),
  getPreview: async (fileId, userId) => (await adapter()).getPreview(fileId, userId),
  download: async (fileId, userId) => (await adapter()).download(fileId, userId),
};
