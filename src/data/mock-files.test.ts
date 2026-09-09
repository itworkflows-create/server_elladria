import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockMediaFiles } from "./mock-files";
describe("bundled media fixtures", () => {
  it.each(mockMediaFiles)(
    "ships $name locally with accurate byte metadata",
    (file) => {
      const path = new URL(`../../public${file.previewUrl}`, import.meta.url);
      const bytes = readFileSync(path);
      expect(statSync(path).size).toBe(file.fileSizeBytes);
      if (file.extension === "jpg")
        expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
      if (file.extension === "mp3")
        expect(bytes.subarray(0, 3).toString()).toBe("ID3");
      if (file.extension === "wav") {
        expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString()).toBe("WAVE");
      }
      if (file.extension === "mp4")
        expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
    },
  );
  it("ships real PDF and DOCX binaries", () => {
    expect(
      readFileSync(
        new URL("../../public/demo/brand-guidelines.pdf", import.meta.url),
      )
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(
      readFileSync(
        new URL("../../public/demo/employee-handbook.docx", import.meta.url),
      )
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
  });
});
