# Szocial performance and smart refresh

Continues `feature/szocial-supabase-auth-storage` from `8506183`, preserving the signup, confirmation, OAuth availability and photo-crop fixes. PR #1 remains a draft against `feature/szocial-feed-search-chat-fixes`.

## Confirmed causes

- The feed effect depended on the global snapshot revision, cleared posts and pagination on each change, and marked every request as initial loading. Fresh signed URLs made otherwise unchanged snapshots compare unequal.
- A 30-second timer, changes to 17 tables and most mutations triggered the same full application snapshot. A stationary seeded Home session made two full snapshot calls and two feed calls in a minute, with two visible loading flashes.
- The snapshot downloaded growing unrelated collections, fetched message histories once per conversation, and signed unrelated media. The baseline core request made 53 PostgREST HTTP requests, two Auth verifications and four Storage signing calls, returning 898,595 bytes.
- Middleware and API handlers both verified Auth. The single large Context also made post cards participate in unrelated updates. Most action buttons waited for server work and a global reload before visibly changing.

## Changes and correctness

`lib/feed-cache.ts`, `components/useServerFeed.ts`, `FeedPaging.tsx` and `PostCard.tsx` implement account-owned, in-memory stale-while-revalidate feeds. Cached cards remain mounted while refreshing; errors retain authorized data with Retry. A refresh rebuilds the entire already-loaded page window atomically, preserving order and depth while adding/removing/deduplicating rows. Search, category, type, status, sort, location and account identify independent views. Saved selections and scroll survive SPA navigation; Next's automatic navigation scroll cannot overwrite the stored position. Inactive feed caches are bounded to 32; no private feed data is persisted in localStorage.

`lib/sync-scheduler.ts`, `lib/app-sync.ts` and `AppStoreProvider.tsx` coalesce bursts over 200 ms, prevent overlap and retain one trailing invalidation during a request. Relevant changes refresh active resources; inactive resources become dirty for their next visit. A single channel per provider/account is cleaned up on signout or remount; async connection setup checks account epoch and disposal before subscribing. Hidden tabs queue work. Visibility, focus, online and reconnect restore synchronization, with focus throttled to 15 seconds. The 30-second fallback runs only while Realtime is unavailable; a 120-second reconciliation covers missed events/RLS revocations even when the channel is live. These are targeted resource calls, not full snapshots.

401/403 account failures clear account data; brief 503 failures retain it while recent access is verified. Failed verification after two minutes clears stale private state. Abort signals, epochs, request scopes, actor IDs and queued-work reset prevent old account responses from repopulating caches. Blocked authors are removed immediately and filtered out of already-pending responses. Successful login and session-available signup cancel older anonymous bootstrap requests before loading the authenticated account; signup then restores its new cropped-photo/setup draft. Anonymous startup failures do not erase that draft. Public identity patches cannot overwrite the owner's private profile, and unrelated billing/core patches preserve separately loaded offers and analytics.

`app/api/app/route.ts`, `lib/server-data.ts` and `ResourcePaging.tsx` split core, notifications, chat summaries, businesses, own/joined posts, billing, people, reports and admin statistics. Large lists use 30-row pages with stable ordering and visible Load more controls; refreshed windows retain all loaded pages. Counts and notifications are server-derived. Core contains only the verified account bootstrap; posts, chat history and payment history are loaded for the pages using them. Related child rows are filtered by selected IDs and read in bounded chunks. Interested-person identities are loaded on demand through authenticated `/api/people`.

Business discovery filters and ranks all authorized **minimal candidate metadata** before pagination, then fetches/signs only the selected full records. Home loads three nearby business previews. This preserves older nearby businesses and category/search matches outside the newest page. Own/detail/admin business queries remain targeted. The complete candidate scan is an explicit remaining scaling cost until a database ranking RPC is separately reviewed.

`app/api/feed/route.ts` keeps the existing `discover_posts` RPC and its RLS, substring search, Nearby/Newest/Oldest/Farthest ordering, visibility rules, stable timestamps and pagination. Mapping reads interactions only for the selected post IDs, batches public author lookups and returns each public identity once per response. The small author map replaces dependence on a full account-directory snapshot; it increases the individual feed payload slightly while sharply reducing combined bootstrap/feed traffic. Private profile fields never enter the feed author map.

Media signing remains under the caller's cookie client and private Storage policies. Only referenced, RLS-visible media metadata is queried and signed, in bucket batches. Each account reuses signed URLs for at most 55 minutes of their 60-minute lifetime; active reconciliation obtains replacements before expiry. The account media cache is bounded to 2,000 entries and is cleared on account changes. Images use lazy loading and asynchronous decoding where appropriate. No public buckets or shared private server caches were introduced.

