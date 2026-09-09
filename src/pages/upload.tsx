import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CloudUpload, FileCheck2, ShieldCheck } from "lucide-react";
import { useApp, useUser } from "../context";
import { canManage } from "../lib/access";
import { Empty, PageHeading, sizeLabel } from "../components/common";
import { Button } from "../components/ui/button";
import type { DocumentFile } from "../types";
import {
  formatFileSize,
  getDepartmentStorage,
  getUploadStorageError,
} from "../lib/storage";
const schema = z.object({
  spaceId: z.string().min(1, "Choose a storage space."),
  description: z.string().max(500, "Use 500 characters or fewer."),
});
export function UploadFile() {
  const { db, run, pending } = useApp();
  const user = useUser();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const spaces = db.spaces.filter((s) => canManage(user, s.departmentId, db));
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      spaceId: spaces.some((s) => s.id === params.get("space"))
        ? params.get("space")!
        : "",
      description: "",
    },
  });
  const selectedSpace = spaces.find((s) => s.id === watch("spaceId"));
  const storage = selectedSpace
    ? getDepartmentStorage(db, selectedSpace.departmentId)
    : null;
  const quotaError =
    file && selectedSpace
      ? getUploadStorageError(db, selectedSpace.departmentId, file.size)
      : null;
  function choose(next?: File) {
    setError("");
    setFile(null);
    if (!next) return;
    if (!/\.(pdf|docx|xlsx|png)$/i.test(next.name)) {
      setError("Choose a PDF, DOCX, XLSX, or PNG file.");
      return;
    }
    if (next.size > 2000000) {
      setError("Choose a file smaller than 2 MB for this local demo.");
      return;
    }
    if (next.size === 0) {
      setError("This file is empty. Choose another file.");
      return;
    }
    if (selectedSpace) {
      const message = getUploadStorageError(
        db,
        selectedSpace.departmentId,
        next.size,
      );
      if (message) {
        setError(message);
        return;
      }
    }
    setFile(next);
  }
  if (!spaces.length)
    return (
      <>
        <PageHeading
          title="Upload file"
          description="Add knowledge to your team's workspace."
        />
        <div className="panel">
          <Empty
            title="Create a storage space first"
            description="You need a storage space with manage access to upload files."
          >
            <Button asChild>
              <Link to="/my-department">Go to my department</Link>
            </Button>
          </Empty>
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="MAKE SOMETHING ACCESSIBLE"
        title="Upload a file"
        description="The right file, in the right place. Ready for your team."
      />
      <div className="upload-layout">
        <form
          className="panel p-7 form-stack"
          onSubmit={handleSubmit(async (values) => {
            if (!file) {
              setError("Choose a file to upload.");
              return;
            }
            const targetSpace = spaces.find((s) => s.id === values.spaceId);
            if (!targetSpace) {
              setError("Choose a storage space.");
              return;
            }
            const message = getUploadStorageError(
              db,
              targetSpace.departmentId,
              file.size,
            );
            if (message) {
              setError(message);
              return;
            }
            setReading(true);
            try {
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () =>
                  reject(new Error("Unable to read this file."));
                reader.readAsDataURL(file);
              });
              const type = file.name
                .split(".")
                .pop()!
                .toUpperCase() as DocumentFile["type"];
              if (
                await run({
                  kind: "upload",
                  file: {
                    spaceId: values.spaceId,
                    name: file.name,
                    type,
                    fileSizeBytes: file.size,
                    dataUrl,
                    content: values.description,
                  },
                })
              )
                navigate(`/storage/${values.spaceId}`);
            } catch {
              setError("Unable to read this file. Please try again.");
            } finally {
              setReading(false);
            }
          })}
        >
          <div>
            <h2>File details</h2>
            <p className="muted text-sm mt-1">
              Select a destination and add your document.
            </p>
          </div>
          <label>
            Storage space
            <select {...register("spaceId")}>
              <option value="">Choose a storage space</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {db.departments.find((d) => d.id === s.departmentId)?.name} /{" "}
                  {s.name}
                </option>
              ))}
            </select>
            {errors.spaceId && (
              <span className="error">{errors.spaceId.message}</span>
            )}
          </label>
          {storage && (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {storage.department.name}:{" "}
              <strong>
                {formatFileSize(storage.remainingBytes)} available
              </strong>{" "}
              of {formatFileSize(storage.capacityBytes)} quota.
            </p>
          )}
          <label
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0]);
            }}
          >
            {file ? <FileCheck2 size={34} /> : <CloudUpload size={36} />}
            <strong>
              {file ? file.name : "Drop your file here, or browse"}
            </strong>
            <span>
              {file
                ? sizeLabel(file.size)
                : "PDF, DOCX, XLSX, or PNG · Up to 2 MB per file"}
            </span>
            <input
              className="sr-only"
              aria-label="Choose file"
              type="file"
              accept=".pdf,.docx,.xlsx,.png"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <span className="browse-label">
              {file ? "Choose a different file" : "Browse files"}
            </span>
          </label>
          {(quotaError || error) && (
            <p role="alert" className="error">
              {quotaError || error}
            </p>
          )}
          <label>
            Description{" "}
            <span className="font-normal text-slate-400">(optional)</span>
            <textarea
              rows={3}
              placeholder="Add some context for your team…"
              {...register("description")}
            />
            {errors.description && (
              <span className="error">{errors.description.message}</span>
            )}
          </label>
          <div className="flex justify-end gap-3 border-t pt-5">
            <Button
              variant="outline"
              type="button"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button disabled={pending || reading || !!quotaError} type="submit">
              <CloudUpload size={17} />
              {pending || reading ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        </form>
        <aside className="upload-note">
          <ShieldCheck size={27} />
          <h3>Shared with the right people.</h3>
          <p>
            Files inherit their department's permissions. Your team and people
            with granted access can find them here.
          </p>
          <hr />
          <h3>A local demo workspace</h3>
          <p>
            Files stay in this browser. Small uploads can be previewed and
            downloaded; no external storage is connected.
          </p>
        </aside>
      </div>
    </>
  );
}
