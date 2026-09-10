import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() }));
vi.mock("../lib/supabase", () => ({ getSupabase: () => ({ auth }) }));
import { authRepository } from "./auth-repository";
beforeEach(() => vi.resetAllMocks());
describe("Supabase authentication", () => {
  it("restores real sessions and propagates session termination with unsubscribe", async () => {
    const session = { user: { id: "member" }, access_token: "test-session" };
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    expect(await authRepository.restore()).toEqual(session);
    const unsubscribe = vi.fn();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
    const listener = vi.fn();
    const stop = authRepository.subscribe(listener);
    const callback = auth.onAuthStateChange.mock.calls[0][0];
    callback("SIGNED_IN", session);
    callback("SIGNED_OUT", null);
    expect(listener.mock.calls).toEqual([[session], [null]]);
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("uses email/password login and clears the local auth session on logout", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    await authRepository.signIn(" member@example.test ", "password");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "member@example.test", password: "password" });
    await authRepository.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("reports auth failures without exposing server details or pretending success", async () => {
    auth.getSession.mockResolvedValue({ error: new Error("internal") });
    auth.signInWithPassword.mockResolvedValue({ error: new Error("internal") });
    auth.signOut.mockResolvedValue({ error: new Error("internal") });
    await expect(authRepository.restore()).rejects.toThrow("Unable to restore");
    await expect(authRepository.signIn("member@example.test", "wrong")).rejects.toThrow("Sign-in failed");
    await expect(authRepository.signOut()).rejects.toThrow("Unable to sign out");
  });
});
