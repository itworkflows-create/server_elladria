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
import { isDemoMode } from "../lib/supabase";
import { FolderPicker } from "../components/folders/folder-picker";
import { FILE_ACCEPT, validateUploadFile } from "../lib/file-types";
import { fileService } from "../lib/file-service";
import {
  formatFileSize,
  getDepartmentStorage,
  getUploadStorageError,
} from "../lib/storage";
const schema = z.object({
  departmentId: z.string().min(1, "Choose a department."),
  folderId: z.string().nullable(),
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
  const departments = db.departments.filter((d) => canManage(user, d.id, db));
  const initialFolder = db.folders.find(
    (f) => f.id === (params.get("folder") ?? params.get("space")),
  );
  const initialDepartment =
    initialFolder?.departmentId ?? params.get("department") ?? "";
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      departmentId: departments.some((d) => d.id === initialDepartment)
        ? initialDepartment
        : "",
      folderId: initialFolder?.id ?? null,
      description: "",
    },
  });
  const selectedDepartment = departments.find(
    (d) => d.id === watch("departmentId"),
  );
  const storage = selectedDepartment
    ? getDepartmentStorage(db, selectedDepartment.id)
    : null;
  const quotaError =
    file && selectedDepartment
      ? getUploadStorageError(db, selectedDepartment.id, file.size)
      : null;
  function choose(next?: File) {
    setError("");
    setFile(null);
    if (!next) return;
    const validationError = validateUploadFile(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (selectedDepartment) {
      const message = getUploadStorageError(
        db,
        selectedDepartment.id,
        next.size,
      );
      if (message) {
        setError(message);
        return;
      }
    }
    setFile(next);
  }
  if (!departments.length)
    return (
      <>
        <PageHeading
          title="Upload file"
          description="Add knowledge to your team's workspace."
        />
        <div className="panel">
          <Empty
            title="Choose or create a department first"
            description="You need a department with manage access to upload files."
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
            const targetDepartment = departments.find(
              (d) => d.id === values.departmentId,
            );
            if (!targetDepartment) {
              setError("Choose a department.");
              return;
            }
            const message = getUploadStorageError(
              db,
              targetDepartment.id,
              file.size,
            );
            if (message) {
              setError(message);
              return;
            }
            setReading(true);
            try {
              const uploaded = await fileService.upload(file);
              if (
                await run({
                  kind: "upload",
                  file: {
                    folderId: values.folderId,
                    departmentId: values.departmentId,
                    ...uploaded,
                    content: values.description,
                  },
                })
              )
                navigate(
                  values.folderId
                    ? `/folders/${values.folderId}`
                    : `/departments/${values.departmentId}`,
                );
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Unable to read this file. Please try again.",
              );
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
            Department
            <select
              {...register("departmentId", {
                onChange: () => {
                  setValue("folderId", null);
                  setError("");
                },
              })}
              disabled={reading || pending}
            >
              <option value="">Choose a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.departmentId && (
              <span className="error">{errors.departmentId.message}</span>
            )}
          </label>
          {selectedDepartment && (
            <FolderPicker
              departmentId={selectedDepartment.id}
              value={watch("folderId")}
              onChange={(id) => setValue("folderId", id)}
              disabled={reading || pending}
            />
          )}
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
                : "Documents, images, audio, or video · Up to 2 MB per file"}
            </span>
            <input
              className="sr-only"
              aria-label="Choose file"
              type="file"
              accept={FILE_ACCEPT}
              disabled={reading || pending}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <span className="browse-label">
              {file ? "Choose a different file" : "Browse files"}
            </span>
          </label>
          {(pending || reading) && <p role="status" aria-live="polite">{reading && !pending ? "Preparing your file…" : "Uploading and saving your file…"}</p>}
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
          <h3>Supported file types</h3>
          <p>
            Documents: PDF, DOC, DOCX.
            <br />
            Images: JPG, JPEG, PNG.
            <br />
            Audio: MP3, WAV, M4A, AAC.
            <br />
            Video: MP4, MOV, WEBM.
            <br />
            Existing XLSX support is also available.
          </p>
          <p>
            Up to 2 MB per upload. Media playback depends
            on the browser's supported codecs.
          </p>
          <hr />
          <h3>{isDemoMode ? "A local demo workspace" : "Private company storage"}</h3>
          <p>
            {isDemoMode ? "Files stay in this browser. No external storage is connected." : "Files are stored privately. Preview and download links expire; reopen the file to request a fresh link."}
          </p>
        </aside>
      </div>
    </>
  );
}
