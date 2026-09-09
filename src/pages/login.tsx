import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Layers3, ShieldCheck } from "lucide-react";
import { useApp } from "../context";
import { Button } from "../components/ui/button";
import { Avatar } from "../components/common";
const schema = z.object({
  account: z.string().min(1, "Choose a demo account."),
});
export function Login() {
  const { user, db, signIn } = useApp();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { account: "u1" },
  });
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="login">
      <div className="login-story">
        <div className="logo text-white">
          <span>
            <Layers3 size={24} />
          </span>
          elladria.
        </div>
        <div>
          <p className="eyebrow">YOUR WORKSPACE, CONNECTED</p>
          <h1>
            Great work starts
            <br />
            with everything
            <br />
            in its place.
          </h1>
          <p>
            One thoughtful home for your team's documents,
            <br />
            files, and shared knowledge.
          </p>
          <div className="login-art">
            <Layers3 size={120} strokeWidth={0.8} />
          </div>
        </div>
        <small>Organized by department. Connected as a team.</small>
      </div>
      <div className="login-panel">
        <div className="w-full max-w-sm">
          <BadgeIntro />
          <h2>Welcome to your workspace</h2>
          <p className="muted mt-3 mb-8">
            Choose a demo account to explore Elladria.
          </p>
          <form
            onSubmit={handleSubmit(({ account }) => {
              signIn(account);
              navigate("/");
            })}
          >
            <label>
              Demo account
              <select {...register("account")}>
                {db.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
              </select>
            </label>
            {errors.account && (
              <p className="error">{errors.account.message}</p>
            )}
            <Button className="mt-6 w-full" type="submit">
              Enter workspace <ArrowRight size={17} />
            </Button>
          </form>
          <div className="mt-8 space-y-3">
            {db.users
              .filter((u) => ["u1", "u2", "u3"].includes(u.id))
              .map((u) => (
                <div
                  className="flex items-center gap-3 rounded-lg border p-3"
                  key={u.id}
                >
                  <Avatar initials={u.initials} />
                  <div>
                    <strong className="text-sm">{u.role}</strong>
                    <p className="text-xs text-slate-500">
                      {u.role === "Admin"
                        ? "Manage your entire organization"
                        : u.role === "Executive"
                          ? "Explore all departments and documents"
                          : "Your department and shared resources"}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-8 text-xs leading-6 text-slate-500">
            Mock data only. No password or external service is used. Changes are
            saved in this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
function BadgeIntro() {
  return (
    <div className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
      <ShieldCheck size={18} />
      Internal document hub
    </div>
  );
}
