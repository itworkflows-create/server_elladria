import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApp } from "../../context";
import { getDescendantIds, validateFolderName } from "../../lib/folders";
import type { DocumentFile, Folder } from "../../types";
import { Modal } from "../ui/dialog";
import { Button } from "../ui/button";
import { FolderPicker } from "./folder-picker";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a folder name.")
    .max(80, "Use 80 characters or fewer."),
});
export function FolderNameDialog({
  departmentId,
  parentFolderId,
  folder,
  close,
}: {
  departmentId: string;
  parentFolderId: string | null;
  folder?: Folder;
  close: () => void;
}) {
  const { db, run, pending } = useApp();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: folder?.name ?? "" },
  });
  const name = watch("name");
  const error = validateFolderName(
    db,
    departmentId,
    parentFolderId,
    name,
    folder?.id,
  );
  return (
    <Modal
      open
      onOpenChange={close}
      title={folder ? "Rename folder" : "New Folder"}
      description="Choose a unique name within this folder location."
    >
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (values) => {
          if (error) return;
          if (
            await run(
              folder
                ? { kind: "renameFolder", id: folder.id, name: values.name }
                : {
                    kind: "createFolder",
                    departmentId,
                    parentFolderId,
                    name: values.name,
                  },
            )
          )
            close();
        })}
      >
        <label>
          Folder name
          <input
            autoFocus
            maxLength={80}
            {...register("name")}
            aria-invalid={!!error}
          />
        </label>
        {(errors.name?.message || (name && error)) && (
          <p role="alert" className="error">
            {errors.name?.message ?? error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={pending || !!error}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
export function MoveDialog({
  item,
  kind,
  close,
}: {
  item: Folder | DocumentFile;
  kind: "folder" | "file";
  close: () => void;
}) {
  const { run, pending } = useApp();
  const original =
    "parentFolderId" in item ? item.parentFolderId : item.folderId;
  const [destination, setDestination] = useState<string | null>(original);
  return (
    <Modal
      open
      onOpenChange={close}
      title={`Move ${kind}`}
      description={`Choose a destination for “${item.name}” within this department.`}
    >
      <FolderPicker
        departmentId={item.departmentId}
        value={destination}
        onChange={setDestination}
        excludeFolderId={kind === "folder" ? item.id : undefined}
        disabled={pending}
      />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button
          disabled={pending || destination === original}
          onClick={async () => {
            if (
              await run(
                kind === "folder"
                  ? {
                      kind: "moveFolder",
                      id: item.id,
                      parentFolderId: destination,
                    }
                  : { kind: "moveFile", id: item.id, folderId: destination },
              )
            )
              close();
          }}
        >
          Move here
        </Button>
      </div>
    </Modal>
  );
}
export function DeleteFolderDialog({
  folder,
  close,
}: {
  folder: Folder;
  close: () => void;
}) {
  const { db, run, pending } = useApp();
  const [confirmed, setConfirmed] = useState(false);
  const ids = getDescendantIds(db, folder.id);
  const fileCount = db.files.filter(
    (file) => file.folderId !== null && ids.has(file.folderId),
  ).length;
  const nonempty = ids.size > 1 || fileCount > 0;
  return (
    <Modal
      open
      onOpenChange={close}
      title="Delete folder?"
      description={`“${folder.name}” contains ${ids.size - 1} subfolders and ${fileCount} files across all nested levels. Deletion cannot be undone.`}
    >
      {nonempty && (
        <label className="flex items-start gap-3">
          <input
            className="!w-auto mt-1"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm deletion of this folder and all files and subfolders inside
          it.
        </label>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={pending || (nonempty && !confirmed)}
          onClick={async () => {
            if (
              await run({
                kind: "deleteFolder",
                id: folder.id,
                confirmRecursive: confirmed,
              })
            )
              close();
          }}
        >
          Delete folder{nonempty ? " and contents" : ""}
        </Button>
      </div>
    </Modal>
  );
}
