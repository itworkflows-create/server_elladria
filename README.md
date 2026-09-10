# Elladria workspace

Internal document management with the existing React + TypeScript + Vite, Tailwind/shadcn UI, React Router, TanStack Query, React Hook Form and Zod frontend. Phase 2 connects it to Supabase Auth, PostgreSQL and private Storage without redesigning the application.

The default backend is Supabase. No project credentials are committed. The implementation has local automated coverage; a real hosted Supabase project has **not** been verified in this workspace. Complete the live acceptance checklist below before using company data.

## Supabase setup (manual)

### 1. Create and configure a project

Create a Supabase project in your organization. Record its project reference, project URL and public anon/publishable key. In Authentication settings, enable email/password sign-in, disable public sign-ups for this internal workspace, and set the Site URL to your frontend origin.

Use Node.js 22.12+ (Node 24 was used for recovery) and npm. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started); the commands below use `npx supabase`.

### 2. Configure the frontend

Copy `.env.example` to `.env.local` and replace the placeholders:

```dotenv
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Only public browser credentials belong here. Service-role/secret keys are restricted to the server. Restart Vite after changing environment variables; production builds need these variables at build time.

### 3. Apply versioned database migrations

From this repository:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The migrations are the schema source of truth. Do not replay individual migrations manually or reset an existing remote database to recover an interruption. Compare local and remote migration history first. See the [official migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

| Migration | Contents |
| --- | --- |
| `202609100001_schema.sql` | Six core tables, settings, upload reservations, deletion jobs, Auth profile trigger, updated-at and hierarchy triggers, indexes, RLS and grants |
| `202609100002_commands.sql` | Authorized commands, RLS-filtered snapshot, transactional quotas, upload commit/abort/cleanup, recoverable deletions, service-only profile provisioning |
| `202609100003_storage.sql` | Private `company-files` bucket and authenticated read policy |
| `202609100004_user_deletion.sql` | Service-only deletion authorization and Auth deletion guard/audit trigger |

### 4. Deploy the Edge Functions

The functions use the server-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Verify these are available in the project's function environment. This implementation uses those legacy server key names; the browser may use a public publishable key. Keep the server keys out of frontend variables.

Set the exact frontend origins, without trailing slashes, then deploy both functions:

```sh
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://YOUR_FRONTEND_HOST
npx supabase functions deploy workspace-files
npx supabase functions deploy manage-users
```

`supabase/config.toml` enables gateway JWT verification. The handlers also verify the caller with `auth.getUser()` before creating the privileged service client. Every mutation checks the authenticated user's database permissions. For API-key and gateway behavior, consult [Supabase's authorization header documentation](https://supabase.com/docs/guides/functions/auth-headers). Function deployment follows the [official deployment workflow](https://supabase.com/docs/guides/functions/deploy).

### 5. Bootstrap the first administrator

After migrations, create an email/password user through the Supabase Dashboard's Authentication user-management screen. Mark the email confirmed for this administrator. The Auth trigger creates a `department_member` profile and deliberately ignores metadata-supplied roles.

Copy that user's UUID and run this one-time SQL in the Dashboard SQL editor:

```sql
update public.profiles
set role = 'admin'
where id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid
returning id, display_name, role;
```

Confirm exactly one row was updated. Subsequent account creation, role changes and deletion go through the application's Admin interface. User deletion must use the app: the Auth deletion trigger requires a short-lived authorization from a verified administrator, so direct Dashboard deletion is intentionally rejected.

### 6. Install, start and sign in

```sh
npm install
npm run dev
```

Open the Vite URL and sign in with the administrator's email/password. Create a department, then open Users to create a Department Member assigned to it. New passwords must have 12–128 characters; communicate them privately. Create an Executive and a second member in another department to exercise cross-department permissions.

For production, run `npm run build`, serve `dist`, and configure an SPA fallback to `index.html` for nested routes. Include the production origin in `ALLOWED_ORIGINS` and the Auth Site URL settings.

## Live acceptance checklist (still required)

Use separate browser profiles or sign out between users. Test with small sample files, up to 2,000,000 bytes each.

1. **Auth:** log in by email/password, reload to restore the session, log out, and confirm a protected URL returns to login. Invalid credentials must fail.
2. **Admin:** create two departments and users with each role; change another user's role and a department quota; grant/revoke permissions. Verify corresponding activity entries.
3. **Own department:** a member can create/open/rename/move/delete nested folders and upload/rename/move/delete files. Reject sibling duplicate folder names, self/descendant moves and cross-department destinations. Nonempty folder deletion requires confirmation.
4. **Files:** upload PDF, JPG/PNG, audio and video samples; preview each; download and compare original bytes. DOC/DOCX and XLSX download without an embedded preview. Reopen previews to renew expired links. Browser codec support still applies.
5. **Executive:** browse every department, preview/download, and view activity/storage analytics. Direct RPC requests for writes, quota changes, roles and grants must be rejected, not just hidden in the UI.
6. **View grant:** a member in the second department initially cannot read the first. Grant View: browsing and downloads work, folder/file writes fail.
7. **Manage grant:** upgrade the same grant: folder/file CRUD works; administrative actions still fail. Revoke it: fresh reads/signing and writes fail. A previously issued signed URL can remain usable until its 60-second expiry.
8. **Quotas:** lower a department quota to a small test value. Test exact-fit and over-quota uploads, plus simultaneous uploads from two sessions. Ready files plus in-flight reservations must never reserve above the available quota. Moving files leaves usage unchanged; completed deletions free it.
9. **Recovery:** interrupt a sample upload/deletion. Check Pending cleanup; stale uploads become eligible after 10 minutes. Retry cleanup and verify both Storage and metadata. A department with a pending deletion is locked against other mutations.
10. **Private access:** verify the bucket is private, logged-out/unauthorized reads fail, and authenticated clients cannot directly insert/update/delete Storage objects or core table rows.
11. **User administration:** create and delete a disposable member, verify existing uploaded files remain, and confirm non-admin calls to `manage-users` fail. Self-demotion/deletion and deleting a user with a pending upload must fail.

## Security and data flow

- RLS filters reads of all public application tables. Browser table writes are revoked; security-definer RPCs perform explicit role checks under a serialized settings-row lock. Role checks read the database profile rather than trusting browser input or user-editable Auth metadata.
- Admin has full application access. Executive reads all departments, files, activity and analytics. Department Members manage their own department and departments with Manage grants; View grants allow reads only. The existing one-department creation behavior for unassigned members is preserved.
- Uploads validate file extension/MIME, name and size, reserve quota transactionally, write bytes through `workspace-files`, then finalize metadata and the activity event. Upload permissions and quota are checked again before commit. Cleanup handles failed commits and uncertain network responses without deleting a successfully committed file.
- Storage paths use `departments/{departmentUuid}/{fileUuid}/original.{extension}`. Original names remain in PostgreSQL; moving/renaming folders or files does not rename Storage objects.
- Private preview/download URLs last 60 seconds. PDF/image/audio/video previews use those URLs; Word and XLSX use download. No public URLs are generated for real files.
- Quota checks include pending reservations and files awaiting deletion. Displayed usage is the sum of file sizes, including pending deletions until cleanup finishes. Thresholds remain Normal <80%, Warning 80–<95%, Critical 95–<100%, Full >=100%.
- Defaults are 5 GB per department and 50 GB workspace capacity (decimal bytes). The global capacity is application configuration, not the Supabase plan's billing allowance. Admin changes department quotas in the app. A trusted operator can change `workspace_settings.total_capacity_bytes` through SQL when required.
- Recovery jobs survive browser or function failure. Upload tombstones hold quota for at least 10 minutes to protect against late object writes. Cleanup is retried by the initiating user or an Admin through Pending cleanup; no scheduled sweeper is installed.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/lib/supabase.ts` | Client configuration, public-key validation, explicit backend mode |
| `src/context.tsx`, `src/data/auth-repository.ts` | Central auth/session/profile state, query cache, login/logout |
| `src/data/repository-contract.ts`, `src/data/repository.ts` | Existing UI-facing command contract and backend selection |
| `src/data/supabase-repository.ts` | Department, permission, folder, file, activity and admin command routing |
| `src/data/supabase-mappers.ts` | Database-to-domain mapping |
| `src/lib/supabase-file-service.ts` | Private preview/download and upload preparation |
| `supabase/functions/workspace-files` | Authorized upload and recoverable physical deletion |
| `supabase/functions/manage-users` | Server-only account creation/deletion |
| `supabase/migrations` | Versioned schema, policies, triggers, functions and indexes |

