import { writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { createMockPdf } from "../src/lib/mock-pdf.ts";
const pdf = createMockPdf(
  "Elladria brand guidelines",
  "A connected workspace\n\nClarity, connection, and thoughtful design.\nPrimary colors: forest green and warm white.\nVoice: confident, clear, and human.\n\nSynthetic demo document.",
);
await writeFile(
  new URL("../public/demo/brand-guidelines.pdf", import.meta.url),
  Buffer.from(await pdf.arrayBuffer()),
);
