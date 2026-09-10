import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDepartmentStorage,
  getSystemStorage,
  QUOTA_EXCEEDED_MESSAGE,
} from "../lib/storage";
beforeEach(() => {
  vi.resetModules();
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
});
describe("mixed file permissions and accounting", () => {
  it("authorizes file reads for Admin, Executive, own department and granted shares", async () => {
    const { repository } = await import("./mock-repository");
    for (const user of ["u1", "u2"])
      expect((await repository.getFile(user, "media-video")).extension).toBe(
        "mp4",
      );
    expect((await repository.getFile("u3", "f1")).departmentId).toBe("design");
    expect((await repository.getFile("u3", "f5")).departmentId).toBe(
      "marketing",
    );
    await expect(repository.getFile("u3", "media-video")).rejects.toThrow(
      "access",
    );
    await expect(repository.getFile("missing", "f1")).rejects.toThrow("access");
    await repository.execute("u1", { kind: "revoke", id: "p1" });
    await expect(repository.getFile("u3", "f5")).rejects.toThrow("access");
  });
  it("tracks audio/video uploads, metadata, rename timestamps, and deletion in storage totals", async () => {
    const { repository } = await import("./mock-repository");
    const before = await repository.getDatabase();
    for (const name of ["Recording.mp3", "Training.mp4"])
      await repository.execute("u3", {
        kind: "upload",
        file: {
          folderId: "s1",
          name,
          mimeType: "",
          fileSizeBytes: 1000,
          content: "Synthetic upload",
        },
      });
    const db = await repository.getDatabase();
    expect(getDepartmentStorage(db, "design").usedBytes).toBe(
      getDepartmentStorage(before, "design").usedBytes + 2000,
    );
    expect(getSystemStorage(db).usedBytes).toBe(
      getSystemStorage(before).usedBytes + 2000,
    );
    const file = db.files[0];
    expect(file.mimeType).toBe("video/mp4");
    expect(file.fileCategory).toBe("video");
    expect(file.originalFileName).toBe("Training.mp4");
    await repository.execute("u3", {
      kind: "renameFile",
      id: file.id,
      name: "Training revised.mp4",
    });
    const renamed = await repository.getFile("u3", file.id);
    expect(renamed.originalFileName).toBe("Training.mp4");
    expect(renamed.updatedAt >= file.updatedAt).toBe(true);
    await expect(
      repository.execute("u3", {
        kind: "renameFile",
        id: file.id,
        name: "Not a PDF.pdf",
      }),
    ).rejects.toThrow("original");
    await repository.execute("u3", { kind: "deleteFile", id: file.id });
    expect(getSystemStorage(await repository.getDatabase()).usedBytes).toBe(
      getSystemStorage(before).usedBytes + 1000,
    );
  });
  it("rejects unauthorized, unsupported and over-quota media writes without side effects", async () => {
    const { repository } = await import("./mock-repository");
    const file = {
      folderId: "s1",
      name: "Video.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 100,
      content: "",
    };
    await expect(
      repository.execute("u2", { kind: "upload", file }),
    ).rejects.toThrow("permission");
    await expect(
      repository.execute("u3", {
        kind: "upload",
        file: { ...file, folderId: "s6" },
      }),
    ).rejects.toThrow("permission");
    await expect(
      repository.execute("u3", {
        kind: "upload",
        file: { ...file, name: "Unknown.exe" },
      }),
    ).rejects.toThrow("Unsupported");
    const db = await repository.getDatabase();
    await repository.execute("u1", {
      kind: "quota",
      departmentId: "design",
      storageQuotaBytes: getDepartmentStorage(db, "design").usedBytes,
    });
    const full = await repository.getDatabase();
    await expect(
      repository.execute("u3", { kind: "upload", file }),
    ).rejects.toThrow(QUOTA_EXCEEDED_MESSAGE);
    expect(await repository.getDatabase()).toEqual(full);
  });
});