`ChatWindow.tsx`, `/api/messages` and the provider load recent history only when a conversation opens, keep older loaded history, coalesce refreshes for the active thread, and preserve membership/block checks. Chat summaries embed one latest message per conversation instead of fetching 50 messages separately for every thread. Unread counts use targeted database counts/IDs. Summary and history unread counts both exclude system messages. Pending messages appear immediately; confirmed messages replace their client IDs, failed sends retain the retryable draft, and late responses cannot alter another account. Notifications refresh independently and support history pagination. `Button.tsx` immediately marks asynchronous handlers busy; interest and business save actions update optimistically with rollback, without optimistic authentication, roles or payment entitlements.

Business notifications retain their database-derived recipient type and exact unread totals beyond the loaded page; administrator profile pages retain scoped report counts. Admin aggregate totals and queues are independent of list pagination and require a verified database admin role. Only this dashboard scans paginated minimal aggregate inputs for revenue, distinct reports and location counts. This can move into a reviewed aggregate RPC later. Existing subscription/payment verification remains server-authoritative; no Razorpay or RLS SQL was changed.

`lib/request-metrics.ts` and `lib/supabase/server.ts` return private/no-store responses and safe `Server-Timing` totals for Auth, data HTTP, Storage HTTP, serialization and request count. Concurrent HTTP durations are summed and can exceed wall-clock total. These are not SQL execution times. URLs, keys, tokens and private payloads are not recorded by the instrumentation.

## Reproducible measurements

The committed `scripts/performance.cjs` runs actual Next.js route handlers, the Supabase SDK, cookie authentication flow and Chromium against isolated deterministic Auth/PostgREST/Storage/Realtime fixtures. It seeds 241 profiles, 240 posts, 1,200 comments, 20 conversations and 2,000 messages, plus businesses and notifications. Each backend HTTP operation waits 35 ms. No hosted database is read or changed by this script.

Before uses an isolated archive of `8506183` with the same final harness and dependencies. The working branch is never switched. Each mode warms routes, takes five samples per endpoint (median), then observes a stationary Home for 61 seconds. Home timing is login-click to first visible post, including client navigation/hydration and account bootstrap. Button timing is click to changed/disabled state; chat send timing is click to server-confirmed input clearing. Development includes first route compilation; production uses a completed build. Post-idle heap samples follow explicit Chromium garbage collection and are a short observation, not a leak-proof guarantee. Realtime is a protocol fixture, not hosted delivery.

Raw reports are in `docs/performance/{before,after}-{production,development}.json`.

## Measured results

| Metric | Production before | Production after | Change | Development before | Development after |
|---|---:|---:|---:|---:|---:|
| /api/app, now core bootstrap | 707.4 ms | 205.4 ms | 71.0% less | 758.6 ms | 215.7 ms |
| /api/feed | 312.4 ms | 278.6 ms | 10.8% less | 335.5 ms | 297.4 ms |
| Idle API calls / 61 seconds | 4 | 0 | 100.0% less | 4 | 0 |
| Idle loading flashes | 2 | 0 | 100.0% less | 2 | 0 |
| Login to visible Home post | 1,875.8 ms | 1,450.2 ms | 22.7% less | 4,289.9 ms | 5,247.3 ms |
| Interest button feedback | 1,420.0 ms | 4.9 ms | 99.7% less | 1,653.3 ms | 14.5 ms |
| Chat navigation to composer | 1,542.1 ms | 994.2 ms | 35.5% less | 2,841.9 ms | 3,295.3 ms |
| Chat send to confirmed input clearing | 911.9 ms | 223.1 ms | 75.5% less | 1,079.7 ms | 633.2 ms |

Production endpoint work and payloads:

| Metric | Before | After |
|---|---:|---:|
| Core PostgREST HTTP requests | 53 | 6 |
| Core Auth verifications | 2 | 1 |
| Core Storage signing HTTP requests | 4 | 1 |
| Core signed object paths | 282 | 1 |
| Feed PostgREST HTTP requests | 7 | 8 |
| Feed Auth verifications | 2 | 1 |
| Feed signed object paths | 141 | 12 |
| Core response bytes | 898,595 | 1,201 |
| Feed response bytes | 32,808 | 36,540 |

The core route now returns bootstrap data; other required data is fetched through page resources. These per-endpoint payloads are not a measurement of every initial page asset/request. The feed response grew by 11.4% because it now carries its own normalized public author identities; it no longer needs a full directory snapshot to render authors correctly. Feed HTTP data requests increased from seven to eight for this author lookup, while unrelated media signing and duplicate Auth were removed.

Both modes recorded one peak live Realtime channel; the two joins reflect separate Home and chat page visits. Production post-GC heap usage was 7,247,200 → 7,477,364 bytes during baseline idle and 6,131,776 → 6,272,276 after. These short observations and explicit cache bounds do not prove absence of long-session leaks.

Development cold Home navigation was **slower** (4.29 → 5.25 seconds), and cold chat navigation also increased (2.84 → 3.30 seconds). The final development log includes 1.68 seconds compiling the Auth handler, 1.13 seconds compiling Home and 0.22 seconds compiling the feed route on the login/Home path; cold navigation still includes compilation and application work. Warm development APIs and feedback improved, and production navigation improved. Further development compilation/bundle profiling is warranted; no development cold-load improvement is claimed.

