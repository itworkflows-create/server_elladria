import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Folder as FolderIcon,
  MoreHorizontal,
  Plus,
  Upload,
} from "lucide-react";
import { useApp, useUser } from "../../context";
import { canManage } from "../../lib/access";
import {
  getChildFolders,
  getFilesByFolder,
  getFolderBreadcrumbs,
} from "../../lib/folders";
import type { Folder } from "../../types";
import { Empty } from "../common";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { FileTable } from "../files/file-table";
import {
  DeleteFolderDialog,
  FolderNameDialog,
  MoveDialog,
} from "./folder-dialogs";

export function FolderBrowser({
  departmentId,
  folderId = null,
}: {
  departmentId: string;
  folderId?: string | null;
}) {
  const { db } = useApp();
  const user = useUser();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{
    kind: "rename" | "move" | "delete";
    folder: Folder;
  } | null>(null);
  const children = getChildFolders(db, user, departmentId, folderId);
  const files = getFilesByFolder(db, user, departmentId, folderId);
  const breadcrumbs = getFolderBreadcrumbs(db, user, folderId);
  const department = db.departments.find((d) => d.id === departmentId)!;
  const manage = canManage(user, departmentId, db);
  const parent = breadcrumbs.at(-1)?.parentFolderId;
  return (
    <section>
      <nav
        aria-label="Folder breadcrumbs"
        className="mb-5 flex flex-wrap items-center gap-2 break-all text-sm"
      >
        <Link
          className="text-primary hover:underline"
          to={`/departments/${departmentId}`}
          aria-current={!folderId ? "page" : undefined}
        >
          {department.name}
        </Link>
        {breadcrumbs.map((folder) => (
          <span className="contents" key={folder.id}>
            <span aria-hidden="true">/</span>
            <Link
              className="text-primary hover:underline"
              aria-current={folder.id === folderId ? "page" : undefined}
              to={`/folders/${folder.id}`}
            >
              {folder.name}
            </Link>
          </span>
        ))}
      </nav>
      <div className="section-heading flex-wrap gap-3">
        <div>
          {folderId && (
            <Link
              className="back-link"
              to={
                parent ? `/folders/${parent}` : `/departments/${departmentId}`
              }
            >
              <ArrowLeft size={15} />
              Back to parent
            </Link>
          )}
          {folderId ? (
            <h1 className="text-2xl font-semibold break-words">
              {breadcrumbs.at(-1)?.name}
            </h1>
          ) : (
            <h2>Department files and folders</h2>
          )}
          <p>
            {children.length} folders · {files.length} files ·{" "}
            {manage ? "Full access" : "View only"}
          </p>
        </div>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus size={16} />
              New Folder
            </Button>
            <Button asChild>
              <Link
                to={`/upload?department=${departmentId}${folderId ? `&folder=${folderId}` : ""}`}
              >
                <Upload size={16} />
                Upload file
              </Link>
            </Button>
          </div>
        )}
      </div>
      {!!children.length && (
        <ul
          className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Folders"
        >
          {children.map((folder) => (
            <li
              key={folder.id}
              className="panel flex min-w-0 items-center gap-3 p-4"
            >
              <FolderIcon size={26} className="shrink-0 text-amber-500" />
              <Link
                className="min-w-0 flex-1 break-words font-medium hover:text-primary"
                to={`/folders/${folder.id}`}
              >
                {folder.name}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${folder.name}`}
                  >
                    <MoreHorizontal size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() => navigate(`/folders/${folder.id}`)}
                  >
                    Open
                  </DropdownMenuItem>
                  {manage && (
                    <>
                      <DropdownMenuItem
                        onSelect={() => setAction({ kind: "rename", folder })}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setAction({ kind: "move", folder })}
                      >
                        Move
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onSelect={() => setAction({ kind: "delete", folder })}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      {!children.length && !files.length ? (
        <div className="panel">
          <Empty
            title={
              folderId ? "This folder is empty" : "This department is empty"
            }
            description={
              manage
                ? "Create a folder or upload a file to get started."
                : "Files and folders will appear here when added."
            }
          />
        </div>
      ) : (
        <section className="panel">
          <FileTable files={files} />
        </section>
      )}
      {creating && (
        <FolderNameDialog
          departmentId={departmentId}
          parentFolderId={folderId}
          close={() => setCreating(false)}
        />
      )}
      {action?.kind === "rename" && (
        <FolderNameDialog
          folder={action.folder}
          departmentId={departmentId}
          parentFolderId={action.folder.parentFolderId}
          close={() => setAction(null)}
        />
      )}
      {action?.kind === "move" && (
        <MoveDialog
          item={action.folder}
          kind="folder"
          close={() => setAction(null)}
        />
      )}
      {action?.kind === "delete" && (
        <DeleteFolderDialog
          folder={action.folder}
          close={() => setAction(null)}
        />
      )}
    </section>
  );
}
