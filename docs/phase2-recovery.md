# Phase 2 recovery report — 2026-09-10

## 1. Where implementation stopped

The last committed revision was `c00573b` (Add hierarchical folder storage model). Phase 2 was present as uncommitted edits/new files, with the most recently modified source being `src/data/supabase-sql.test.ts` at 12:23:32 local time. The evidence places the interruption during SQL test implementation, before a successful verification pass and before the README update. It does not establish the exact last keystroke.

The audit was completed before any repository edits or dependency installation. Inspected package.json/lockfile, src, all four migrations, both Edge Functions/shared helpers, environment-file inventory, README, Git status/diff/history and modification timestamps. No AGENTS.md was found in the repository or checked ancestor directories. No configured `.env.local` or remote Supabase project link was present.

**Completed at recovery:** Supabase configuration, auth, repositories, schema, RLS, Storage policies, server upload/deletion handling, quota reservations, admin functions and most UI wiring.

**Partial:** SQL tests, validation of the complete implementation, and private-file preview copy.

**Not started:** Phase 2 README setup instructions and verifiable live-project acceptance.

**Interruption defects confirmed by checks:** the SQL test helper lacked a closing brace; several PGlite query results had unfinished TypeScript typings; two assertions expected a number although PostgreSQL SUM(bigint) returned a numeric string. These blocked TypeScript, lint/test parsing and production build. No incomplete SQL statements, missing dependency installation or broken production imports were found.

## 2. Files already implemented before recovery

