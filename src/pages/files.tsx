import { Navigate, useParams, useSearchParams } from "react-router-dom";

import { useApp, useUser } from "../context";
import { canView } from "../lib/access";
import { Empty, PageHeading } from "../components/common";
import { FolderBrowser } from "../components/folders/folder-browser";
import { FileTable } from "../components/files/file-table";
export function StorageDetails() {
  const { id } = useParams();
  return <Navigate to={`/folders/${id}`} replace />;
}
export function FolderDetails() {
  const { id } = useParams();
  const { db } = useApp();
  const user = useUser();
  const folder = db.folders.find((f) => f.id === id);
  if (!folder || !canView(user, folder.departmentId, db))
    return (
      <Empty
        title="Folder unavailable"
        description="This folder does not exist or you do not have access."
      />
    );
  return (
    <FolderBrowser
      key={folder.id}
      departmentId={folder.departmentId}
      folderId={folder.id}
    />
  );
}
export function SearchFiles() {
  const { db } = useApp();
  const user = useUser();
  const [params] = useSearchParams();
  return (
    <>
      <PageHeading
        title="All files"
        description="Find the right document across your accessible departments."
      />
      <section className="panel">
        <FileTable
          key={params.get("q")}
          files={db.files.filter((f) => canView(user, f.departmentId, db))}
          search={params.get("q") ?? ""}
        />
      </section>
    </>
  );
}
