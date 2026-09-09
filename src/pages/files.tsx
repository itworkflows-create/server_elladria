import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { useApp, useUser } from "../context";
import { canManage, canView, fileDepartment } from "../lib/access";
import { AccessNote, Badge, Empty, PageHeading } from "../components/common";
import { Button } from "../components/ui/button";
import { FileTable } from "../components/files/file-table";
export function StorageDetails() {
  const { id } = useParams();
  const { db } = useApp();
  const user = useUser();
  const space = db.spaces.find((s) => s.id === id);
  if (!space || !canView(user, space.departmentId, db))
    return (
      <Empty
        title="Storage space unavailable"
        description="This space does not exist or you do not have access."
      />
    );
  const department = db.departments.find((d) => d.id === space.departmentId);
  return (
    <>
      <Link className="back-link" to={`/departments/${space.departmentId}`}>
        <ArrowLeft size={15} />
        {department?.name}
      </Link>
      <PageHeading title={space.name} description={space.description}>
        {canManage(user, space.departmentId, db) && (
          <Button asChild>
            <Link to={`/upload?space=${space.id}`}>
              <Plus size={16} />
              Upload file
            </Link>
          </Button>
        )}
      </PageHeading>
      <div className="mb-6">
        <Badge>
          {canManage(user, space.departmentId, db)
            ? "Full access"
            : "View only"}
        </Badge>
      </div>
      <section className="panel">
        <FileTable files={db.files.filter((f) => f.spaceId === id)} />
      </section>
      <AccessNote />
    </>
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
          files={db.files.filter((f) =>
            canView(user, fileDepartment(db, f.spaceId), db),
          )}
          search={params.get("q") ?? ""}
        />
      </section>
    </>
  );
}
