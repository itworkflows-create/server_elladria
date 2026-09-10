# Elladria workspace

A responsive internal document management frontend built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui-style Radix primitives, React Router, TanStack Query, React Hook Form, and Zod. No Supabase connection or credentials are included.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Architecture

- `src/types.ts`: typed domain entities.
- `src/data/seed.ts` and `src/data/mock-files.ts`: seven mock users, six departments, eight root folders, twelve mixed files, three grants, and activity history.
- `src/data/repository.ts`: asynchronous `Repository` contract and authorized mock commands. Replace this adapter with Supabase queries, storage, and mutations in the next phase.
- `src/lib/access.ts`: shared department access policy used by views and mutation services.
- `src/context.tsx`: demo session, TanStack Query cache, mutations, notifications, loading and failure handling.
- `src/components/ui`: owned shadcn/ui component source using Radix Dialog and Slot, CVA, and Tailwind.
- `src/components`: reusable application shell, cards, file table, dialogs, and resource forms.
- `src/pages`: feature pages. `src/main.tsx` composes routes and guards.
- `src/index.css`: responsive layout and enterprise visual design with reduced-motion support.

## Routes

| Route              | Purpose                                 | Access                       |
| ------------------ | --------------------------------------- | ---------------------------- |
| `/login`           | Choose demo account                     | Public                       |
| `/`, `/dashboard`  | Dashboard (alias redirects)             | Signed in                    |
| `/my-department`   | Own department or creation              | Signed in                    |
| `/shared`          | Explicit cross-department grants        | Signed in                    |
| `/departments`     | All departments                         | Admin, Executive             |
| `/departments/:id` | Department folders                      | Department access required   |
| `/folders/:id`     | Files, preview, download, management    | Department access required   |
| `/storage`         | System and department storage analytics | Admin, Executive (read-only) |
| `/upload`          | Upload to manageable spaces             | Admin, Department Member     |
| `/search`          | Search all accessible files             | Signed in                    |
| `/users`           | Add/remove users and assign roles       | Admin                        |
| `/permissions`     | Grant, update, revoke access            | Admin                        |
| `/activity`        | Searchable activity logs                | Admin, Executive             |
| `/settings`        | Profile settings                        | Signed in                    |

Unknown routes and inaccessible resources show empty states. Disallowed role routes redirect to the dashboard. Logout removes the demo session.

## Demo roles

- **Alex Morgan — Admin**: all files, department creation/renaming/deletion, user creation/removal, role assignment, access grants, and logs. Department deletion requires a confirmation and removes its folders, files, and grants while unassigning members. The current administrator cannot remove or demote themselves.
- **Olivia Chen — Executive**: all departments, spaces, search, previews, downloads, recent uploads, and logs. No department or file writes, user management, roles, or permissions.
- **James Wilson — Department Member**: owns Design & Creative and has view-only Marketing access. Sarah has manage access to Operations; Daniel has view access to Design.
- **Noah Patel — unassigned member**: can create their own department once, then create folders and manage its files.
- A View grant allows preview/download. Manage additionally allows creation of spaces and upload/rename/delete of files in that department. Members never manage users, permissions, or department deletion.

## Mock behavior and integration boundary

Workspace changes persist in localStorage (`elladria-demo-v1`); the selected account is in sessionStorage (`elladria-user`). Sign out to test another account. Clearing those keys restores the seed on reload. Account selection is explicitly demo authentication; browser role checks are not production security.

Uploads preserve actual file bytes as data URLs, capped at 2 MB each for browser storage. Storage quota errors are handled without committing partial changes. PDFs and supported images have browser previews, and audio/video use native media players. Word and unsupported formats offer file information and downloads. Bundled samples include real PDF/DOCX and media binaries; text-only legacy PDF samples generate a valid illustrative PDF. Other seed files without binary content download as clearly labeled `.mock.txt` samples. Storage usage comes from file metadata and configured quotas; department member counts are illustrative seed metadata.

For Supabase, replace the repository, introduce real auth sessions and object-storage URLs, and enforce these same policies with server-side row-level security and storage rules. Do not treat this local demo's client authorization as a security boundary. No backend integration is active.

