import { describe, expect, it } from "vitest";
import { seed } from "../data/seed";
import { canAdmin, canManage, canView, canViewLogs } from "./access";
describe("role access matrix", () => {
  const [admin, executive, member] = seed.users;
  it("gives administrators system control and every department", () => {
    expect(canAdmin(admin)).toBe(true);
    for (const d of seed.departments) {
      expect(canView(admin, d.id, seed)).toBe(true);
      expect(canManage(admin, d.id, seed)).toBe(true);
    }
  });
  it("gives executives global read access without mutation rights", () => {
    expect(canViewLogs(executive)).toBe(true);
    expect(canAdmin(executive)).toBe(false);
    for (const d of seed.departments) {
      expect(canView(executive, d.id, seed)).toBe(true);
      expect(canManage(executive, d.id, seed)).toBe(false);
    }
  });
  it("scopes members to their own and explicitly shared departments", () => {
    expect(canManage(member, "design", seed)).toBe(true);
    expect(canView(member, "marketing", seed)).toBe(true);
    expect(canManage(member, "marketing", seed)).toBe(false);
    expect(canView(member, "finance", seed)).toBe(false);
    expect(canViewLogs(member)).toBe(false);
    expect(canAdmin(member)).toBe(false);
  });
  it("honors manage grants and their removal", () => {
    const member = seed.users[3];
    expect(canManage(member, "operations", seed)).toBe(true);
    expect(canView(member, "operations", { ...seed, permissions: [] })).toBe(
      false,
    );
    expect(canManage(member, "operations", { ...seed, permissions: [] })).toBe(
      false,
    );
  });
});
