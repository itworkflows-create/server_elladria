import type { FileCategory, FileIconKind } from "../types/files";
import type { DocumentFile } from "../types";

const formats: Record<
  string,
  { mime: string; category: FileCategory; aliases?: string[] }
> = {
  pdf: { mime: "application/pdf", category: "document" },
  doc: {
    mime: "application/msword",
    category: "document",
    aliases: ["application/vnd.ms-word"],
  },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
  },
  jpg: { mime: "image/jpeg", category: "image", aliases: ["image/jpg"] },
  jpeg: { mime: "image/jpeg", category: "image", aliases: ["image/jpg"] },
  png: { mime: "image/png", category: "image" },
  mp3: { mime: "audio/mpeg", category: "audio", aliases: ["audio/mp3"] },
  wav: {
    mime: "audio/wav",
    category: "audio",
    aliases: ["audio/x-wav", "audio/wave", "audio/vnd.wave"],
  },
  m4a: {
    mime: "audio/mp4",
    category: "audio",
    aliases: ["audio/m4a", "audio/x-m4a"],
  },
  aac: {
    mime: "audio/aac",
    category: "audio",
    aliases: ["audio/x-aac", "audio/aacp"],
  },
  mp4: { mime: "video/mp4", category: "video" },
  mov: { mime: "video/quicktime", category: "video" },
  webm: { mime: "video/webm", category: "video" },
  // Preserve the spreadsheet uploads supported by the previous version.
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    category: "other",
  },
};
export const SUPPORTED_EXTENSIONS = Object.keys(formats);
export const FILE_ACCEPT = SUPPORTED_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");
export const MAX_MOCK_FILE_BYTES = 2_000_000;
export function getFileExtension(name: string) {
  const base = name.trim().split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}
export function getMimeType(name: string) {
  return formats[getFileExtension(name)]?.mime ?? "application/octet-stream";
}
export function getMimeCategory(mime: string): FileCategory {
  const normalized = mime.toLowerCase().split(";")[0].trim();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  return (
    Object.values(formats).find(
      (f) => f.mime === normalized || f.aliases?.includes(normalized),
    )?.category ?? "other"
  );
}
export function getFileCategory(name: string, mimeType = ""): FileCategory {
  return formats[getFileExtension(name)]?.category ?? getMimeCategory(mimeType);
}
type FileDescription = Pick<DocumentFile, "extension" | "fileCategory">;
export const isImageFile = (file: FileDescription) =>
  file.fileCategory === "image" &&
  ["jpg", "jpeg", "png"].includes(file.extension);
export const isPdfFile = (file: FileDescription) => file.extension === "pdf";
export const isAudioFile = (file: FileDescription) =>
  file.fileCategory === "audio" &&
  ["mp3", "wav", "m4a", "aac"].includes(file.extension);
export const isVideoFile = (file: FileDescription) =>
  file.fileCategory === "video" &&
  ["mp4", "mov", "webm"].includes(file.extension);
export const isWordFile = (file: FileDescription) =>
  ["doc", "docx"].includes(file.extension);
export const canPreviewFile = (file: FileDescription) =>
  isImageFile(file) ||
  isPdfFile(file) ||
  isAudioFile(file) ||
  isVideoFile(file);
export const isPlayableFile = (file: FileDescription) =>
  isAudioFile(file) || isVideoFile(file);
export function getFileIcon(file: FileDescription): FileIconKind {
  if (isPdfFile(file)) return "pdf";
  if (isWordFile(file)) return "word";
  if (isImageFile(file)) return "image";
  if (isAudioFile(file)) return "audio";
  if (isVideoFile(file)) return "video";
  return file.extension === "xlsx" ? "spreadsheet" : "file";
}
export function validateUploadFile(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  const extension = getFileExtension(file.name);
  const format = formats[extension];
  if (!format)
    return "Unsupported file type. Choose PDF, DOC, DOCX, JPG, JPEG, PNG, MP3, WAV, M4A, AAC, MP4, MOV, WEBM, or XLSX.";
  if (
    !file.name.trim() ||
    file.name.length > 180 ||
    hasInvalidNameCharacters(file.name)
  )
    return "Choose a file with a valid name of 180 characters or fewer.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return "This file is empty or has an invalid size. Choose a non-empty file.";
  if (file.size > MAX_MOCK_FILE_BYTES)
    return "Choose a file of 2 MB or smaller.";
  const mime = file.type.toLowerCase().split(";")[0].trim();
  if (
    mime &&
    mime !== "application/octet-stream" &&
    mime !== format.mime &&
    !format.aliases?.includes(mime)
  )
    return "The file MIME type does not match its extension. Choose the original file with its correct extension.";
  return null;
}
export function validateFileName(name: string, extension: string) {
  if (
    name.trim().length < 1 ||
    name.trim().length > 180 ||
    hasInvalidNameCharacters(name)
  )
    return "Use a file name of 1–180 characters without path separators.";
  if (getFileExtension(name) !== extension)
    return `Keep the original .${extension} extension when renaming this file.`;
  return null;
}
function hasInvalidNameCharacters(name: string) {
  return (
    /[\\/]/.test(name) ||
    [...name].some((character) => character.charCodeAt(0) < 32)
  );
}
