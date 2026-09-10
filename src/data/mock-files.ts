import { enrichFile } from "./file-metadata";

// Bundled, synthetic examples. No third-party media requests or private content.
export const mockMediaFiles = [
  enrichFile(
    {
      id: "media-photo",
      folderId: "s5",
      name: "Team onboarding.jpg",
      fileSizeBytes: 32966,
      uploadedBy: "u6",
      date: "2026-09-09T08:29:00Z",
      content: "Synthetic onboarding artwork for the demo workspace.",
      previewUrl: "/demo/team-onboarding.jpg",
    },
    "people",
  ),
  enrichFile(
    {
      id: "media-mp3",
      folderId: "s5",
      name: "Interview sound check.mp3",
      fileSizeBytes: 145197,
      uploadedBy: "u6",
      date: "2026-09-09T08:28:00Z",
      content:
        "Synthetic sound-check tones. No interview or personal recording.",
      previewUrl: "/demo/interview-sound-check.mp3",
    },
    "people",
  ),
  enrichFile(
    {
      id: "media-wav",
      folderId: "s5",
      name: "Welcome audio cue.wav",
      fileSizeBytes: 576078,
      uploadedBy: "u6",
      date: "2026-09-08T14:00:00Z",
      content: "Synthetic welcome audio cue.",
      previewUrl: "/demo/welcome-audio-cue.wav",
    },
    "people",
  ),
  enrichFile(
    {
      id: "media-video",
      folderId: "s7",
      name: "Workspace training.mp4",
      fileSizeBytes: 59762,
      uploadedBy: "u1",
      date: "2026-09-09T08:27:00Z",
      content: "A short synthetic training title card with a sound-check tone.",
      previewUrl: "/demo/workspace-training.mp4",
    },
    "operations",
  ),
];
export function addMockFileExamples(
  db: import("../types").Database,
): import("../types").Database {
  if ((db.fileExamplesVersion ?? 0) >= 1) return db;
  return {
    ...db,
    fileExamplesVersion: 1,
    files: [
      ...db.files.map((file) => {
        if (file.dataUrl || file.previewUrl) return file;
        if (file.id === "f1")
          return { ...file, previewUrl: "/demo/brand-guidelines.pdf" };
        if (file.id === "f3")
          return { ...file, previewUrl: "/demo/employee-handbook.docx" };
        return file;
      }),
      ...mockMediaFiles.filter(
        (file) =>
          db.folders.some((s) => s.id === file.folderId) &&
          !db.files.some((f) => f.id === file.id),
      ),
    ],
  };
}
