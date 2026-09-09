import { ArrowUpRight, Building2, Folder, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp, useUser } from "../context";
import { canManage } from "../lib/access";
import type { Department, Space } from "../types";

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
export function AccessNote() {
  return (
    <div className="access-note">
      <ShieldCheck size={17} />
      <span>Your workspace is protected by role-based access.</span>
    </div>
  );
}