Tests cover role access, cross-department grants/revocation, executive write denial, one-department ownership, and administrator safeguards.

## Storage monitoring and quotas

- `src/types.ts` now uses `DocumentFile.fileSizeBytes` as the single file-size field and `Department.storageQuotaBytes` for quotas. `Database.storage.totalCapacityBytes` supplies the configured system capacity.
- `src/types/storage.ts` defines analytics output types without duplicating domain models.
- `src/lib/storage.ts` owns byte conversions, formatting, summation, percentages, remaining capacity, status thresholds, department/system aggregation, and upload eligibility. These functions have no React or persistence dependencies.
- `src/data/mock-storage.ts` provides 50 GB of system capacity, department defaults, and migration from the prior `size` model. Existing accounts, uploads, access grants, names, and saved quotas are preserved. New departments receive a 5 GB quota.
- `src/components/storage/` contains shared meters, department summaries, and the validated quota dialog. `src/pages/storage.tsx` provides searchable/filterable analytics. Owned shadcn/ui components supply cards, badges, Radix progress and select, tables, and dialogs.

Default quotas preserve the existing department roster: Design & Creative 10 GB, Finance 5 GB, Engineering 8 GB, People & Culture 8 GB, Marketing 4 GB, Operations 15 GB. Existing realistic seed file sizes are retained; all initial departments are under their limits. To explore warning states, set Design's quota to 8 MB (81.25%, Warning), 6.8 MB (95.58%, Critical), or 6.5 MB (100%, Full).

**Access:** The Storage sidebar item is Admin-only. Admin can edit quotas both on `/storage` and department pages. Executive can reach `/storage` through the dashboard's **View storage usage** link and view every department, with no quota controls. Members see their own usage/quota/remaining capacity on the dashboard and department page; accessible shared department pages also show their storage summary. Members cannot open the system overview or modify quotas. The mock repository independently rejects non-Admin quota commands, even with a cross-department Manage grant.

**Calculations:** A department's usage sums `fileSizeBytes` for files in all its folders. System usage sums all files. Remaining bytes are `max(0, capacity - used)`. Percentage is `used / capacity × 100`, without capping the result; progress visuals cap at 100%. Normal is below 80%, Warning begins at 80%, Critical at 95%, and Full at 100%. Status uses the unrounded percentage. Display percentages truncate to two decimal places so rounding never crosses a status threshold. Zero capacity cannot accept uploads and displays Full without division-by-zero errors. Decimal units are used: 1 MB = 1,000,000 bytes; 1 GB = 1,000 MB.

**Quota changes:** Positive byte-accurate quotas can be entered in MB or GB and persist through the existing repository and query invalidation flow. Lowering a quota below usage retains existing files and shows an explicit warning before saving. Department limits do not reserve system space; if their sum exceeds system capacity, the overview explains the allocation. Total system capacity is mock configuration, not an editable quota control.

**Upload protection:** The form checks the selected department before reading a file and again on submission. The repository rechecks current department and system capacity before committing any file or activity log. Exact-fit uploads are allowed; a file one byte over the remaining department quota is rejected with `This upload would exceed the department storage quota.` Admin uploads obey the same limits. Deleting files releases quota immediately. Browser localStorage limits remain separate from the simulated 50 GB capacity.

Storage tests cover threshold boundaries, exact-fit/over-quota uploads, atomic rejection, file deletion, aggregate calculations, data migration, persistence, invalid quotas, and role enforcement. For Supabase, replace mock configuration and metadata reads with server data, retain the analytics contracts/UI, and enforce quotas transactionally on the server before storage uploads.

## Multiple file types, preview, and download

### Model and service boundaries

`DocumentFile` remains the single file model in `src/types.ts`, extended with `FileMetadata` from `src/types/files.ts`. Existing `name`, `folderId`, and `date` fields remain the canonical file name, folder ID, and creation/upload timestamp. Added metadata: `originalFileName`, `mimeType`, `extension`, `fileCategory`, `departmentId`, `updatedAt`, optional `previewUrl`, and optional future `storageBucket`/`storagePath`. `fileSizeBytes` remains the single size field. The former uppercase `type` field is removed during migration.

