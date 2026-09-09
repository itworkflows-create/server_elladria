import { describe, expect, it } from "vitest";
import { seed } from "./seed";
import { enrichFile, migrateFileMetadata } from "./file-metadata";
import { addMockFileExamples } from "./mock-files";
describe("file metadata migration", () => {
  it("enriches legacy files without losing names, timestamps, bytes, or uploaded data", () => {
    const file = enrichFile(
      {
        id: "legacy",
        name: "Notes.DOCX",
        spaceId: "s1",
        fileSizeBytes: 400,
        uploadedBy: "u3",
        date: "2026-09-01T10:00:00Z",
        content: "Legacy upload",
        type: "DOCX",
        dataUrl: "data:application/octet-stream;base64,UEs=",
      },
      "design",
    );
    expect(file.originalFileName).toBe("Notes.DOCX");
    expect(file.extension).toBe("docx");
    expect(file.fileCategory).toBe("document");
    expect(file.departmentId).toBe("design");
    expect(file.updatedAt).toBe(file.date);
    expect(file.dataUrl).toContain("UEs=");
    expect(file).not.toHaveProperty("type");
  });
  it("is idempotent and respects deleted sample files after migration", () => {
    expect(migrateFileMetadata(seed)).toEqual(seed);
    expect(addMockFileExamples(seed)).toEqual(seed);
    const db = structuredClone(seed);
    db.files = db.files.filter((f) => !f.id.startsWith("media-"));
    delete db.fileExamplesVersion;
    const migrated = addMockFileExamples(db);
    expect(migrated.files.length).toBe(seed.files.length);
    migrated.files = migrated.files.filter((f) => f.id !== "media-photo");
    expect(
      addMockFileExamples(migrated).files.some((f) => f.id === "media-photo"),
    ).toBe(false);
  });
});
