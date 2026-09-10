import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
export const authRepository = {
  async restore(): Promise<Session | null> {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw new Error("Unable to restore your session. Please sign in again.");
    return data.session;
  },
  subscribe(callback: (session: Session | null) => void) {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
  async signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error("Sign-in failed. Check your email and password, and make sure your connection is available.");
  },
  async signOut() {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error) throw new Error("Unable to sign out. Please check your connection and try again.");
  },
};
