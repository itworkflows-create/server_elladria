import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Pencil,
} from "lucide-react";
import { useApp, useUser } from "../context";
import { canManage, canView } from "../lib/access";
import {
  AccessNote,
  Badge,
  DepartmentCard,
  Empty,
  PageHeading,
  SpaceCard,
} from "../components/common";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
import { CreateResource } from "../components/create-resource";
import { DepartmentStorage } from "../components/storage/department-storage";
export function Departments({
  mode = "all",
}: {
  mode?: "all" | "shared" | "mine";
}) {
  const { db } = useApp();
  const user = useUser();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  if (mode === "mine" && user.departmentId)
    return <DepartmentDetails departmentId={user.departmentId} />;
  const departments = db.departments
    .filter((d) =>
      mode === "shared"
        ? db.permissions.some(
            (p) => p.userId === user.id && p.departmentId === d.id,
          )
        : mode === "mine"
          ? false
          : canView(user, d.id, db),
    )
    .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const canCreate =
    user.role === "Admin" ||
    (mode === "mine" &&
      user.role === "Department Member" &&
      !user.departmentId);
  return (
    <>
      <PageHeading
        eyebrow="YOUR CONNECTED WORKSPACE"
        title={
          mode === "shared"
            ? "Shared with me"
            : mode === "mine"
              ? "My department"
              : "All departments"
        }
        description={
          mode === "shared"
            ? "Resources from other teams, shared with you by an administrator."
            : "Explore the teams, spaces, and knowledge that bring us together."
        }
      >
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Create department
          </Button>
        )}
      </PageHeading>
      {mode === "shared" && (
        <div className="info-banner">
          <ShieldCheck size={20} />
          <div>
            <strong>Collaboration, with the right access.</strong>
            <p>
              View access lets you preview and download. Manage access also lets
              you upload and organize files.
            </p>
          </div>
        </div>
      )}
      <div className="section-heading mt-6">
        <div className="search-field bg-white">
          <Search size={17} />
          <input
            placeholder="Find a department…"
            aria-label="Search departments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted text-sm">{departments.length} departments</span>
      </div>
      {departments.length ? (
        <div className="department-grid">
          {departments.map((d) => (
            <DepartmentCard key={d.id} department={d} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              search
                ? "No departments found"
                : mode === "shared"
                  ? "No shared departments yet"
                  : "Make room for your team"
            }
            description={
              search
                ? "Try a different department name."
                : mode === "shared"
                  ? "Departments will appear here when an administrator grants you access."
                  : "Create your department, then add storage spaces and files."
            }
          >
            {canCreate && (
              <Button onClick={() => setOpen(true)}>
                <Plus size={16} />
                Create department
              </Button>
            )}
          </Empty>
        </div>
      )}
      <AccessNote />
      <CreateResource open={open} close={() => setOpen(false)} />
    </>
  );
}
export function DepartmentDetails({ departmentId }: { departmentId?: string }) {
  const { id } = useParams();
  const { db, run, pending } = useApp();
  const user = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState(false);
  const [rename, setRename] = useState(false);
  const [name, setName] = useState("");
  const dept = db.departments.find((d) => d.id === (departmentId ?? id));
  if (!dept || !canView(user, dept.id, db))
    return (
      <Empty
        title="Department unavailable"
        description="This department does not exist or you do not have access."
      />
    );
  const spaces = db.spaces.filter((s) => s.departmentId === dept.id);
  return (
    <>
      <Link
        className="back-link"
        to={user.role === "Department Member" ? "/" : "/departments"}
      >
        <ArrowLeft size={15} />
        Back to workspace
      </Link>
      <PageHeading title={dept.name} description={dept.description}>
        {user.role === "Admin" && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setName(dept.name);
                setRename(true);
              }}
            >
              <Pencil size={15} />
              Rename
            </Button>
            <Button variant="outline" onClick={() => setRemove(true)}>
              <Trash2 size={15} />
              Delete
            </Button>
          </>
        )}
        {canManage(user, dept.id, db) && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Create space
          </Button>
        )}
      </PageHeading>
      <div className="flex flex-wrap gap-3 mb-8">
        <Badge>
          {canManage(user, dept.id, db) ? "Full access" : "View only"}
        </Badge>
        <Badge tone="gray">{spaces.length} storage spaces</Badge>
        <Badge tone="gray">{dept.members} team members</Badge>
      </div>
      <DepartmentStorage key={dept.id} departmentId={dept.id} />
      <div className="section-heading">
        <div>
          <h2>Storage spaces</h2>
          <p>Everything your team needs, thoughtfully organized.</p>
        </div>
      </div>
      <div className="department-grid">
        {spaces.map((s) => (
          <SpaceCard key={s.id} space={s} />
        ))}
      </div>
      {!spaces.length && (
        <div className="panel">
          <Empty
            title="A fresh space for your team"
            description="Create your first storage space to start adding files."
          >
            {canManage(user, dept.id, db) && (
              <Button onClick={() => setOpen(true)}>
                Create storage space
              </Button>
            )}
          </Empty>
        </div>
      )}
      <AccessNote />
      <CreateResource
        open={open}
        close={() => setOpen(false)}
        departmentId={dept.id}
      />
      <Modal
        open={remove}
        onOpenChange={setRemove}
        title="Delete department?"
        description={`This permanently removes ${dept.name}, its ${spaces.length} storage spaces, all files inside them, and access grants from this demo. Members become unassigned.`}
      >
        <Button
          disabled={pending}
          variant="destructive"
          onClick={async () => {
            if (await run({ kind: "deleteDepartment", id: dept.id }))
              navigate("/departments");
          }}
        >
          Delete department
        </Button>
      </Modal>
      <Modal
        open={rename}
        onOpenChange={setRename}
        title="Rename department"
        description="Update how this department appears across the workspace."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              name.trim().length >= 2 &&
              (await run({
                kind: "renameDepartment",
                id: dept.id,
                name: name.trim(),
              }))
            )
              setRename(false);
          }}
        >
          <label>
            Department name
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button className="mt-4" disabled={pending || name.trim().length < 2}>
            Save name
          </Button>
        </form>
      </Modal>
    </>
  );
}