Final production Server-Timing samples reported approximately 38 ms for the fixture Auth HTTP request and 0.01/0.07 ms serialization for core/feed. Summed parallel data HTTP durations exceeded total wall time, as expected. Actual hosted SQL/network latency and separate React hydration CPU time were not measured.


Run from a checkout with dependencies and Chromium installed:

```sh
node scripts/performance.cjs after production
node scripts/performance.cjs after development
```

Use an isolated archive of the baseline commit and copy this same harness into it for before measurements. Do not benchmark while changing application source: development hot reload invalidates comparisons. The harness uses only local test credentials and never needs the production server secret.

## Verification and external limits

Final checks on the delivered code passed: **109 unit/integration tests (29 added, all 80 previous cases retained), zero failures/skips; TypeScript; ESLint with zero warnings/errors; production build; and both Chromium suites with 19 passing scenario groups.** Tests use a fresh isolated PGlite PostgreSQL engine for SQL/RLS/payment cases, route-level service fixtures and Chromium. They do not establish hosted Auth, email delivery, real Google/Meta consent, Storage persistence, real WebSocket delivery or Razorpay success.

The running cloud configuration still has the two public Supabase bindings, matching the dedicated Szocial project, but no `SUPABASE_SECRET_KEY` binding and no custom Supabase hostname allowance. These values were checked only for presence/project match; credentials were not logged. Supabase MCP is available, but this performance change needs no hosted SQL. No SQL statements, migrations, destructive tests or hosted records were changed, and Profolio was not accessed. The existing eight applied migrations are preserved.

Hosted query plans, SQL execution times, real round-trip latency and production React/CPU profiling remain unmeasured. The unchanged discovery RPC uses substring filtering and distance sorting; the existing full-text index does not accelerate that substring expression. Obtain an authorized hosted EXPLAIN with representative test data before proposing a separate non-destructive indexing/ranking migration. Catalog candidates, dashboard aggregate inputs, large comment/interaction sets and deep offset pages can still grow in cost. These limits are separate from the eliminated global refresh/loading bug.

Keep PR #1 in draft until the existing external release requirements in `supabase-delivery.md` and `auth-signup-photo-fixes.md` are satisfied: an updated runtime, actual Site URL/redirect configuration, SMTP/confirmation/recovery checks, Google/Meta credentials and consent, isolated multi-account Auth/Storage/Realtime tests, and Razorpay test-mode credentials/webhook verification. No merge or deployment was performed.


## Final checks and files

The final sequential check run completed successfully:

| Command | Result |
|---|---|
| `npm test` | 109 passed, 0 failed, 0 skipped |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, 0 warnings/errors |
| `npm run build` | Passed with the configured public environment |
| `npm run test:browser` | Both suites passed, 19 scenario groups |

The 29 new unit/integration cases cover resource scoping, public identities, private-profile preservation, business ranking before pagination, exact unread counts, admin permissions/totals/report counts, cache bounds, stale/denied access, account reset, block races, background failures, pagination, event filtering, hidden work and request coalescing. Added browser assertions cover protocol-level matching/nonmatching post events, slow/outage refresh without remounts, deletion, rapid repeated interest clicks, two-page/filter/sort/scroll preservation, hidden/focus/reconnect, targeted incoming messages/notifications, independent account switching, expiry, and session-available signup retaining a real cropped photo despite an older anonymous request.

Measured with Node 24.19.0, Next.js 15.5.18, the pinned Supabase SDK and Chromium 154 on this cloud workspace. A final staged-diff check found no configured credential values/private-key patterns and no migration changes.

Changed files for this follow-up:

```text
app/api/app/route.ts
app/api/feed/route.ts
app/api/messages/route.ts
app/api/people/route.ts
components/AdminLayout.tsx
components/AppHeader.tsx
components/AppStoreProvider.tsx
components/BusinessCard.tsx
components/BusinessLayout.tsx
components/Button.tsx
components/ChatWindow.tsx
components/FeedPaging.tsx
components/PostCard.tsx
components/ResidentShell.tsx
components/ResourcePaging.tsx
components/screens/AdminScreens.tsx
components/screens/ResidentScreens.tsx
components/useServerFeed.ts
docs/performance-optimization.md
docs/performance/after-development.json
docs/performance/after-production.json
docs/performance/before-development.json
docs/performance/before-production.json
docs/supabase-delivery.md
lib/admin-stats.ts
lib/app-sync.ts
lib/business-catalog.ts
lib/chat-rules.ts
lib/client-api.ts
lib/feed-cache.ts
lib/request-metrics.ts
lib/server-data.ts
lib/supabase/server.ts
lib/sync-scheduler.ts
middleware.ts
scripts/performance.cjs
tests/auth-browser.cjs
tests/browser.cjs
tests/performance.test.cjs
tests/resource-data.test.cjs
types/index.ts
```
