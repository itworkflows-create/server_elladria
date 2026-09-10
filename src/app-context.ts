import { createContext } from "react";
import type { Command } from "./data/repository-contract";
import type { Database, User } from "./types";
export interface AppContext {
  db: Database; user?: User;
  signIn: (emailOrId: string, password?: string) => Promise<void>;
  signOut: () => void;
  run: (command: Command) => Promise<boolean>;
  pending: boolean; notice: string; dismiss: () => void;
}
export const Context = createContext<AppContext | null>(null);