- `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `src/vite-env.d.ts`.
- `src/lib/supabase.ts`, `src/data/auth-repository.ts`, `src/context.tsx`, `src/app-context.ts`, `src/pages/login.tsx`.
- `src/data/repository-contract.ts`, `src/data/repository.ts`, `src/data/supabase-repository.ts`, `src/data/supabase-mappers.ts`.
- `src/lib/file-service.ts`, `src/lib/supabase-file-service.ts`, `src/lib/service-errors.ts`.
- `src/demo-context.tsx`, `src/pages/demo-login.tsx`, `src/data/mock-repository.ts`, `src/lib/mock-file-service.ts`, and updates redirecting existing tests to the explicit mock repository.
- UI/domain updates in `src/components/layout.tsx`, `src/components/files/file-table.tsx`, `src/pages/admin.tsx`, `src/pages/settings.tsx`, `src/pages/upload.tsx`, `src/types.ts`, `src/types/files.ts`, `src/lib/file-types.ts`.
- All files under `supabase/`: configuration, four migrations, two Edge Functions and shared HTTP/file validation.

The SQL test file also existed, but was incomplete. Previously working implementation was retained; no migrations were rewritten and no frontend redesign was performed.

## 3. Files created/changed during recovery

| File | Recovery change |
| --- | --- |
| `src/data/supabase-sql.test.ts` | Closed the unfinished helper, typed query results, corrected numeric-string assertions |
| `src/components/files/file-preview.tsx` | Real private files now show accurate download/expiry copy instead of seed/demo notices |
| `src/data/supabase-adapters.test.ts` | Added 8 tests for upload bytes, server routing, errors, private signed URLs, byte-preserving downloads, document fallbacks and validation |
| `src/data/auth-repository.test.ts` | Added 3 tests for session restoration/subscriptions, email/password login/logout and failures |
| `README.md` | Added Supabase deployment/bootstrap instructions, architecture, operational behavior and live acceptance checklist |
| `docs/phase1-demo.md` | Preserved the original Phase 1 README |
| `docs/phase2-recovery.md` | This audit and final verification record |

`npm install` completed with dependencies up to date. It refreshed the lockfile timestamp; its size remained 202,470 bytes. Generated build/cache files remain ignored. All pre-existing uncommitted work remains uncommitted.

## 4. Database migrations present

1. `supabase/migrations/202609100001_schema.sql`
2. `supabase/migrations/202609100002_commands.sql`
3. `supabase/migrations/202609100003_storage.sql`
4. `supabase/migrations/202609100004_user_deletion.sql`

The six required core tables are present with timestamps, keys, indexes and relevant updated-at triggers. Support tables store workspace capacity, upload reservations and deletion jobs. Hierarchy triggers and unique indexes enforce folder consistency. All migrations successfully execute in the PGlite test environment.

## 5. RLS status

Enabled on every public application table. Read policies enforce roles and department grants. Authenticated/anonymous direct table writes are revoked; authorized security-definer RPCs perform mutations. Service-only provisioning/deletion RPCs cannot be called by browser roles. Storage reads require a readable ready file row. Offline PostgreSQL tests cover privilege escalation attempts, private reads, View/Manage grants, revocation and direct-write denial. Hosted RLS/Storage acceptance remains pending.

## 6. Auth status

Supabase email/password login, logout, persisted-session restoration, auth subscriptions, profile loading, protected routes and user-scoped query caching are implemented. Auth repository tests pass. Actual hosted login/session behavior is not yet verified.

## 7. Storage status

Private `company-files` bucket, 2,000,000-byte per-file limit, UUID-based object paths, no browser upload/delete policies and short-lived signed reads are implemented. Physical writes use authenticated Edge Functions with server-only service credentials. Folder hierarchy lives only in PostgreSQL. No hosted objects were uploaded during recovery.

## 8. Upload / preview / download status

Uploads validate type/name/size, reserve quota, write Storage bytes, finalize metadata/activity and invalidate the workspace query. Failed finalization runs abort/remove/cancel cleanup; uncertain committed responses are handled without deleting committed data. Private PDF/image/audio/video previews and Word/XLSX downloads are connected. Signed URLs expire after 60 seconds; original-byte downloads are covered by adapter tests. Hosted upload/cleanup and browser media checks remain pending.

## 9. Folder CRUD status

Create/open/rename/move/delete is connected through the existing repository. Database guards reject self/descendant nesting, cross-department parents and case-insensitive duplicate sibling names, including root names. Recursive deletion is recoverable and requires confirmation for nonempty folders. Offline SQL tests pass.

## 10. Role / permission status

Admin has application-wide access. Executive reads all departments, files, logs and analytics but cannot mutate folders/files or administrative settings. Members manage their own department, browse with View grants and perform folder/file CRUD with Manage grants. Database authorization supplements UI guards; roles come from profiles rather than user-editable Auth metadata. Existing one-department creation for unassigned members is preserved.

## 11. Storage quota status

File-size sums drive displayed department/system usage. Transactional upload reservations and a settings-row lock serialize application quota mutations and prevent overlapping reservations from exceeding capacity. Finalization rechecks current permission and capacity. Pending cleanup retains quota until Storage cleanup is confirmed. Moves do not affect usage. Thresholds remain 80%, 95% and 100%. Offline tests pass; true concurrent hosted sessions still need the live test.

## 12. Admin user-management status

`manage-users` verifies the caller, requires an Admin profile and uses server-only Auth admin calls. Profile provisioning and deletion authorization are server restricted. Auth deletion is guarded in its transaction, preserves uploaded file records and records the actor. Self-removal/demotion is blocked. Both Edge Functions passed Deno typechecking; deployed runtime behavior is pending.

## 13. Anything still mocked

The old localStorage database, sessionStorage account selector, local uploaded file bytes and sample assets are retained only in explicit `VITE_DATA_MODE=demo`. They are not the default backend and there is no silent fallback. Existing fixture tests use these modules directly. PGlite tests stub Supabase Auth/Storage schemas, and adapter tests mock SDK/network responses. Removal of demo code is deferred until real Supabase acceptance, as requested. No automatic import of demo data is implemented.

## 14. Manual actions required

Follow README.md to create/link a Supabase project, configure `.env.local`, apply migrations, configure allowed origins, deploy both functions, create/bootstrap the first Admin and start the app. Then create departments/members and run the live acceptance checklist for Auth, every role/grant, uploads/previews/downloads, quotas, recovery and user management. No remote database writes or deployments were attempted without project configuration.

The functions currently expect the server environment's legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Confirm availability when deploying. Frontend credentials remain public-only.

## 15. Verification results

| Check | Result |
| --- | --- |
| `npm install --cache .npm-cache --no-audit --no-fund` | Passed; up to date |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | Passed: 106 tests in 15 files |
| `npm run build` | Passed; 1,812 modules transformed |
| Deno check of both Edge Functions | Passed |
| `git diff --check` | Passed |
| Real configured Supabase project | Not tested |

Build has a non-blocking large-chunk warning (main JavaScript ~734 kB, ~218 kB gzip). npm reported an esbuild install-script approval notice; the existing esbuild executable worked for tests and build. No application check failures remain.

The Windows sandbox could not start processes because of a deny-read ACL helper error. Approved elevated executions were used for workspace reads/edits and checks. Node 24.20.0 was available in the sibling project's portable runtime; Git was available through GitHub Desktop. A temporary npm-provided Deno runtime checked the functions.

## 16. Remaining Phase 2 work

Local implementation recovery and required checks are complete. Deployment/configuration and the real-project acceptance checklist remain. Hosted Auth, Storage, Edge Function execution, multi-session concurrency and browser previews have not been claimed as verified. Keep the explicit demo modules until that acceptance succeeds; any subsequent removal should preserve static test fixtures.
