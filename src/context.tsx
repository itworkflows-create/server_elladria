import { lazy, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { repository, type Command } from "./data/repository";
import { authRepository } from "./data/auth-repository";
import { Context } from "./app-context";
import { configurationError, isDemoMode } from "./lib/supabase";
import type { Database } from "./types";
const DemoProvider = lazy(() => import("./demo-context").then(m => ({ default: m.DemoAppProvider })));
const empty: Database = { users: [], departments: [], folders: [], files: [], permissions: [], activities: [], storage: { totalCapacityBytes: 0 } };
function Loading({ text }: { text: string }) { return <div role="status" className="p-10"><div className="skeleton h-12 w-56" /><p className="mt-5">{text}</p></div>; }
export function AppProvider({ children }: { children: ReactNode }) {
  if (isDemoMode) return <Suspense fallback={<Loading text="Loading demo…" />}><DemoProvider>{children}</DemoProvider></Suspense>;
  if (configurationError) return <div className="mx-auto max-w-xl p-10"><h1 className="text-2xl font-semibold">Connect Elladria to Supabase</h1><p role="alert" className="mt-4">{import.meta.env.DEV ? configurationError : "Workspace configuration is missing or invalid. Contact your administrator."}</p></div>;
  return <SupabaseAppProvider>{children}</SupabaseAppProvider>;
}
function SupabaseAppProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState("");
  const currentUser = useRef<string | null>(null);
  useEffect(() => {
    let active = true; let authEventSeen = false;
    const update = (next: Session | null) => {
      if (!active) return;
      if (currentUser.current !== (next?.user.id ?? null)) {
        void client.cancelQueries({ queryKey: ["workspace"] });
        client.removeQueries({ queryKey: ["workspace"] });
        if (currentUser.current && !next) setNotice("Your session ended. Please sign in again.");
        currentUser.current = next?.user.id ?? null;
      }
      setSession(next); setRestoring(false);
    };
    const unsubscribe = authRepository.subscribe(next => { authEventSeen = true; update(next); });
    void authRepository.restore().then(next => { if (!authEventSeen) update(next); }).catch(() => { if (active && !authEventSeen) { setNotice("Unable to restore your session. Please sign in again."); setRestoring(false); } });
    return () => { active = false; unsubscribe(); };
  }, [client]);
  const query = useQuery({ queryKey: ["workspace", session?.user.id], queryFn: () => repository.getDatabase(), enabled: !!session, refetchInterval: 30000, refetchOnWindowFocus: true });
  const mutation = useMutation({ mutationFn: (command: Command) => repository.execute(session?.user.id ?? "", command), onSettled: async () => { await client.invalidateQueries({ queryKey: ["workspace"] }); } });
  if (restoring) return <Loading text="Restoring your session…" />;
  if (session && query.isPending) return <Loading text="Loading your profile and workspace…" />;
  const signOut = () => { void authRepository.signOut().catch(error => setNotice(error.message)); };
  const user = session ? query.data?.users.find(u => u.id === session.user.id) : undefined;
  if (session && (query.isError || !user)) return <div className="p-10"><h1 className="text-xl font-semibold">Workspace unavailable</h1><p role="alert" className="mt-3">{query.isError ? "Your workspace could not be loaded. Check your connection and retry." : "Your account profile is unavailable. Contact an administrator."}</p><button className="mt-5 mr-5" onClick={() => void query.refetch()}>Retry</button><button onClick={signOut}>Sign out</button>{notice && <p role="alert">{notice}</p>}</div>;
  return <Context.Provider value={{ db: session ? query.data ?? empty : empty, user, pending: mutation.isPending, notice, dismiss: () => setNotice(""), signOut,
    signIn: async (email, password) => { setNotice(""); await authRepository.signIn(email, password ?? ""); },
    run: async command => { try { await mutation.mutateAsync(command); setNotice("Changes saved successfully."); return true; } catch(error) { setNotice(error instanceof Error ? error.message : "Unable to save changes. Please try again."); return false; } }
  }}>{children}</Context.Provider>;
}
export function useApp() { const context = useContext(Context); if (!context) throw new Error("AppProvider is required"); return context; }
export function useUser() { const { user } = useApp(); if (!user) throw new Error("Sign in required"); return user; }
