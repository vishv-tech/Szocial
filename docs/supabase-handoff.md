# Supabase integration handoff — work in progress

## User-directed pause

The user asked to preserve the current work by committing and pushing it, then continue in a new Codex Cloud task with refreshed environment variables. This checkpoint is **not a finished integration** and must not be deployed or described as production ready.

- New branch: `feature/szocial-supabase-auth-storage`.
- Base: `feature/szocial-feed-search-chat-fixes` at `65fac20a50903a7d0010cc607d1c33595a890723` (fetched and verified).
- Neither `main` nor the previous feature branch was modified.
- No hosted Supabase project was accessed or modified. **Do not touch Profolio.**
- No hosted migrations, buckets, OAuth providers, test accounts or payment transactions were created.
- The Supabase plugin tag appeared in chat, but no Supabase connector tools were exposed to this task.
- Environment-status metadata and names/presence checks showed no injected Supabase variables in this already-running task and no active local `.env` file. The user reports adding `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Codex Cloud environment settings for the next task. Check the new runtime instead of requesting duplicate values or printing them.

## Implemented checkpoint

1. Installed official `@supabase/supabase-js` and `@supabase/ssr`, plus `sharp` for decoded/re-encoded uploads and the dev-only `@electric-sql/pglite` test engine. Lockfile updated.
2. Browser/server Supabase clients, middleware for Next.js 15 cookie refresh and verified-user route checks, server-only elevated client, PKCE callback and token-hash confirmation routes.
3. Email signup/login/logout/reset endpoints; Google/Facebook buttons and callback plumbing; recovery and profile/business onboarding screens.
4. Three versioned SQL migrations covering profiles/private settings/roles, posts/interactions, businesses/offers/saves/events, conversations/members/messages/blocks/reports/notifications, pricing/payments/subscriptions and media references.
5. Read RLS policies and a transactional `app_mutate` RPC checking the authenticated actor, ownership, membership, blocked pairs and trusted admin roles. Clients have no direct mutation grants to sensitive tables. New-user trigger grants only the resident role, regardless of user-editable auth metadata.
6. Server-controlled post timestamps and immutable ownership/creation trigger; server-side search, geographic ordering and pagination RPC. Own Help posts stay out of discovery.
7. Replaced the main localStorage-backed provider with cookie-authenticated API reads/writes, realtime subscriptions, async actions and database snapshot adapters. Existing screens were being converted to await writes before navigation/success messages.
8. Private Storage bucket migrations and an authenticated upload API using server-only credentials to validate/decode/re-encode images and check entity ownership. A guarded deletion endpoint is present.
9. Razorpay endpoints now use server-controlled plan amounts, ownership-checked purchase reservations, HMAC verification, captured-payment lookups, service-only finalization and a webhook reconciliation handler. Removed mock-payment-success UI. A server-side order claim prevents concurrent duplicate external order creation.
10. Removed password fields from application profile/owner types and demo fixtures. Replaced the old resident-auth module with a redacted legacy-post export helper; no automatic legacy account claims are made. Admin authentication now checks Supabase session plus protected database role records.

Official reference consulted: Supabase SSR creating-a-client guide, retrieved from the official Supabase repository at `apps/docs/content/guides/auth/server-side/creating-a-client.mdx`, and the installed `@supabase/ssr` source. The guide explicitly uses `middleware.ts` on Next.js 15 and recommends cookie `getAll`/`setAll` and verified auth checks. Direct supabase.com docs access was denied by the current network policy; the official GitHub source was accessible.

## Checks actually run at this checkpoint

- `npx tsc --noEmit --incremental false`: **passed** after the current API/UI conversion.
- `npm run lint`: **passed with 11 warnings, zero errors** (two pre-existing landing-page warnings; remaining warnings are unused imports/arguments after the provider conversion).
- `node --test tests/feed-chat.test.cjs tests/database.test.cjs`: **36 passed, zero failed/skipped**.
- The 13 new database tests apply all three migrations to PGlite's actual PostgreSQL engine with controlled auth/storage schemas and JWT-claim fixtures. They verify RLS, role escalation denial, ownership, immutable dates, own-Help discovery exclusion, interactions, search/proximity pagination, private message access, duplicate sends, pair blocking/unblocking, reports, business ownership, server pricing, client payment-finalization denial and recipient-scoped notifications.
- These SQL tests are **not** hosted Supabase Auth, Realtime, Storage-service or OAuth end-to-end tests. Do not present them as such.
- No production build or updated browser tests have been completed for this Supabase checkpoint. The successful build/browser results in `docs/feed-chat-delivery.md` describe the **previous branch**, not this new integration.
- `npm test` currently still selects the old feed/chat test file only; update the script to include database/security suites as integration is completed.

## Resume priorities

### 1. Verify the actual project and environment

Read the cloud runtime skill and current credential/network metadata. Re-discover Supabase tools. Inspect project names through the authorized account connection, if available, before writing. Use only a dedicated Szocial project; never infer that an arbitrary project URL is safe to migrate and never reuse Profolio.

Public URL/key permit user-scoped runtime access, but cannot create a project, apply SQL or manage provider settings. Obtain a supported Supabase MCP/management connection or authorized database migration path for those operations. No management token or project database password has been available in this task.

`SUPABASE_SECRET_KEY` is also required server-side for the current validated-upload and payment reconciliation implementation. Do not expose it in a `NEXT_PUBLIC_` variable or commit it. Check existing bindings before requesting missing ones. Razorpay needs its own test-mode server credentials and webhook secret. Google/Facebook provider configuration requires external credentials and authorized redirect settings. Do not invent a deployment domain.

### 2. Finish and review the in-progress integration

The current files are a checkpoint, not audited final code. In particular:

- Wire real business logo/cover/gallery upload controls: the existing business form still has filename-only placeholder controls. Finish profile image replacement/removal and safe orphan cleanup. Post attachments need their final UI/reference flow where applicable.
- Review RPC media-reference ownership, private file policy predicates, coordinate/metadata validation, schema grants and all privilege boundaries before hosted use. The upload API must enforce a streaming/body-size limit in addition to checking Content-Length and decoded image size.
- Review payment order retry/reconciliation and webhook payload formats against current Razorpay documentation. Current uncertain order creation intentionally stays claimed to avoid duplicate external orders; implement an operational recovery path. Partial-refund accounting and subscription reconciliation are unfinished. No real provider call has been verified.
- Verify that migration pricing values match the actual intended plans; current migration values need product review before payment testing.
- Complete all async UI conversions. In particular check business/profile form state when server data hydrates, success feedback only after a successful write, repeated submissions and failure recovery. Provider business-payment callbacks are now refresh-only, so browsers cannot grant benefits.
- Replace or extend `tests/browser.cjs`: its old fixtures rely on localStorage demo identities, which must no longer authenticate. Add real isolated two-resident/business/admin account tests against a dedicated local/test Supabase project, including storage and payment denial cases.
- The snapshot adapter currently bounds generic queries at 500 rows and posts at 100. Complete per-conversation history pagination and pagination for other growing collections so older/newer records do not silently disappear. Feed RPC pagination is implemented separately.
- Review feed paging reset/races with realtime updates and offset ordering; keep the selected search/category/sort dataset consistent. Verify Help Urgent/Solved filtering and all first-task regressions using actual database data.
- Handle simultaneous independent blocks in one conversation: the database preserves both directional block rows, but the current UI snapshot exposes a single blocker and needs completion for the dual-block state.
- Review realtime message read tracking, reconnect/error feedback, actor changes and retry-safe client IDs in real sessions.
- `lib/location.ts` still has browser location-preference persistence, including coordinate fields. Remove precise GPS persistence from browser storage; keep sensitive location state in the private profile record. `lib/notifications.ts` still contains old unused local notification helpers and should be retired once references are verified.
- Finish an explicit legacy migration/export UI and recovery instructions. The redacted export helper is present; no private messages or passwords should be automatically imported or associated with a newly signed-in user merely because local flags/IDs match. Existing legacy browser data has not been deleted.
- Review missing/deleted/blocked profile rendering so another available profile is not accidentally substituted as a post/message author.
- Finish administrator payment UI: the provider rejects arbitrary client payment-status changes, but obsolete admin controls still need replacing with verified reconciliation/status views.
- Clear the new unused-code warnings and run the complete build, security tests and UI checks after implementation.

### 3. Apply and test safely

Inspect the dedicated project's current schema before applying these initial migrations; do not drop or overwrite existing objects/data to make them fit. Apply through the authorized migration mechanism and run Supabase security/performance advisors if exposed.

Test email confirmation/reset, PKCE callbacks, two-user messaging/blocking/reporting, business onboarding/uploads, private record access and verified test payments. Google/Facebook live tests remain blocked until provider configuration exists. No hosted success is claimed in this checkpoint.

Local Supabase CLI exploration was inconclusive: the latest CLI attempted to create `/home/agent/.supabase` on a read-only mount; a permission request did not change that runtime mount. An older CLI install attempt also exited unsuccessfully. No local Supabase Docker stack was launched. Docker daemon itself was reachable. PGlite tests run independently and pass. Avoid repeating unchanged CLI attempts or weakening TLS/checksum validation.

## GitHub delivery

The previous feature branch was fetched and used as the new branch base. GitHub PR metadata queries returned `Forbidden` through the GraphQL API, so the exact previous PR state could not be read. Git transport works; check remote state and API access anew in the refreshed task. The previous branch was not contained in fetched `origin/main` when this work started.

When integration is ready, open a separate PR against `feature/szocial-feed-search-chat-fixes` if it remains unmerged; otherwise choose the updated integration base after checking ancestry. Do not auto-merge or force-push.
