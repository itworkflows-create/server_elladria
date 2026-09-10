import { repository } from "../data/mock-repository";
import type { DocumentFile } from "../types";
import {
  canPreviewFile,
  getMimeType,
  isPdfFile,
  validateUploadFile,
} from "./file-types";
import { createMockPdf } from "./mock-pdf";

export interface PreviewSource {
  url: string;
  release: () => void;
}
export interface FileService {
  upload(
    file: File,
  ): Promise<{
    name: string;
    mimeType: string;
    fileSizeBytes: number;
    dataUrl?: string;
    sourceFile?: File;
  }>;
  getPreview(
    fileId: string,
    userId: string,
  ): Promise<{ file: DocumentFile; source: PreviewSource | null }>;
  download(
    fileId: string,
    userId: string,
  ): Promise<{ blob: Blob; fileName: string }>;
}
async function getMockBlob(file: DocumentFile): Promise<Blob | null> {
  const url = file.dataUrl || file.previewUrl;
  if (url) {
    if (!url.startsWith("data:") && !/^\/demo\/[a-zA-Z0-9_.-]+$/.test(url))
      throw new Error("This mock file source is unavailable.");
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Unable to load this file. Please try again.");
    const blob = await response.blob();
    if (blob.type === "text/html")
      throw new Error("The sample file could not be found.");
    return blob.slice(0, blob.size, file.mimeType);
  }
  return isPdfFile(file) ? createMockPdf(file.name, file.content) : null;
}
// Replace this adapter with private bucket uploads, signed URL resolution, and
// downloads in the next phase. Callers never choose public or hard-coded URLs.
export const fileService: FileService = {
  async upload(file) {
    const error = validateUploadFile(file);
    if (error) throw new Error(error);
    const mimeType = getMimeType(file.name);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Unable to read this file. Please try again."));
      reader.readAsDataURL(file.slice(0, file.size, mimeType));
    });
    return { name: file.name, mimeType, fileSizeBytes: file.size, dataUrl };
  },
  async getPreview(fileId, userId) {
    const file = await repository.getFile(userId, fileId);
    if (!canPreviewFile(file)) return { file, source: null };
    const blob = await getMockBlob(file);
    if (!blob) return { file, source: null };
    const url = URL.createObjectURL(blob);
    return { file, source: { url, release: () => URL.revokeObjectURL(url) } };
  },
  async download(fileId, userId) {
    const file = await repository.getFile(userId, fileId);
    const blob = await getMockBlob(file);
    return blob
      ? { blob, fileName: file.name }
      : {
          blob: new Blob(
            [`Elladria mock file: ${file.name}\n\n${file.content}`],
            { type: "text/plain" },
          ),
          fileName: `${file.name}.mock.txt`,
        };
  },
};
