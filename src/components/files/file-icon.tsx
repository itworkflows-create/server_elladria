import {
  File,
  FileText,
  FileSpreadsheet,
  Image,
  Music2,
  Video,
} from "lucide-react";
import { getFileIcon } from "../../lib/file-types";
import type { DocumentFile } from "../../types";
const icons = {
  pdf: FileText,
  word: FileText,
  image: Image,
  audio: Music2,
  video: Video,
  spreadsheet: FileSpreadsheet,
  file: File,
};
const colors = {
  pdf: "bg-red-50 text-red-600",
  word: "bg-blue-50 text-blue-600",
  image: "bg-purple-50 text-purple-600",
  audio: "bg-amber-50 text-amber-700",
  video: "bg-teal-50 text-teal-700",
  spreadsheet: "bg-emerald-50 text-emerald-700",
  file: "bg-slate-100 text-slate-600",
};
export function FileIcon({
  file,
  large = false,
}: {
  file: Pick<DocumentFile, "extension" | "fileCategory">;
  large?: boolean;
}) {
  const kind = getFileIcon(file);
  const Icon = icons[kind];
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-lg ${colors[kind]} ${large ? "h-16 w-16" : "h-10 w-9"}`}
    >
      <Icon size={large ? 30 : 20} />
    </span>
  );
}
