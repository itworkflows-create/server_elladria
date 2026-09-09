import { afterEach, describe, expect, it, vi } from "vitest";
import { seed } from "../data/seed";
import { repository } from "../data/repository";
import { fileService } from "./file-service";
import { downloadFile } from "./file-download";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("file service and download adapter", () => {
  it("checks access before resolving media bytes", async () => {
    vi.spyOn(repository, "getFile").mockRejectedValue(new Error("No access"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fileService.download("media-video", "u3")).rejects.toThrow(
      "No access",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a releasable object URL for media previews", async () => {
    vi.spyOn(repository, "getFile").mockResolvedValue(
      seed.files.find((f) => f.id === "media-mp3")!,
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(new Blob(["demo audio"], { type: "audio/mpeg" })),
        ),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const result = await fileService.getPreview("media-mp3", "u1");
    expect(result.source?.url).toBe("blob:preview");
    result.source?.release();
    expect(revoke).toHaveBeenCalledWith("blob:preview");
  });
  it("keeps Word download-only and provides labeled fallback text for seed files without binaries", async () => {
    const file = {
      ...seed.files.find((f) => f.id === "f3")!,
      previewUrl: undefined,
    };
    vi.spyOn(repository, "getFile").mockResolvedValue(file);
    expect((await fileService.getPreview(file.id, "u1")).source).toBeNull();
    const result = await fileService.download(file.id, "u1");
    expect(result.fileName).toBe(`${file.name}.mock.txt`);
    expect(await result.blob.text()).toContain(file.content);
  });
  it("creates valid PDF previews for text-only legacy samples", async () => {
    const file = {
      ...seed.files.find((f) => f.id === "f4")!,
      previewUrl: undefined,
    };
    vi.spyOn(repository, "getFile").mockResolvedValue(file);
    const result = await fileService.download(file.id, "u1");
    const text = await result.blob.text();
    expect(result.blob.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("%%EOF");
    expect(result.fileName).toBe(file.name);
  });
  it("uses the service result for download and releases the URL after the browser starts it", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { href: "", download: "", click, remove };
    const append = vi.fn();
    let cleanup = () => {};
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { appendChild: append },
    });
    vi.stubGlobal("window", {
      setTimeout: (callback: () => void) => {
        cleanup = callback;
      },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const download = vi
      .fn()
      .mockResolvedValue({
        blob: new Blob(["bytes"]),
        fileName: "Original.mp4",
      });
    await downloadFile({ id: "file" }, "user", { ...fileService, download });
    expect(download).toHaveBeenCalledWith("file", "user");
    expect(anchor.download).toBe("Original.mp4");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    cleanup();
    expect(revoke).toHaveBeenCalledWith("blob:download");
  });
});
