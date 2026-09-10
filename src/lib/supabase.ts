import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export function validateSupabaseConfig(url?: string, key?: string): string | null {
  if (!url || !key || url.includes("YOUR_PROJECT") || key.includes("YOUR_PUBLIC")) return "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart Vite. See README.md for Supabase setup. For an offline demo, explicitly set VITE_DATA_MODE=demo.";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return "Supabase requires an HTTPS URL (HTTP is allowed only for local development).";
  } catch { return "VITE_SUPABASE_URL must be a valid Supabase project URL."; }
  if (key.startsWith("sb_secret_")) return "A secret key cannot be used in the browser. Use the public anon/publishable key.";
  if (key.split(".").length === 3) {
    try { if (JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") return "Use an anon key, never a service-role JWT in the browser."; } catch { return "The Supabase anon key is invalid."; }
  } else if (!key.startsWith("sb_publishable_")) return "Use the project's public anon JWT or sb_publishable_ key.";
  return null;
}
export const isDemoMode = import.meta.env.VITE_DATA_MODE === "demo";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configurationError = isDemoMode ? null : validateSupabaseConfig(url, key);
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (configurationError) throw new Error(configurationError);
  if (!client) client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
