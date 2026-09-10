import { isDemoMode } from "../lib/supabase";
import { createSupabaseRepository } from "./supabase-repository";
import type { Repository } from "./repository-contract";
export type { Command, Repository } from "./repository-contract";
const live = createSupabaseRepository();
async function adapter(): Promise<Repository> {
  return isDemoMode ? (await import("./mock-repository")).repository : live;
}
export const repository: Repository = {
  getDatabase: async () => (await adapter()).getDatabase(),
  getFile: async (userId, fileId) => (await adapter()).getFile(userId, fileId),
  execute: async (userId, command) => (await adapter()).execute(userId, command),
};
