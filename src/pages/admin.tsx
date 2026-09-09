import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useApp, useUser } from "../context";
import {
  Avatar,
  Badge,
  dateLabel,
  Empty,
  PageHeading,
} from "../components/common";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
import type { Role } from "../types";
const roles: Role[] = ["Admin", "Executive", "Department Member"];
const userSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  role: z.enum(["Admin", "Executive", "Department Member"]),
  departmentId: z.string(),
});
export function UsersPage() {
  const { db, run, pending } = useApp();
  const user = useUser();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All roles");
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "Department Member", departmentId: "" },
  });
  const users = db.users.filter(
    (u) =>
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()) &&
      (role === "All roles" || u.role === role),
  );
  return (
    <>
      <PageHeading
        title="Users"
        description="Good work starts with the right people and the right roles."
      >
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} />
          Add user
        </Button>
      </PageHeading>
      <section className="panel">
        <div className="table-tools">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search users"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter roles"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option>All roles</option>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar initials={u.initials} />
                      <div className="font-medium text-slate-800">
                        {u.name}
                        {u.id === user.id && (
                          <span className="ml-2 text-xs text-slate-400">
                            You
                          </span>
                        )}
                        <small className="block font-normal text-slate-500">
                          {u.email}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {db.departments.find((d) => d.id === u.departmentId)
                      ?.name ?? "Unassigned"}
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={u.id === user.id || pending}
                      onChange={(e) =>
                        void run({
                          kind: "role",
                          id: u.id,
                          role: e.target.value as Role,
                        })
                      }
                    >
                      {roles.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge>Active</Badge>
                  </td>
                  <td>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={u.id === user.id}
                      aria-label={`Remove ${u.name}`}
                      onClick={() => setRemove(u.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && (
          <Empty
            title="No matching users"
            description="Try another name or role."
          />
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add a team member"
        description="Create a mock user and assign their initial role."
      >
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (values) => {
            if (await run({ kind: "user", ...values })) {
              reset();
              setOpen(false);
            }
          })}
        >
          <label>
            Full name
            <input {...register("name")} />
            {errors.name && (
              <span className="error">{errors.name.message}</span>
            )}
          </label>
          <label>
            Email
            <input type="email" {...register("email")} />
            {errors.email && (
              <span className="error">{errors.email.message}</span>
            )}
          </label>
          <label>
            Role
            <select {...register("role")}>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Department
            <select {...register("departmentId")}>
              <option value="">Unassigned</option>
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={pending}>Add user</Button>
        </form>
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={() => setRemove(null)}
        title="Remove user?"
        description="This removes their demo account and permission grants. Existing uploaded files are retained."
      >
        <Button
          variant="destructive"
          disabled={pending}
          onClick={async () => {
            if (remove && (await run({ kind: "deleteUser", id: remove })))
              setRemove(null);
          }}
        >
          Remove user
        </Button>
      </Modal>
    </>
  );
}
const permissionSchema = z.object({
  userId: z.string().min(1, "Choose a member."),
  departmentId: z.string().min(1, "Choose a department."),
  access: z.enum(["View", "Manage"]),
});
export function PermissionsPage() {
  const { db, run, pending } = useApp();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof permissionSchema>>({
    resolver: zodResolver(permissionSchema),
    defaultValues: { userId: "", departmentId: "", access: "View" },
  });
  return (
    <>
      <PageHeading
        title="Permissions"
        description="Open the right doors for collaboration across departments."
      >
        <Button onClick={() => setOpen(true)}>
          <Plus size={17} />
          Grant access
        </Button>
      </PageHeading>
      <div className="info-banner mb-6">
        <ShieldCheck size={22} />
        <div>
          <strong>Access is scoped to departments.</strong>
          <p>
            Admins have full control. Executives can view all departments.
            Members have manage access to their own department.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Cross-department access</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Shared department</th>
                <th>Permission</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {db.permissions.map((p) => {
                const u = db.users.find((u) => u.id === p.userId);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar initials={u?.initials ?? "?"} />
                        {u?.name}
                      </div>
                    </td>
                    <td>
                      {
                        db.departments.find((d) => d.id === p.departmentId)
                          ?.name
                      }
                    </td>
                    <td>
                      <Badge tone={p.access === "Manage" ? "green" : "blue"}>
                        {p.access === "Manage"
                          ? "Manage files"
                          : "View & download"}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => void run({ kind: "revoke", id: p.id })}
                      >
                        Revoke access
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!db.permissions.length && (
          <Empty
            title="No cross-department grants"
            description="Grant a member access to another team's resources."
          />
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Grant department access"
        description="An existing grant for this member and department will be updated."
      >
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (values) => {
            if (await run({ kind: "permission", ...values })) {
              reset();
              setOpen(false);
            }
          })}
        >
          <label>
            Department member
            <select {...register("userId")}>
              <option value="">Select member</option>
              {db.users
                .filter((u) => u.role === "Department Member")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            {errors.userId && (
              <span className="error">{errors.userId.message}</span>
            )}
          </label>
          <label>
            Department to share
            <select {...register("departmentId")}>
              <option value="">Select department</option>
              {db.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.departmentId && (
              <span className="error">{errors.departmentId.message}</span>
            )}
          </label>
          <label>
            Access level
            <select {...register("access")}>
              <option value="View">View — preview and download</option>
              <option value="Manage">
                Manage — upload, rename, and delete files
              </option>
            </select>
          </label>
          <Button disabled={pending}>Grant access</Button>
        </form>
      </Modal>
    </>
  );
}
export function ActivityPage() {
  const { db } = useApp();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const logs = db.activities.filter(
    (a) =>
      `${a.target} ${a.action} ${db.users.find((u) => u.id === a.userId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!department || a.departmentId === department),
  );
  return (
    <>
      <PageHeading
        title="Activity logs"
        description="A clear record of changes across your organization."
      />
      <section className="panel">
        <div className="table-tools">
          <div className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search activity"
              placeholder="Search activity…"
            />
          </div>
          <select
            aria-label="Filter activity by department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Activity</th>
                <th>Department</th>
                <th>Date & time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((a) => {
                const u = db.users.find((u) => u.id === a.userId);
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar initials={u?.initials ?? "?"} small />
                        {u?.name ?? "Former member"}
                      </div>
                    </td>
                    <td>
                      <span className="capitalize">{a.action}</span>
                      <strong className="block text-slate-700 font-medium">
                        {a.target}
                      </strong>
                    </td>
                    <td>
                      {db.departments.find((d) => d.id === a.departmentId)
                        ?.name ?? "Workspace"}
                    </td>
                    <td>
                      {dateLabel(a.date)}
                      <small className="block">
                        {new Date(a.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!logs.length && (
          <Empty
            title="No activity found"
            description="Try another search or department."
          />
        )}
      </section>
    </>
  );
}