- `src/lib/file-types.ts`: extension, canonical MIME and category detection, preview/playback eligibility, icon keys, upload validation, and extension-preserving rename validation.
- `src/data/file-metadata.ts`: metadata enrichment and migration of saved files without losing uploaded bytes or user edits.
- `src/lib/file-service.ts`: `FileService` adapter with local upload preparation, authorized preview resolution, and download-byte retrieval. Components never embed sample URLs. Replace this adapter with private Supabase bucket uploads, signed URLs, MIME metadata, and server authorization in the next phase.
- `src/lib/file-download.ts`: shared `downloadFile()` function; uses the service's name and bytes, attaches a temporary download link, and releases its Blob URL after the browser has started the download.
- `src/components/files/`: reusable preview dialog, file actions, file icons, and category-filterable file table, also used by Recent Uploads.

### Supported formats and previews

| Category | Extensions                     | Preview                                                                                       |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| Document | PDF                            | Embedded PDF viewer; Download remains available if embedding is unsupported                   |
| Document | DOC, DOCX                      | File information and `Browser preview is not available for this Word document.` plus Download |
| Image    | JPG, JPEG, PNG                 | Responsive image with fit/zoom toggle                                                         |
| Audio    | MP3, WAV, M4A, AAC             | Native audio controls for playback, timeline, and volume                                      |
| Video    | MP4, MOV, WEBM                 | Native video controls, timeline, volume, and fullscreen where supported                       |
| Other    | Existing XLSX support retained | File information and Download                                                                 |

Media are not autoplayed. Playback support depends on browser/OS codecs, especially MOV, M4A, and AAC; errors show a download fallback. Native mobile controls may delegate volume to the operating system. Closing the preview unmounts players and releases Blob URLs. Images and video are constrained to the dialog/viewport, and images can be zoomed inside a scrollable container.

### Validation, access, and storage

The upload form and mock repository validate supported extensions, positive integer byte sizes, the 2 MB local-demo limit, file-name validity, and MIME/extension consistency. Missing or generic browser MIME types are inferred from the extension; common MIME aliases are accepted. This is metadata validation, not malware scanning or full binary format inspection. Department and total-system quotas are rechecked before the file and activity record are committed. Audio and video count toward quotas exactly like documents, through `fileSizeBytes`.

Admins and Executives can preview/download every file. Members can access their own department and granted shares. A View share cannot rename, delete, or upload; Manage shares retain existing mutation rights. The table filters unauthorized files, actions honor the shared policy, and `repository.getFile()` rechecks access for preview/download operations. Renaming cannot change the extension and retains the original upload name and bytes while updating `updatedAt`.

### Mock assets and existing browser data

`public/demo/` bundles synthetic JPG, MP3, WAV, MP4, PDF, and DOCX examples; no external URLs, company information, or real employee recordings are used. Four new media entries are added once to existing demo databases if their folders still exist. `fileExamplesVersion` prevents deleted samples being recreated on future loads. Seed PDF/DOCX examples acquire local binary sources; existing uploaded sources take priority. The new media entries use their actual fixture sizes. Older document sizes remain illustrative mock metadata.

Fixture regeneration instructions live in `public/demo/README.md`; FFmpeg is only used to generate fixtures and is not an application dependency. Tests cover every supported extension, MIME mismatches, metadata migration, role-scoped reads/writes, quota accounting for media, rename behavior, preview URL cleanup, download fallback, and fixture signatures/sizes. The bundled MP3, WAV, and MP4 were also decoded successfully with FFmpeg.

## Hierarchical folders

Departments now contain root-level files and folders, and folders can contain files and further subfolders without a fixed depth limit. The former storage-space model has been replaced by one `Folder` model in `src/types.ts`:

