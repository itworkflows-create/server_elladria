import type { DocumentFile } from "../types";
import { fileService, type FileService } from "./file-service";

export async function downloadFile(
  file: Pick<DocumentFile, "id">,
  userId: string,
  service: FileService = fileService,
) {
  const result = await service.download(file.id, userId);
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.fileName;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Allow browsers to start reading the blob before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
