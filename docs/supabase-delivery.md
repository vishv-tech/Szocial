# Szocial Supabase integration delivery

Continued from `c67153a` on `feature/szocial-supabase-auth-storage`. Base remains `feature/szocial-feed-search-chat-fixes`; its commits are not in the fetched `main`. Existing commits are preserved. This is a reviewable integration with external validation blockers, not a production readiness claim.

## Implemented behavior

- Cookie-backed resident/business email authentication and recovery; PKCE Google/Facebook callbacks. Business social login retains business onboarding intent. Only protected database role records grant administrative access.
- Profile photo upload/replacement/removal; real business logo/cover/gallery controls; image attachments on normal and Help posts. Uploads bound actual streamed bytes, decode and re-encode images, and enforce authenticated entity ownership. Image references are validated and locked in PostgreSQL. Private buckets serve only authorized signed previews. Failed post attachment uploads retain a private, retryable draft.
- Home/Explore/Help use database discovery with search, category/urgency/status filtering, proximity ordering, stable creation timestamps and pagination. Solved Help requests use the correct status; own Help stays out of discovery. Feed paging resets safely when the dataset changes.
- Shared conversations, messages, read receipts, directional blocks and reports use transactional RPCs and RLS. Recent history is loaded per conversation with an older-message cursor. Independent blocks remain effective until each blocker removes their own block. Failed sends retain drafts and reuse the same client ID on retry. Acceptance creates a shared conversation and notification without duplicate acceptance notifications.
- Persistent notifications cover interest, comments, accepted requests, messages, saved-business offers and moderation results. Realtime subscriptions include relevant mutation tables; focus/reconnect and periodic refresh repair missed updates.
- All generic snapshot reads and post interaction reads page through results instead of silently stopping at 500/100 rows. The snapshot still assembles visible collections in memory; a large-scale load benchmark and more granular collection endpoints remain future scaling work.
- Razorpay prices and ownership are controlled by the database. Plans match the previous branch: ₹99, ₹299 and ₹799 for 30-day prepaid entitlements. Purchase reservations reuse pending orders across retries. HMAC checks, provider-side capture/order verification, receipt recovery and cumulative refund reconciliation control payment/subscription records. Partial refunds are recorded; full refunds remove the unused entitlement from that purchase. The payment ledger offers provider-backed reconciliation instead of editable payment status. Checkout cannot open twice concurrently.
- Business offers save actual database rows; malformed listing collections are rejected. Expired subscriptions remove a listing from discovery and prevent new business conversations.
- Precise location is no longer written to browser storage. Legacy plaintext passwords/tokens and authentication flags are retired while redacted old posts remain available through explicit export. No legacy identity automatically acquires a Supabase account or private records. Missing authors display an unavailable identity instead of another resident.
- Profile/business forms hydrate from verified data, failed writes retain input, and failed logout does not navigate as though it succeeded.

## Database and hosted access

The public environment URL matched the dedicated **Szocial** project identified through authorized MCP. Profolio was not accessed or modified beyond the account-level project listing used to identify Szocial.

Eight migrations are applied and recorded. Versioned filenames match hosted migration history:

| Version | Migration |
| --- | --- |
| 20261024110413 | core |
| 20261024110420 | feed_billing_storage |
| 20261024110428 | order_claim |
| 20261024110547 | integrity_privacy |
| 20261024111607 | billing_reconciliation |
| 20261024111840 | policy_boundaries_indexes |
| 20261024115000 | command_validation |
| 20261024122455 | notification_events |

The first three checkpoint migration files were renamed without changing their SQL to align with MCP-assigned versions. The CLI cannot initialize its read-only home directory in this cloud image. `apply_migration` returned invalid/expired request-state errors for `command_validation`; its DDL was applied through `execute_sql`, then its exact SQL and version were registered in migration history. Do not reapply these initial migrations to this project.

