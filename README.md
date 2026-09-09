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

| Route              | Purpose                              | Access                     |
| ------------------ | ------------------------------------ | -------------------------- |
| `/login`           | Choose demo account                  | Public                     |
| `/`, `/dashboard`  | Dashboard (alias redirects)          | Signed in                  |
| `/my-department`   | Own department or creation           | Signed in                  |
| `/shared`          | Explicit cross-department grants     | Signed in                  |
| `/departments`     | All departments                      | Admin, Executive           |
| `/departments/:id` | Department storage spaces            | Department access required |
| `/storage/:id`     | Files, preview, download, management | Department access required |
| `/upload`          | Upload to manageable spaces          | Admin, Department Member   |
| `/search`          | Search all accessible files          | Signed in                  |
| `/users`           | Add/remove users and assign roles    | Admin                      |
| `/permissions`     | Grant, update, revoke access         | Admin                      |
| `/activity`        | Searchable activity logs             | Admin, Executive           |
| `/settings`        | Profile settings                     | Signed in                  |

Unknown routes and inaccessible resources show empty states. Disallowed role routes redirect to the dashboard. Logout removes the demo session.

## Demo roles

- **Alex Morgan — Admin**: all files, department creation/renaming/deletion, user creation/removal, role assignment, access grants, and logs. Department deletion requires a confirmation and removes its spaces, files, and grants while unassigning members. The current administrator cannot remove or demote themselves.
- **Olivia Chen — Executive**: all departments, spaces, search, previews, downloads, recent uploads, and logs. No department or file writes, user management, roles, or permissions.
- **James Wilson — Department Member**: owns Design & Creative and has view-only Marketing access. Sarah has manage access to Operations; Daniel has view access to Design.
- **Noah Patel — unassigned member**: can create their own department once, then create storage spaces and manage its files.
- A View grant allows preview/download. Manage additionally allows creation of spaces and upload/rename/delete of files in that department. Members never manage users, permissions, or department deletion.

## Mock behavior and integration boundary

Workspace changes persist in localStorage (`elladria-demo-v1`); the selected account is in sessionStorage (`elladria-user`). Sign out to test another account. Clearing those keys restores the seed on reload. Account selection is explicitly demo authentication; browser role checks are not production security.

Uploads preserve actual file bytes as data URLs, capped at 2 MB each for browser storage. Storage quota errors are handled without committing partial changes. PDF and PNG uploads have browser previews. Office uploads can be downloaded; seed documents have illustrative text previews and download as `.mock.txt` rather than pretending to be valid Office/PDF binaries. Usage reflects accessible file sizes against a labeled 5 GB demo capacity; department member counts are illustrative seed metadata.

For Supabase, replace the repository, introduce real auth sessions and object-storage URLs, and enforce these same policies with server-side row-level security and storage rules. Do not treat this local demo's client authorization as a security boundary. No backend integration is active.

Tests cover role access, cross-department grants/revocation, executive write denial, one-department ownership, and administrator safeguards.
