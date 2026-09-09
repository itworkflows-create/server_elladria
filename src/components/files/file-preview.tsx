import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useApp, useUser } from "../../context";
import { canView, fileDepartment } from "../../lib/access";
import {
  isAudioFile,
  isImageFile,
  isPdfFile,
  isVideoFile,
  isWordFile,
} from "../../lib/file-types";
import { fileService, type PreviewSource } from "../../lib/file-service";
import { formatFileSize } from "../../lib/storage";
import type { DocumentFile } from "../../types";
import { Modal } from "../ui/dialog";
import { Button } from "../ui/button";
import { FileIcon } from "./file-icon";
import { DownloadButton } from "./file-actions";
export function FilePreview({
  file,
  close,
}: {
  file: DocumentFile;
  close: () => void;
}) {
  const { db } = useApp();
  const user = useUser();
  const [source, setSource] = useState<PreviewSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const allowed =
    canView(user, fileDepartment(db, file.spaceId), db) &&
    db.files.some((f) => f.id === file.id);
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    setLoading(true);
    setError("");
    setSource(null);
    if (!allowed) {
      setLoading(false);
      return;
    }
    void fileService
      .getPreview(file.id, user.id)
      .then((result) => {
        release = result.source?.release;
        if (disposed) release?.();
        else {
          setSource(result.source);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!disposed) {
          setError(
            e instanceof Error ? e.message : "Preview could not be loaded.",
          );
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [file.id, file.updatedAt, user.id, allowed]);
  const playbackError = () =>
    setError(
      "This browser could not open this media format or codec. Download the original file to play it in a compatible application.",
    );
  return (
    <Modal
      open
      onOpenChange={close}
      title={allowed ? file.name : "File unavailable"}
      description={
        allowed
          ? `${file.extension.toUpperCase() || "FILE"} · ${formatFileSize(file.fileSizeBytes)} · ${file.fileCategory}`
          : "This file was removed or your access changed."
      }
      className="max-w-3xl"
    >
      {allowed && (
        <>
          <div className="min-w-0 rounded-xl border bg-slate-50 p-3 sm:p-5">
            {loading ? (
              <div
                role="status"
                aria-label="Loading file preview"
                className="skeleton h-60"
              />
            ) : error ? (
              <div
                role="alert"
                className="p-6 text-center text-sm text-slate-600"
              >
                <FileIcon file={file} large />
                <p className="mt-4">{error}</p>
              </div>
            ) : isWordFile(file) ? (
              <div className="p-6 text-center">
                <FileIcon file={file} large />
                <p className="mt-5 text-sm">
                  Browser preview is not available for this Word document.
                </p>
              </div>
            ) : !source ? (
              <div className="p-6 text-center">
                <FileIcon file={file} large />
                <p className="mt-5 text-sm">
                  Browser preview is not available for this file. Download it to
                  open in a compatible application.
                </p>
              </div>
            ) : isImageFile(file) ? (
              <>
                <div className="mb-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(!zoom)}
                  >
                    {zoom ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
                    {zoom ? "Fit image" : "Zoom image"}
                  </Button>
                </div>
                <div className="max-h-[55vh] overflow-auto">
                  <img
                    src={source.url}
                    alt={file.name}
                    onError={() =>
                      setError(
                        "The image could not be loaded. Download the original file to view it.",
                      )
                    }
                    className={
                      zoom
                        ? "mx-auto max-w-none"
                        : "mx-auto max-h-[55vh] max-w-full object-contain"
                    }
                    style={zoom ? { width: "150%" } : undefined}
                  />
                </div>
              </>
            ) : isPdfFile(file) ? (
              <iframe
                title={`PDF preview: ${file.name}`}
                src={source.url}
                className="h-[55vh] min-h-64 w-full rounded-md bg-white"
                onError={() =>
                  setError(
                    "The PDF could not be embedded. Download it to open in your PDF viewer.",
                  )
                }
              />
            ) : isAudioFile(file) ? (
              <div className="py-8 text-center">
                <FileIcon file={file} large />
                <h3 className="my-5 break-words">{file.name}</h3>
                <audio
                  aria-label={`Audio player for ${file.name}`}
                  controls
                  preload="metadata"
                  src={source.url}
                  onError={playbackError}
                  className="w-full"
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            ) : isVideoFile(file) ? (
              <video
                aria-label={`Video player for ${file.name}`}
                controls
                playsInline
                preload="metadata"
                src={source.url}
                onError={playbackError}
                className="max-h-[55vh] w-full rounded-lg bg-black"
              >
                Your browser does not support video playback.
              </video>
            ) : null}
          </div>
          <dl className="my-5 grid grid-cols-1 gap-3 text-xs text-slate-500 sm:grid-cols-2">
            <div>
              <dt>Original file name</dt>
              <dd className="mt-1 break-words text-slate-700">
                {file.originalFileName}
              </dd>
            </div>
            <div>
              <dt>Storage space</dt>
              <dd className="mt-1 text-slate-700">
                {db.spaces.find((s) => s.id === file.spaceId)?.name}
              </dd>
            </div>
            <div>
              <dt>Uploaded</dt>
              <dd className="mt-1">{new Date(file.date).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd className="mt-1">
                {new Date(file.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
          {file.content && (
            <p className="mb-4 text-xs leading-6 text-slate-500">
              {file.content.slice(0, 400)}
            </p>
          )}
          <p className="mb-4 text-xs text-slate-500">
            {file.dataUrl
              ? "Download preserves the original uploaded bytes."
              : file.previewUrl || isPdfFile(file)
                ? "Demo asset: a small illustrative sample, not a real company file."
                : "No binary is stored for this seed file. Download provides a labeled .mock.txt sample."}
          </p>
          <DownloadButton file={file} />
        </>
      )}
    </Modal>
  );
}
