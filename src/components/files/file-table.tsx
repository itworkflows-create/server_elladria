import { lazy, Suspense, useState } from "react";
import { Search, X } from "lucide-react";
import { useApp, useUser } from "../../context";
import { canView, fileDepartment } from "../../lib/access";
import { validateFileName } from "../../lib/file-types";
import type { DocumentFile } from "../../types";
import { Avatar, dateLabel, Empty, sizeLabel } from "../common";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { FileIcon } from "./file-icon";
import { FileActions } from "./file-actions";
const FilePreview = lazy(() =>
  import("./file-preview").then((module) => ({ default: module.FilePreview })),
);
export function FileTable({
  files,
  compact = false,
  search: externalSearch = "",
}: {
  files: DocumentFile[];
  compact?: boolean;
  search?: string;
}) {
  const { db, run, pending } = useApp();
  const user = useUser();
  const [search, setSearch] = useState(externalSearch);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocumentFile | null>(null);
  const [renaming, setRenaming] = useState<DocumentFile | null>(null);
  const [name, setName] = useState("");
  const filtered = files
    .filter(
      (file) =>
        canView(user, fileDepartment(db, file.spaceId), db) &&
        file.name.toLowerCase().includes(search.toLowerCase()) &&
        (category === "all" || file.fileCategory === category),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.date.localeCompare(a.date),
    );
  const preview = db.files.find((f) => f.id === previewId);
  const nameError = renaming
    ? validateFileName(name, renaming.extension)
    : null;
  return (
    <>
      <div className="table-tools">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search files"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter file category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              ["all", "All files"],
              ["document", "Documents"],
              ["image", "Images"],
              ["audio", "Audio"],
              ["video", "Videos"],
              ["other", "Other"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort files"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Last uploaded</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>
      {!filtered.length ? (
        <Empty
          title="No files found"
          description="Try a different search or category, or upload a file."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>File name / storage space</th>
                <th>Category</th>
                <th>Department</th>
                <th>Uploaded by</th>
                <th>Upload date</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, compact ? 5 : undefined).map((file) => {
                const owner = db.users.find((u) => u.id === file.uploadedBy);
                const deptId = fileDepartment(db, file.spaceId);
                return (
                  <tr key={file.id}>
                    <td>
                      <button
                        className="file-name"
                        onClick={() => setPreviewId(file.id)}
                      >
                        <FileIcon file={file} />
                        <span className="max-w-64 truncate" title={file.name}>
                          {file.name}
                          <small>
                            {db.spaces.find((s) => s.id === file.spaceId)?.name}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td className="capitalize">{file.fileCategory}</td>
                    <td>{db.departments.find((d) => d.id === deptId)?.name}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar initials={owner?.initials ?? "?"} small />
                        {owner?.name ?? "Former member"}
                      </span>
                    </td>
                    <td>{dateLabel(file.date)}</td>
                    <td>{sizeLabel(file.fileSizeBytes)}</td>
                    <td>
                      <FileActions
                        file={file}
                        onPreview={() => setPreviewId(file.id)}
                        onRename={() => {
                          setRenaming(file);
                          setName(file.name);
                        }}
                        onDelete={() => setDeleting(file)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && (
        <Suspense
          fallback={
            <p role="status" className="p-4 text-sm text-slate-500">
              Opening preview…
            </p>
          }
        >
          <FilePreview
            key={preview.id}
            file={preview}
            close={() => setPreviewId(null)}
          />
        </Suspense>
      )}
      <Modal
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Delete file?"
        description={`This removes ${deleting?.name ?? "this file"} and frees its storage usage.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (
                deleting &&
                (await run({ kind: "deleteFile", id: deleting.id }))
              )
                setDeleting(null);
            }}
          >
            Delete file
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!renaming}
        onOpenChange={() => setRenaming(null)}
        title="Rename file"
        description="Choose a recognizable name. The original extension and file type are preserved."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              renaming &&
              !nameError &&
              (await run({
                kind: "renameFile",
                id: renaming.id,
                name: name.trim(),
              }))
            )
              setRenaming(null);
          }}
        >
          <label>
            File name
            <input
              required
              maxLength={180}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {nameError && <p className="error">{nameError}</p>}
          <Button className="mt-5" disabled={pending || !!nameError}>
            Save name
          </Button>
        </form>
      </Modal>
    </>
  );
}
