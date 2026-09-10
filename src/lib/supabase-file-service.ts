import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { createSupabaseRepository } from "../data/supabase-repository";
import { canPreviewFile, getMimeType, validateUploadFile } from "./file-types";
import { publicError } from "./service-errors";
import type { FileService } from "./mock-file-service";
export const SIGNED_URL_SECONDS = 60;
export function createSupabaseFileService(client: () => SupabaseClient = getSupabase): FileService {
  const repository = createSupabaseRepository(client);
  async function signed(fileId: string, userId: string, download = false) {
    const file = await repository.getFile(userId, fileId);
    if (!file.storagePath) throw publicError({ message: "APP_NOT_FOUND" });
    const { data, error } = await client().storage.from("company-files").createSignedUrl(file.storagePath, SIGNED_URL_SECONDS, download ? { download: file.name } : undefined);
    if (error || !data?.signedUrl) throw new Error("Unable to open this private file. Your access may have changed; try again.");
    return { file, url: data.signedUrl };
  }
  return {
    async upload(file) {
      const error = validateUploadFile(file);
      if (error) throw new Error(error);
      return { name: file.name, mimeType: getMimeType(file.name), fileSizeBytes: file.size, sourceFile: file };
    },
    async getPreview(fileId, userId) {
      const file = await repository.getFile(userId, fileId);
      if (!canPreviewFile(file)) return { file, source: null };
      const { url } = await signed(fileId, userId);
      return { file, source: { url, release: () => {} } };
    },
    async download(fileId, userId) {
      const { file, url } = await signed(fileId, userId, true);
      const response = await fetch(url);
      if (!response.ok) throw new Error("The download link expired or is unavailable. Please try again.");
      return { blob: await response.blob(), fileName: file.name };
    },
  };
}