The existing combined repository is retained to avoid unnecessary UI changes. Supabase access stays in the repository/services rather than components.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Edge Functions are outside the frontend TypeScript project; additionally run:

```sh
deno check supabase/functions/manage-users/index.ts supabase/functions/workspace-files/index.ts
```

`src/data/supabase-sql.test.ts` executes the migrations and RLS in PGlite (PostgreSQL) with stubbed Auth/Storage tables. `src/data/supabase-adapters.test.ts` checks adapter routing, error mapping, signed downloads and upload validation with mocked SDK responses. The older suites exercise demo persistence, folders, permissions, file types and quotas. These tests do not verify hosted Auth, Storage HTTP behavior, deployed Edge Functions or true multi-connection concurrency; use the live checklist for those.

## Retained offline demo

Set `VITE_DATA_MODE=demo` explicitly and restart Vite to use the old account selector and browser-local data. Demo repositories, uploaded local bytes, fixtures and fake sessions remain isolated behind this opt-in mode while real Supabase acceptance is pending. Supabase configuration errors never silently switch to demo. There is no automatic import of local mock records into Supabase.

The original Phase 1 documentation is preserved in [docs/phase1-demo.md](docs/phase1-demo.md); it describes only the offline demo. See [docs/phase2-recovery.md](docs/phase2-recovery.md) for the recovery audit and verification record.
