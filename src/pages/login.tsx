import { lazy, Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate } from "react-router-dom";
import { ArrowRight, Layers3, ShieldCheck } from "lucide-react";
import { useApp } from "../context";
import { Button } from "../components/ui/button";
import { isDemoMode } from "../lib/supabase";
import { ThemeToggle } from "../components/theme-toggle";
const DemoLogin = lazy(() => import("./demo-login").then(m => ({ default: m.DemoLogin })));
const schema = z.object({ email: z.string().trim().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });
export function Login() { return <><div className="login-theme-toggle"><ThemeToggle /></div>{isDemoMode ? <Suspense fallback={<p role="status">Loading…</p>}><DemoLogin /></Suspense> : <SupabaseLogin />}</>; }
function SupabaseLogin() {
  const { user, signIn, notice } = useApp();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/" replace />;
  return <div className="login"><div className="login-story"><div className="logo text-white"><span><Layers3 size={24} /></span>elladria.</div><div><p className="eyebrow">YOUR WORKSPACE, CONNECTED</p><h1>Great work starts<br />with everything<br />in its place.</h1><p>One thoughtful home for your team's documents,<br />files, and shared knowledge.</p><div className="login-art"><Layers3 size={120} strokeWidth={0.8} /></div></div><small>Organized by department. Connected as a team.</small></div>
  <div className="login-panel"><div className="w-full max-w-sm"><div className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck size={18} />Internal document hub</div><h2>Welcome to your workspace</h2><p className="muted mt-3 mb-8">Sign in with your work email and password.</p>
  <form className="form-stack" onSubmit={handleSubmit(async values => { setError(""); try { await signIn(values.email, values.password); } catch(e) { setError(e instanceof Error ? e.message : "Sign-in failed. Please try again."); } })}>
    <label>Email<input type="email" autoComplete="username" {...register("email")} />{errors.email && <span className="error">{errors.email.message}</span>}</label>
    <label>Password<input type="password" autoComplete="current-password" {...register("password")} />{errors.password && <span className="error">{errors.password.message}</span>}</label>
    {(error || notice) && <p role="alert" className="error">{error || notice}</p>}
    <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Enter workspace"}<ArrowRight size={17} /></Button>
  </form><p className="mt-8 text-xs leading-6 text-slate-500">Your administrator manages workspace accounts and access.</p></div></div></div>;
}
