import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Building2,
  FileText,
  FileSpreadsheet,
  Image,
  Folder,
  Search,
  Trash2,
  Pencil,
  X,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp, useUser } from "../context";
import { canManage, fileDepartment } from "../lib/access";
import type { Department, DocumentFile, Space } from "../types";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { formatFileSize, sumFileSizes } from "../lib/storage";
export const sizeLabel = formatFileSize;
export const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({
  initials,
  small = false,
}: {
  initials: string;
  small?: boolean;
}) {
  return <span className={`avatar ${small ? "small" : ""}`}>{initials}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted mt-2">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "New files and resources will appear here.",
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Folder size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function DepartmentCard({ department }: { department: Department }) {
  const { db } = useApp();
  const user = useUser();
  const spaces = db.spaces.filter((s) => s.departmentId === department.id);
  const files = db.files.filter((f) => spaces.some((s) => s.id === f.spaceId));
  return (
    <Link
      to={`/departments/${department.id}`}
      className="department-card group"
    >
      <div className="flex items-center justify-between">
        <span className={`department-icon ${department.color}`}>
          <Building2 size={23} />
        </span>
        <ArrowUpRight
          size={18}
          className="text-slate-400 group-hover:text-primary"
        />
      </div>
      <h3>{department.name}</h3>
      <p>{department.description}</p>
      <div className="card-meta">
        <span>
          <Folder size={14} />
          {spaces.length} spaces <span className="mx-1">·</span> {files.length}{" "}
          files
        </span>
        <Badge tone={canManage(user, department.id, db) ? "green" : "gray"}>
          {canManage(user, department.id, db) ? "Full access" : "View only"}
        </Badge>
      </div>
    </Link>
  );
}
export function SpaceCard({ space }: { space: Space }) {
  const { db } = useApp();
  const files = db.files.filter((f) => f.spaceId === space.id);
  return (
    <Link className="department-card group" to={`/storage/${space.id}`}>
      <div className="flex items-center justify-between">
        <span className="department-icon amber">
          <Folder size={25} />
        </span>
        <ArrowUpRight size={18} className="text-slate-400" />
      </div>
      <h3>{space.name}</h3>
      <p>{space.description}</p>
      <div className="card-meta">
        <span>{files.length} files</span>
        <span>{sizeLabel(sumFileSizes(files))}</span>
      </div>
    </Link>
  );
}
export function FileIcon({ type }: { type: DocumentFile["type"] }) {
  const Icon =
    type === "XLSX" ? FileSpreadsheet : type === "PNG" ? Image : FileText;
  return (
    <span className={`file-icon ${type.toLowerCase()}`}>
      <Icon size={20} />
    </span>
  );
}
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
  const [type, setType] = useState("All types");
  const [sort, setSort] = useState("recent");
  const [preview, setPreview] = useState<DocumentFile | null>(null);
  const [deleting, setDeleting] = useState<DocumentFile | null>(null);
  const [renaming, setRenaming] = useState<DocumentFile | null>(null);
  const [name, setName] = useState("");
  const filtered = files
    .filter(
      (f) =>
        f.name.toLowerCase().includes(search.toLowerCase()) &&
        (type === "All types" || f.type === type),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.date.localeCompare(a.date),
    );
  function download(file: DocumentFile) {
    const a = document.createElement("a");
    const url =
      file.dataUrl ||
      URL.createObjectURL(new Blob([file.content], { type: "text/plain" }));
    a.href = url;
    a.download = file.dataUrl ? file.name : `${file.name}.mock.txt`;
    a.click();
    if (!file.dataUrl) URL.revokeObjectURL(url);
  }
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
        <div className="flex gap-2">
          <select
            aria-label="Filter file type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option>All types</option>
            {["PDF", "DOCX", "XLSX", "PNG"].map((t) => (
              <option key={t}>{t}</option>
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
          description="Try a different search or upload your first file."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>File name</th>
                <th>Department</th>
                <th>Uploaded by</th>
                <th>Date added</th>
                <th>Size</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
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
                        onClick={() => setPreview(file)}
                      >
                        <FileIcon type={file.type} />
                        <span>
                          {file.name}
                          <small>
                            {db.spaces.find((s) => s.id === file.spaceId)?.name}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="department-dot" />
                      {db.departments.find((d) => d.id === deptId)?.name}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar initials={owner?.initials ?? "?"} small />
                        {owner?.name ?? "Former member"}
                      </span>
                    </td>
                    <td>{dateLabel(file.date)}</td>
                    <td className="whitespace-nowrap">
                      {sizeLabel(file.fileSizeBytes)}
                    </td>
                    <td>
                      <div className="flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download file"
                          aria-label={`Download ${file.name}`}
                          onClick={() => download(file)}
                        >
                          <ArrowDownToLine size={16} />
                        </Button>
                        {!compact && canManage(user, deptId, db) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Rename ${file.name}`}
                              onClick={() => {
                                setRenaming(file);
                                setName(file.name);
                              }}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${file.name}`}
                              onClick={() => setDeleting(file)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={!!preview}
        onOpenChange={() => setPreview(null)}
        title={preview?.name ?? "File preview"}
        description={
          preview?.dataUrl
            ? "Uploaded file · browser preview"
            : "Demo document · sample text preview"
        }
      >
        {preview && (
          <>
            {preview.type === "PNG" && preview.dataUrl ? (
              <img
                src={preview.dataUrl}
                alt={preview.name}
                className="max-h-96 w-full object-contain"
              />
            ) : preview.type === "PDF" && preview.dataUrl ? (
              <iframe
                title={preview.name}
                src={preview.dataUrl}
                className="h-96 w-full"
              />
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-5 font-sans text-sm leading-7">
                {preview.dataUrl
                  ? "Preview is not available for Office files. Download this file to open it in your preferred application."
                  : preview.content}
              </pre>
            )}
            <p className="my-4 text-xs text-slate-500">
              {preview.dataUrl
                ? "Downloads preserve the original uploaded file."
                : "Seed documents contain sample text. Their downloads use a .mock.txt extension."}
            </p>
            <Button onClick={() => download(preview)}>
              <ArrowDownToLine size={16} />
              Download file
            </Button>
          </>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Delete file?"
        description={`This removes ${deleting?.name ?? "this file"} from the demo workspace.`}
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
        description="Choose a clear, recognizable file name."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              renaming &&
              name.trim() &&
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
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button className="mt-5" disabled={pending || !name.trim()}>
            Save name
          </Button>
        </form>
      </Modal>
    </>
  );
}
export function AccessNote() {
  return (
    <div className="access-note">
      <ShieldCheck size={17} />
      <span>Your workspace is protected by role-based access.</span>
    </div>
  );
}
