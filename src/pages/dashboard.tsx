import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Files,
  Folder,
  HardDrive,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp, useUser } from "../context";
import { canManage, canView, fileDepartment } from "../lib/access";
import {
  Avatar,
  DepartmentCard,
  Empty,
  FileTable,
  PageHeading,
  sizeLabel,
} from "../components/common";
import { Button } from "../components/ui/button";
import {
  calculateStorageUsage,
  getDepartmentStorage,
  getSystemStorage,
} from "../lib/storage";
import { StorageMeter } from "../components/storage/storage-meter";
export function Dashboard() {
  const { db } = useApp();
  const user = useUser();
  const departments = db.departments.filter((d) => canView(user, d.id, db));
  const spaces = db.spaces.filter((s) => canView(user, s.departmentId, db));
  const files = db.files.filter((f) =>
    canView(user, fileDepartment(db, f.spaceId), db),
  );
  const storage =
    user.role !== "Department Member"
      ? getSystemStorage(db)
      : user.departmentId
        ? getDepartmentStorage(db, user.departmentId)
        : calculateStorageUsage([], 0);
  const bytes = storage.usedBytes;
  const activities = db.activities
    .filter(
      (a) =>
        user.role !== "Department Member" ||
        (a.departmentId && canView(user, a.departmentId, db)),
    )
    .slice(0, 4);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE MORE ORGANIZED, EVERY DAY"
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Here's what's happening across your workspace."
      >
        {departments.some((d) => canManage(user, d.id, db)) && (
          <Button asChild>
            <Link to="/upload">
              <Plus size={17} />
              Upload file
            </Link>
          </Button>
        )}
      </PageHeading>
      <section className="welcome-banner">
        <div>
          <span className="banner-label">
            <span className="status-dot" />
            ALL YOUR WORK. ONE PLACE.
          </span>
          <h2>
            Good things happen
            <br />
            when teams stay connected.
          </h2>
          <p>Find what you need. Share what matters. Keep work moving.</p>
          <Link
            to={
              user.role === "Department Member"
                ? "/my-department"
                : "/departments"
            }
          >
            Explore your workspace <ArrowRight size={16} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-folder">
            <Folder size={76} strokeWidth={1.1} />
            <span>
              <ShieldIcon />
            </span>
          </div>
          <div className="art-document">
            <span />
            <span />
            <span />
            <Sparkles size={22} />
          </div>
          <span className="art-spark">✦</span>
        </div>
      </section>
      <section className="stats-grid" aria-label="Workspace statistics">
        {[
          {
            label: "Total files",
            value: files.length,
            note: "Across accessible departments",
            icon: Files,
            color: "green",
          },
          {
            label: "Departments",
            value: departments.length.toString().padStart(2, "0"),
            note: "Connected in your workspace",
            icon: Building2,
            color: "purple",
          },
          {
            label: "Storage spaces",
            value: spaces.length.toString().padStart(2, "0"),
            note: "Organized, ready to explore",
            icon: Folder,
            color: "orange",
          },
          {
            label: "Storage used",
            value: sizeLabel(bytes),
            note:
              user.role === "Department Member"
                ? `Of ${sizeLabel(storage.capacityBytes)} department quota`
                : `Of ${sizeLabel(storage.capacityBytes)} system capacity`,
            icon: HardDrive,
            color: "blue",
          },
        ].map(({ label, value, note, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className="flex justify-between items-center">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
            {label === "Storage used" && (
              <div className="mt-3">
                <StorageMeter usage={storage} label="Dashboard storage usage" />
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="mt-8">
        <div className="section-heading">
          <div>
            <h2>
              Your departments{" "}
              <span className="count-label">{departments.length}</span>
            </h2>
            <p>A home for every team's knowledge.</p>
          </div>
          <Button variant="ghost" asChild>
            <Link
              to={
                user.role === "Department Member"
                  ? "/my-department"
                  : "/departments"
              }
            >
              View departments <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
        <div className="department-grid">
          {departments.slice(0, 3).map((d) => (
            <DepartmentCard key={d.id} department={d} />
          ))}
        </div>
        {!departments.length && (
          <Empty
            title="Your next chapter starts here"
            description="Create your department to start organizing files."
          >
            <Button asChild>
              <Link to="/my-department">Create department</Link>
            </Button>
          </Empty>
        )}
      </section>
      <section className="panel mt-8">
        <div className="section-heading panel-heading">
          <div>
            <h2>Recent uploads</h2>
            <p>The latest additions to your workspace.</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/search">
              View all files <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
        <FileTable files={files} compact />
      </section>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="section-heading panel-heading">
            <div>
              <h2>Workspace activity</h2>
              <p>A quick look at what’s moving.</p>
            </div>
            {user.role !== "Department Member" && (
              <Link to="/activity" aria-label="View all activity">
                <ArrowUpRight size={19} />
              </Link>
            )}
          </div>
          <div className="activity-preview">
            {activities.map((a) => {
              const actor = db.users.find((u) => u.id === a.userId);
              return (
                <div key={a.id}>
                  <Avatar initials={actor?.initials ?? "?"} />
                  <p>
                    <strong>{actor?.name ?? "Former member"}</strong> {a.action}
                    <span>{a.target}</span>
                  </p>
                  <small>
                    {new Date(a.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </div>
              );
            })}
            {!activities.length && (
              <p className="muted">
                Your department's activity will appear here.
              </p>
            )}
          </div>
        </section>
        <section className="storage-panel">
          <span className="department-icon green">
            <HardDrive size={22} />
          </span>
          <h2>Room for your next big idea.</h2>
          <p>
            {user.role === "Department Member"
              ? "Your department uses"
              : "Your workspace uses"}{" "}
            {sizeLabel(bytes)} of {sizeLabel(storage.capacityBytes)}.{" "}
            {sizeLabel(storage.remainingBytes)} remains available.
          </p>
          <StorageMeter usage={storage} label="Workspace storage usage" />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{sizeLabel(bytes)} used</span>
            <span>{sizeLabel(storage.capacityBytes)} capacity</span>
          </div>
          {user.role !== "Department Member" && (
            <Button variant="outline" asChild className="mt-5 mr-2">
              <Link to="/storage">
                <HardDrive size={15} />
                View storage usage
              </Link>
            </Button>
          )}
          {user.role !== "Executive" && (
            <Button variant="outline" asChild className="mt-5">
              <Link to="/upload">
                <Upload size={15} />
                Add something new
              </Link>
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
