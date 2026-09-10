import { createClient } from "npm:@supabase/supabase-js@2";
export function cors(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map(s => s.trim());
  if (origin && !allowed.includes(origin)) throw new Error("APP_PERMISSION");
  return { "Access-Control-Allow-Origin": origin ?? allowed[0], "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
}
export function json(body: unknown, headers: Record<string,string>, status=200) { return new Response(JSON.stringify(body), { status, headers }); }
export function failure(error: unknown, headers: Record<string,string>) {
  const e = error as { message?: string; code?: string };
  const code = e?.message?.match(/\bAPP_[A-Z_]+\b/)?.[0] ?? "APP_REQUEST_FAILED";
  return json({ error: code, code: e?.code === "23505" ? "23505" : undefined }, headers, code === "APP_SESSION" ? 401 : code === "APP_PERMISSION" ? 403 : 400);
}
export async function clients(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("APP_SESSION");
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await user.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("APP_SESSION");
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  return { user, service, actor: data.user.id };
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("APP_INVALID_COMMAND");
  return value;
}
