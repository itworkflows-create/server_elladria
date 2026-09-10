import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseRepository } from "./supabase-repository";
import { createSupabaseFileService, SIGNED_URL_SECONDS } from "../lib/supabase-file-service";
import { validateSupabaseConfig } from "../lib/supabase";
import { validateIncomingFile } from "../../supabase/functions/_shared/files";
import { mapRole, mapPermission } from "./supabase-mappers";
const row = { id: "file-id", department_id: "department-id", folder_id: null, file_name: "Renamed.pdf", original_file_name: "Original.pdf", storage_path: "departments/department-id/file-id/original.pdf", file_size_bytes: 10, mime_type: "application/pdf", extension: "pdf", file_category: "document", uploaded_by: "member", created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z", description: "", status: "ready" };
function fixture() {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.test/private-token" }, error: null });
  const client = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn().mockResolvedValue({ error: null }) }, storage: { from: vi.fn(() => ({ createSignedUrl })) } };
  return { client, query, single, createSignedUrl, repository: createSupabaseRepository(() => client as unknown as SupabaseClient), service: createSupabaseFileService(() => client as unknown as SupabaseClient) };
}
afterEach(() => vi.unstubAllGlobals());
describe("Supabase adapter boundaries", () => {
  it("sends uploaded bytes to the server and never uses the supplied actor as authorization", async () => {
    const { repository, client } = fixture();
    const sourceFile = new File(["pdf bytes"], "Original.pdf", { type: "application/pdf" });
    await repository.execute("forged-admin", { kind: "upload", file: { sourceFile, name: sourceFile.name, fileSizeBytes: sourceFile.size, departmentId: "department-id", folderId: null, content: "Description" } });
    const [name, options] = client.functions.invoke.mock.calls[0];
    expect(name).toBe("workspace-files");
    const body = options.body as FormData;
    expect(await (body.get("file") as File).text()).toBe("pdf bytes");
    expect(body.get("departmentId")).toBe("department-id");
    expect(body.get("folderId")).toBe("");
    expect(body.has("actor")).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("routes privileged and destructive commands through their server boundaries", async () => {
    const { repository, client } = fixture();
    await repository.execute("actor", { kind: "user", name: "Member", email: "member@example.test", password: "temporary-password", role: "Department Member" });
    expect(client.functions.invoke).toHaveBeenLastCalledWith("manage-users", { body: expect.objectContaining({ role: "department_member" }) });
    await repository.execute("actor", { kind: "deleteFolder", id: "folder", confirmRecursive: true });
    expect(client.functions.invoke).toHaveBeenLastCalledWith("workspace-files", { body: { kind: "deleteFolder", id: "folder", confirmRecursive: true } });
    await repository.execute("actor", { kind: "permission", userId: "member", departmentId: "department", access: "View" });
    expect(client.rpc).toHaveBeenLastCalledWith("elladria_command", { command: expect.objectContaining({ access: "view" }) });
    await repository.execute("actor", { kind: "role", id: "member", role: "Executive" });
    expect(client.rpc).toHaveBeenLastCalledWith("elladria_command", { command: { kind: "role", id: "member", role: "executive" } });
  });
  it("surfaces server quota errors without leaking internal errors", async () => {
    const { repository, client } = fixture();
    client.functions.invoke.mockResolvedValueOnce({ error: { context: new Response(JSON.stringify({ error: "APP_QUOTA" })) } });
    await expect(repository.execute("actor", { kind: "deleteFile", id: "file" })).rejects.toThrow("department storage quota");
    client.rpc.mockResolvedValueOnce({ error: { message: "secret database details" } });
    await expect(repository.execute("actor", { kind: "profile", name: "Name" })).rejects.toThrow("Check your connection");
  });
  it("checks readable metadata before signing and uses short-lived private URLs", async () => {
    const { service, client, createSignedUrl, single, query } = fixture();
    const preview = await service.getPreview("file-id", "member");
    expect(preview.source?.url).toBe("https://example.test/private-token");
    expect(client.storage.from).toHaveBeenCalledWith("company-files");
    expect(createSignedUrl).toHaveBeenCalledWith(row.storage_path, SIGNED_URL_SECONDS, undefined);
    expect(SIGNED_URL_SECONDS).toBe(60);
    expect(query.eq).toHaveBeenCalledWith("status", "ready");
    createSignedUrl.mockClear();
    single.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(service.getPreview("file-id", "outsider")).rejects.toThrow("unavailable");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
  it("downloads original bytes with the current filename and handles expired links", async () => {
    const { service, createSignedUrl } = fixture();
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes));
    vi.stubGlobal("fetch", fetcher);
    const result = await service.download("file-id", "member");
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
    expect(result.fileName).toBe("Renamed.pdf");
    expect(createSignedUrl).toHaveBeenCalledWith(row.storage_path, 60, { download: "Renamed.pdf" });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(service.download("file-id", "member")).rejects.toThrow("expired");
  });
  it("keeps Word and spreadsheet previews download-only", async () => {
    const { service, single, createSignedUrl } = fixture();
    for (const extension of ["docx", "xlsx"]) {
      single.mockResolvedValueOnce({ data: { ...row, extension }, error: null });
      expect((await service.getPreview("file-id", "member")).source).toBeNull();
    }
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
describe("configuration and server upload validation", () => {
  it("rejects missing configuration and private keys in browser configuration", () => {
    expect(validateSupabaseConfig()).toContain("Configure");
    expect(validateSupabaseConfig("https://example.supabase.co", "sb_secret_private")).toContain("secret key");
    const serviceJwt = `e30.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect(validateSupabaseConfig("https://example.supabase.co", serviceJwt)).toContain("service-role");
    expect(validateSupabaseConfig("http://example.test", "sb_publishable_public")).toContain("HTTPS");
    expect(validateSupabaseConfig("http://localhost:54321", "sb_publishable_public")).toBeNull();
    expect(validateSupabaseConfig("https://example.supabase.co", "sb_publishable_public")).toBeNull();
    expect(() => mapRole("owner")).toThrow("unsupported role");
    expect(() => mapPermission("write")).toThrow("unsupported permission");
  });
  it("validates MIME, names and exact size limits on the server", () => {
    expect(validateIncomingFile({ name: "Recording.mp3", type: "audio/mp3", size: 2_000_000 })).toBe("audio/mpeg");
    for (const file of [
      { name: "bad.exe", type: "", size: 1 },
      { name: "../file.pdf", type: "application/pdf", size: 1 },
      { name: "file.pdf", type: "image/png", size: 1 },
      { name: "file.pdf", type: "application/pdf", size: 0 },
      { name: "file.pdf", type: "application/pdf", size: 2_000_001 },
    ]) expect(() => validateIncomingFile(file)).toThrow("APP_FILE_VALIDATION");
  });
});
