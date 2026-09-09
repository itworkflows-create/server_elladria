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
- `src/data/seed.ts`: seven mock users, six departments, eight spaces, eight documents, three grants, and activity history.
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
| `/departments/:id` | Department storage spaces               | Department access required   |
| `/storage/:id`     | Files, preview, download, management    | Department access required   |
| `/storage`         | System and department storage analytics | Admin, Executive (read-only) |
| `/upload`          | Upload to manageable spaces             | Admin, Department Member     |
| `/search`          | Search all accessible files             | Signed in                    |
| `/users`           | Add/remove users and assign roles       | Admin                        |
| `/permissions`     | Grant, update, revoke access            | Admin                        |
| `/activity`        | Searchable activity logs                | Admin, Executive             |
| `/settings`        | Profile settings                        | Signed in                    |

Unknown routes and inaccessible resources show empty states. Disallowed role routes redirect to the dashboard. Logout removes the demo session.

## Demo roles

- **Alex Morgan — Admin**: all files, department creation/renaming/deletion, user creation/removal, role assignment, access grants, and logs. Department deletion requires a confirmation and removes its spaces, files, and grants while unassigning members. The current administrator cannot remove or demote themselves.
- **Olivia Chen — Executive**: all departments, spaces, search, previews, downloads, recent uploads, and logs. No department or file writes, user management, roles, or permissions.
- **James Wilson — Department Member**: owns Design & Creative and has view-only Marketing access. Sarah has manage access to Operations; Daniel has view access to Design.
- **Noah Patel — unassigned member**: can create their own department once, then create storage spaces and manage its files.
- A View grant allows preview/download. Manage additionally allows creation of spaces and upload/rename/delete of files in that department. Members never manage users, permissions, or department deletion.

## Mock behavior and integration boundary

Workspace changes persist in localStorage (`elladria-demo-v1`); the selected account is in sessionStorage (`elladria-user`). Sign out to test another account. Clearing those keys restores the seed on reload. Account selection is explicitly demo authentication; browser role checks are not production security.

Uploads preserve actual file bytes as data URLs, capped at 2 MB each for browser storage. Storage quota errors are handled without committing partial changes. PDF and PNG uploads have browser previews. Office uploads can be downloaded; seed documents have illustrative text previews and download as `.mock.txt` rather than pretending to be valid Office/PDF binaries. Storage usage comes from file metadata and configured quotas; department member counts are illustrative seed metadata.

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

**Calculations:** A department's usage sums `fileSizeBytes` for files in all its storage spaces. System usage sums all files. Remaining bytes are `max(0, capacity - used)`. Percentage is `used / capacity × 100`, without capping the result; progress visuals cap at 100%. Normal is below 80%, Warning begins at 80%, Critical at 95%, and Full at 100%. Status uses the unrounded percentage. Display percentages truncate to two decimal places so rounding never crosses a status threshold. Zero capacity cannot accept uploads and displays Full without division-by-zero errors. Decimal units are used: 1 MB = 1,000,000 bytes; 1 GB = 1,000 MB.

**Quota changes:** Positive byte-accurate quotas can be entered in MB or GB and persist through the existing repository and query invalidation flow. Lowering a quota below usage retains existing files and shows an explicit warning before saving. Department limits do not reserve system space; if their sum exceeds system capacity, the overview explains the allocation. Total system capacity is mock configuration, not an editable quota control.

**Upload protection:** The form checks the selected department before reading a file and again on submission. The repository rechecks current department and system capacity before committing any file or activity log. Exact-fit uploads are allowed; a file one byte over the remaining department quota is rejected with `This upload would exceed the department storage quota.` Admin uploads obey the same limits. Deleting files releases quota immediately. Browser localStorage limits remain separate from the simulated 50 GB capacity.

Storage tests cover threshold boundaries, exact-fit/over-quota uploads, atomic rejection, file deletion, aggregate calculations, data migration, persistence, invalid quotas, and role enforcement. For Supabase, replace mock configuration and metadata reads with server data, retain the analytics contracts/UI, and enforce quotas transactionally on the server before storage uploads.
