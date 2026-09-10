import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repository, type Command } from "./data/repository";
import { Context } from "./app-context";
export function DemoAppProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(
    () => sessionStorage.getItem("elladria-user") ?? "",
  );
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: () => repository.getDatabase(),
  });
  const mutation = useMutation({
    mutationFn: (command: Command) => repository.execute(userId, command),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
  if (query.isPending)
    return (
      <div className="p-10" aria-label="Loading workspace" role="status">
        <div className="skeleton h-12 w-56" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="skeleton h-48" />
          ))}
        </div>
        <p className="mt-6 text-slate-500">Preparing your workspace…</p>
      </div>
    );
  if (query.isError)
    return (
      <div className="p-12">
        Unable to load the workspace.{" "}
        <button onClick={() => void query.refetch()}>Try again</button>
      </div>
    );
  return (
    <Context.Provider
      value={{
        db: query.data,
        user: query.data.users.find((u) => u.id === userId),
        signIn: async (id) => {
          sessionStorage.setItem("elladria-user", id);
          setUserId(id);
        },
        signOut: () => {
          sessionStorage.removeItem("elladria-user");
          setUserId("");
          client.removeQueries({ queryKey: ["private"] });
        },
        run: async (command) => {
          try {
            await mutation.mutateAsync(command);
            setNotice("Changes saved successfully.");
            return true;
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : "Something went wrong.",
            );
            return false;
          }
        },
        pending: mutation.isPending,
        notice,
        dismiss: () => setNotice(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
