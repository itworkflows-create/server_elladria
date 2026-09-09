import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApp, useUser } from "../context";
import { Avatar, Badge, PageHeading } from "../components/common";
import { Button } from "../components/ui/button";
const schema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
});
export function SettingsPage() {
  const { run, pending, db } = useApp();
  const user = useUser();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name },
  });
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make yourself at home in your workspace."
      />
      <div className="settings-grid">
        <section className="panel p-7">
          <h2>Profile</h2>
          <div className="my-6 flex items-center gap-4">
            <Avatar initials={user.initials} />
            <div>
              <strong>{user.name}</strong>
              <div className="mt-1">
                <Badge>{user.role}</Badge>
              </div>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={handleSubmit(async (values) => {
              await run({ kind: "profile", name: values.name });
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
              <input value={user.email} disabled />
            </label>
            <label>
              Department
              <input
                value={
                  db.departments.find((d) => d.id === user.departmentId)
                    ?.name ?? "Unassigned"
                }
                disabled
              />
            </label>
            <div>
              <Button disabled={pending}>Save changes</Button>
            </div>
          </form>
        </section>
        <section className="panel p-7 h-fit">
          <h2>About this workspace</h2>
          <dl className="settings-details">
            <div>
              <dt>Organization</dt>
              <dd>Elladria</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>
                <Badge tone="amber">Local demo</Badge>
              </dd>
            </div>
            <div>
              <dt>Data storage</dt>
              <dd>This browser</dd>
            </div>
            <div>
              <dt>Authentication</dt>
              <dd>Demo accounts</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>0.1.0</dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-slate-500">
            Sign out to try another role. Your mock changes remain in this
            browser between sessions.
          </p>
        </section>
      </div>
    </>
  );
}