| Field                 | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| id                    | Stable folder identifier; new folders use UUIDs            |
| departmentId          | Owning department                                          |
| parentFolderId        | Parent folder ID, or null for department root              |
| name                  | Folder name, trimmed and limited to 80 characters          |
| createdBy             | Creator's user ID                                          |
| createdAt / updatedAt | ISO timestamps                                             |
| description           | Optional preserved description from a legacy storage space |

Files retain the existing canonical `name`, `originalFileName`, `fileCategory`, MIME, extension, byte size, uploader, timestamps and preview/download metadata. `folderId` replaces `spaceId`; null means the file is directly in its department root. `departmentId` determines authorization and quota accounting at every depth.

### Migration and navigation

`src/data/folder-migration.ts` converts saved `spaces` to root folders, preserves IDs, descriptions, file bytes and metadata, and removes the legacy keys. Missing historical creator/timestamp values receive deterministic demo defaults. Migration runs before existing storage/file migrations and is idempotent; saved nesting and root files survive reloads. The existing localStorage key is unchanged. Seed folders retain their original IDs. Existing `/storage/:id` links redirect to `/folders/:id`, and old upload links with a `space` query parameter remain compatible.

Department pages display root folders and root files. Folder pages show immediate children, a current-folder title, clickable department/ancestor breadcrumbs, a back-to-parent link, and an empty state. A New Folder dialog uses React Hook Form and Zod. Folder action menus use owned shadcn-style Radix dropdown components. All paths in the file table include the department, ancestor folders, and filename; search matches those paths as well as names.

### CRUD and safety

`src/lib/folders.ts` owns authorized reusable createFolder, getFolder, getChildFolders, getFolderBreadcrumbs, getFilesByFolder, renameFolder, moveFolder, deleteFolder and moveFile operations. Repository commands execute mutations on a clone, append activity, and persist before committing the new state. Failed validation or persistence leaves files, folders and activity unchanged.

- Root folders and subfolders use the same model and commands.
- Duplicate sibling names are rejected after trimming and case folding; the same name is allowed under different parents. Renames and moves apply the same checks.
- Folder names cannot be empty, exceed 80 characters, contain slashes/control characters, or equal `.` or `..`.
- Moves remain within the same department. Missing destinations, self moves, descendant moves and circular ancestor paths are rejected.
- Moving a folder retains its subtree; moving a file changes only its folder reference and update timestamp. Root is an explicit destination in the shared folder picker.
- Every folder deletion opens a confirmation dialog. Nonempty folders show recursive subfolder/file counts and require a separate checkbox confirming all nested content. The repository rejects nonempty deletion unless confirmRecursive is explicitly true.
- Uploads can target department root or any nested folder. Existing validation, 2 MB limit, previews, downloads, rename, delete and quota protection remain in place.
- Folder creation, rename, move, deletion and file moves create department-scoped activity entries.

### Permissions and storage

Admin can manage every folder and file. Executive can browse, preview and download but cannot mutate folders/files. Members can manage their own department and departments with a Manage grant; View grants permit only browsing, previews and downloads. Authorization is checked by the service/repository, including direct commands and file reads after permission revocation.

Folders consume no quota. Department totals sum fileSizeBytes using each file's departmentId, including files at root and at every nested level. Same-department folder/file moves leave department and system usage unchanged. Confirmed recursive deletion releases the deleted files' usage.

### Tests and future backend

Folder tests in `src/lib/folders.test.ts` and `src/data/folder-repository.test.ts` cover creation/nesting, names, rename, moves and root moves, self/descendant/cycle protection, breadcrumbs, empty and recursive deletion, file moves and paths, read/write permissions, revocation, storage invariance, root uploads, activity, legacy migration, reload persistence and atomic failure. Existing file, quota and access suites use the folder model.

Supabase remains disconnected. A future folders table can map the camelCase fields to id, department_id, parent_folder_id, name, created_by, created_at and updated_at, with parent_folder_id referencing folders.id and files.folder_id referencing folders.id. Existing migrated demo IDs remain stable; a real backend migration must map them to UUIDs. Enforce authorization, same-department parents, acyclic moves and sibling uniqueness transactionally on the server, including uniqueness for null/root parents.