Before the user's restriction on hosted test writes, a transactional hosted SQL regression passed ownership, RLS, profile trigger, discovery, Solved Help, shared messages, blocks, reports, notification creation, forbidden image references and forbidden client payment finalization. It verified private bucket settings and Realtime publication membership. Fixtures rolled back. A later read-only aggregate check confirmed zero auth users, posts, messages and payment records, three private buckets, and zero public tables without RLS.

**No more hosted write tests or SQL retries are authorized by this handoff.** The user's latest instruction requires destructive tests to use an isolated database. `tests/isolated-regression.sql` is explicitly restricted to an isolated test database; never run it against the main hosted Szocial project. `npm test` uses a fresh in-memory PGlite database and performs no network/database writes outside it. Any necessary destructive hosted SQL requires one prior explanation and approval with its exact SQL. Preserve existing records.

The final Supabase security advisor reported no findings. Performance warnings for missing foreign-key indexes and repeated auth initialization were fixed; remaining informational unused-index notices are expected on a new empty project and do not justify dropping indexes.

## Verification

- `npm test`: **60 passed**, no failures/skips, retaining all 36 checkpoint tests. Includes real PostgreSQL-engine RLS/ownership/payment tests plus auth/security, webhook and decoded-image upload tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings/errors.
- `npm run build`: passed.
- `npm run test:browser`: Chromium mobile regression with a local Auth test double and mocked application APIs. Covers forged legacy flags, cookie guards, Home/Explore/Help, search/sort, missing author identity, profile hydration, history paging, message reload, blocks, failed-send retry and administrative route denial. Also checks attachment retry and failed logout after their final fixes.
- Hosted SQL results above are distinct from Supabase Auth, Storage HTTP transfers, Realtime WebSocket delivery and OAuth/provider end-to-end tests. Those services have **not** been verified from this runtime.

The Node 24 test subprocess runner in this environment initially reported only test files; `--test-isolation=none` exposes and runs individual cases. Playwright is pinned and committed. Browser testing requires loopback network access and Chromium; `CHROMIUM_PATH` can select the installed executable. Its test services never use hosted credentials or create real accounts.

## Remaining external setup and verification

1. Both public Supabase variables are present. The user reports adding the Szocial network hostname and server-only `SUPABASE_SECRET_KEY`, but the running task still has its original bindings/policy: direct Supabase API requests are blocked and the server secret remains absent. A runtime receiving the updated configuration is required. Never paste or log keys; never interpret the publishable key as administrative access.
2. Configure/verify the actual application Site URL and redirect allowlist in Supabase Auth. Register `/auth/callback` and the appropriate confirmation/recovery redirects. Test email confirmation, reset and logout using isolated accounts in a dedicated test project.
3. Google and Facebook require provider credentials and the Supabase provider callback configured in Google Cloud/Meta. Their enabled state and successful consent/callback have not been verified. No invented deployment domain or provider credentials were used.
4. Validate real avatar, business and post file transfers, replacement/deletion, cross-account signed URL denials and simultaneous sessions in an isolated Supabase test project once the server secret/network are available. Failed object cleanup can leave a private inaccessible orphan; do not run broad cleanup SQL. Any cleanup should inventory exact unused objects and review their references first.
5. Add Razorpay test-mode server credentials, `RAZORPAY_MODE=test`, webhook signing secret and the actual application's webhook URL. Test capture, receipt recovery, duplicate/out-of-order delivery, partial/full refunds and prepaid renewal against the provider. No payment transaction was made here. Automatic recurring Razorpay subscriptions are not configured; the application uses explicit prepaid renewals.
6. Assign the first administrator role only to a deliberately selected, verified account through a trusted administrative process. No admin account or elevated role was created. Test positive admin moderation with isolated accounts; browser tests verify ordinary residents are denied.
7. Hosted multi-account Auth/Storage/Realtime/OAuth/payment validation and deployment remain release blockers. Keep the PR in draft until these pass. Do not merge automatically or modify `main`/the previous feature branch.
