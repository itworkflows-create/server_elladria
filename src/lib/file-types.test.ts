import { describe, expect, it } from "vitest";
import {
  canPreviewFile,
  getFileCategory,
  getFileExtension,
  getFileIcon,
  getMimeCategory,
  getMimeType,
  isPlayableFile,
  isWordFile,
  SUPPORTED_EXTENSIONS,
  validateFileName,
  validateUploadFile,
} from "./file-types";
describe("file type detection and validation", () => {
  it.each([
    ["pdf", "document"],
    ["doc", "document"],
    ["docx", "document"],
    ["jpg", "image"],
    ["jpeg", "image"],
    ["png", "image"],
    ["mp3", "audio"],
    ["wav", "audio"],
    ["m4a", "audio"],
    ["aac", "audio"],
    ["mp4", "video"],
    ["mov", "video"],
    ["webm", "video"],
    ["xlsx", "other"],
  ])("detects and accepts %s files as %s", (extension, category) => {
    expect(getFileCategory(`Example.${extension.toUpperCase()}`)).toBe(
      category,
    );
    expect(
      validateUploadFile({
        name: `Example.${extension}`,
        size: 1200,
        type: getMimeType(`Example.${extension}`),
      }),
    ).toBeNull();
  });
  it("handles final extensions and MIME categorization", () => {
    expect(getFileExtension("Reports/Interview.V2.MP3")).toBe("mp3");
    expect(getFileExtension("file")).toBe("");
    expect(getFileExtension(".hidden")).toBe("");
    expect(getFileExtension("file.pdf.exe")).toBe("exe");
    expect(getMimeCategory("audio/mp4; codecs=mp4a")).toBe("audio");
    expect(getMimeCategory("application/msword")).toBe("document");
    expect(getMimeCategory("application/octet-stream")).toBe("other");
  });
  it("offers previews only for supported formats and correct icons for download-only documents", () => {
    const word = { extension: "docx", fileCategory: "document" as const };
    expect(isWordFile(word)).toBe(true);
    expect(canPreviewFile(word)).toBe(false);
    expect(getFileIcon(word)).toBe("word");
    expect(getFileIcon({ extension: "pdf", fileCategory: "document" })).toBe(
      "pdf",
    );
    expect(isPlayableFile({ extension: "mp4", fileCategory: "video" })).toBe(
      true,
    );
    expect(canPreviewFile({ extension: "svg", fileCategory: "image" })).toBe(
      false,
    );
  });
  it("rejects unsupported, empty, oversized, invalid, or mismatched files", () => {
    expect(SUPPORTED_EXTENSIONS).toHaveLength(14);
    for (const size of [0, -1, NaN, Infinity, 1.5])
      expect(
        validateUploadFile({ name: "audio.mp3", size, type: "" }),
      ).toContain("invalid size");
    expect(
      validateUploadFile({ name: "audio.mp3", size: 2_000_001, type: "" }),
    ).toContain("2 MB");
    expect(
      validateUploadFile({ name: "audio.mp3", size: 2_000_000, type: "" }),
    ).toBeNull();
    expect(
      validateUploadFile({ name: "run.exe", size: 100, type: "" }),
    ).toContain("Unsupported");
    expect(
      validateUploadFile({
        name: "document.pdf",
        size: 100,
        type: "text/html",
      }),
    ).toContain("does not match");
    expect(
      validateUploadFile({ name: "../file.pdf", size: 100, type: "" }),
    ).toContain("valid name");
    expect(
      validateUploadFile({
        name: "recording.wav",
        size: 100,
        type: "audio/x-wav",
      }),
    ).toBeNull();
    expect(
      validateUploadFile({
        name: "recording.m4a",
        size: 100,
        type: "application/octet-stream",
      }),
    ).toBeNull();
  });
  it("preserves file type when renaming", () => {
    expect(validateFileName("Updated.PDF", "pdf")).toBeNull();
    expect(validateFileName("Updated.mp4", "pdf")).toContain("original .pdf");
    expect(validateFileName(" ", "pdf")).toContain("file name");
  });
});
