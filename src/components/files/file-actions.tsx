import { useState } from "react";
import {
  ArrowDownToLine,
  Eye,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";
import { useApp, useUser } from "../../context";
import { canManage, canView } from "../../lib/access";
import { downloadFile } from "../../lib/file-download";
import type { DocumentFile } from "../../types";
import { Button } from "../ui/button";
export function DownloadButton({
  file,
  iconOnly = false,
}: {
  file: DocumentFile;
  iconOnly?: boolean;
}) {
  const user = useUser();
  const { db } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canView(user, file.departmentId, db)) return null;
  return (
    <div>
      <Button
        variant={iconOnly ? "ghost" : "default"}
        size={iconOnly ? "icon" : "default"}
        disabled={busy}
        aria-label={`Download ${file.name}`}
        title="Download file"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await downloadFile(file, user.id);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Download failed. Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <ArrowDownToLine size={16} />
        {!iconOnly && (busy ? "Preparing download…" : "Download file")}
      </Button>
      {error && (
        <p
          role="alert"
          className="max-w-52 whitespace-normal text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
export function FileActions({
  file,
  onPreview,
  onRename,
  onDelete,
  onMove,
}: {
  file: DocumentFile;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  const { db } = useApp();
  const user = useUser();
  const departmentId = file.departmentId;
  if (!canView(user, departmentId, db)) return null;
  return (
    <div className="flex items-start">
      <Button
        variant="ghost"
        size="icon"
        title="View file"
        aria-label={`View ${file.name}`}
        onClick={onPreview}
      >
        <Eye size={16} />
      </Button>
      <DownloadButton file={file} iconOnly />
      {canManage(user, departmentId, db) && (
        <>
          <Button
            variant="ghost"
            size="icon"
            title="Move file"
            aria-label={`Move ${file.name}`}
            onClick={onMove}
          >
            <FolderInput size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Rename file"
            aria-label={`Rename ${file.name}`}
            onClick={onRename}
          >
            <Pencil size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete file"
            aria-label={`Delete ${file.name}`}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </Button>
        </>
      )}
    </div>
  );
}
