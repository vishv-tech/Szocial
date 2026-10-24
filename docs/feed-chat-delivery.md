# Feed, Help, Explore and chat delivery

## Architecture and scope

Szocial is a Next.js 15 / React 19 application. Resident/business identities, posts, chats, reports, notifications and payment history live in browser localStorage. `AppStoreProvider` is the shared client data/action layer. Server routes exist only for admin authentication and Razorpay. There is no database client, schema, migration runner, resident server session, shared chat API or WebSocket service to extend.

The existing checkout and design are retained. No application data is deleted, no dependencies are added and no database migrations are needed for these client changes. Backend-dependent requirements are **partial**, not production-ready guarantees. A shared authenticated datastore is required for server-authoritative timestamps, cross-device delivery, access controls and moderation. Implementing that would be a separate architecture change, not a configuration/credential fix.

## Implemented features

| Task | Status | Files and behavior |
| --- | --- | --- |
| A1 Offer Help | COMPLETED | `components/screens/ResidentScreens.tsx`: removed tab and helper listing; normal Help creation preserved. |
| A2 Help save | COMPLETED | `components/PostCard.tsx`, `components/HelpCard.tsx`: verified neither renders Save/Bookmark; no Help save control added. Historical saved arrays are preserved. |
| A3 Own Help exclusion | COMPLETED within current client data layer | `lib/feed.ts`: own Help excluded from Home, Explore and Help, including historical Solved tab; My Posts retained; normal posts remain eligible. Draft/removed/private unauthorized and blocked authors filtered. |
| A4 Mark as Solved | COMPLETED | Removed creation button and unused store action; management closes posts normally. Historical Solved records remain readable. |
| B1 timestamps | PARTIALLY COMPLETED | `lib/date-time.ts`, `lib/feed.ts`, `components/AppStoreProvider.tsx`: immutable original UTC creation on edits, stable historical dates, invalid calendar rejection, offsetless ISO interpreted as UTC, unknown legacy strings retained and displayed as unavailable. Browser-local display supports IST. New timestamps use the browser clock because no authenticated post backend exists. |
| B2 location ranking | PARTIALLY COMPLETED | `lib/feed.ts`, `lib/nearby-ranking.ts`, `lib/location.ts`, `components/useFeedLocation.ts`: validated coordinate pairs, Haversine distances, deterministic recency/ID ties; GPS refresh on discovery mount only when permission already granted; retain saved/manual location on denial. No fixed city/locality map. Missing coordinates use same-locality/same-city fallback, otherwise recency. Manual names cannot establish distances between different neighbourhoods without geocoding data. Exact distance ordering is verified only with coordinates. |
| B3 sort/filter | COMPLETED for current dataset | `components/FeedSortControl.tsx`: Nearby default, Newest, Oldest, Farthest on Home/Explore, wired to category/search dataset. Measured distances rank before fallback locations in either distance mode. No existing pagination backend/infinite scroll; all matching posts render, replacing Explore's silent three-result cap. Query helper sorts before any downstream slicing. |
| B4 search | COMPLETED | `lib/feed.ts`, `components/SearchBar.tsx`: title, description, category, location/landmark partial case-insensitive trimmed search, clear button, accessible label, empty state, selected sort retained. Local filtering makes no search requests, so no debounce is necessary. |
| C Explore | COMPLETED | Removed Business/Events categories and Explore business promotion; Business features/routes elsewhere unchanged. Unified post results include matching Help; recommended neighbours retained. |
| D1 send | PARTIALLY COMPLETED | `components/AppStoreProvider.tsx`, `components/ChatWindow.tsx`: validate membership/status, non-empty text, coordinate ranges, pair blocks; latest local state used for critical actions; storage write before success, failed sends keep draft, Enter-to-send, chronological history, no duplicate IDs. No network message backend exists. |
| D2 receive/history | PARTIALLY COMPLETED | `lib/chat-rules.ts`, `components/ChatList.tsx`: chronological deduplication, latest message, same-origin tab storage sync, per-participant unread/read state, auto-scroll and reload persistence. Same-origin tab reply tested; different devices/browsers are not connected. |
| D3 blocking | PARTIALLY COMPLETED | Blocks apply to both directions and alternate threads with the same participant pair, only blocker unblocks, persisted history preserved. Membership checks repeated in actions and UI. Local restrictions cannot enforce backend access controls; truly concurrent cross-tab writes are not transactional. |
| D4 reporting | PARTIALLY COMPLETED | Valid actor, target, membership and reason; duplicate open report suppression; actual local record includes reporter and reported participant IDs; success only after local save. Reports sync across same-origin tabs and appear in this browser's admin workflow. UI explicitly states local-only storage; no remote moderation database exists. |
| D5 other chat | PARTIALLY COMPLETED | Correct requested conversation selection, participant checks in list/window, rapid repeated thread creation uses current state, invalid starts return no fake chat ID; draft resets on conversation change, read tracking and mobile grid overflow fixed. Server privacy and cross-account data isolation remain architectural limitations. |

## Tests and verification

Run from the repository root:

```sh
npm ci --no-audit --no-fund
node --test tests/feed-chat.test.cjs
npx tsc --noEmit --incremental false
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build
```

No production dependency was introduced for testing. The Node test harness uses the project's existing TypeScript compiler in memory. `tests/browser.cjs` is an optional Playwright harness using the cloud machine's existing Playwright and `/usr/bin/chromium`; override `CHROMIUM_PATH` or `TEST_BASE_URL` as needed. Local machines need Playwright accessible to Node and a Chromium executable. Start `npm run dev -- --hostname 127.0.0.1`, then run:

```sh
node tests/browser.cjs
TEST_DESKTOP=1 node tests/browser.cjs
```

The browser harness seeds synthetic data in an isolated browser context, not the developer's normal localStorage. It checks keyword and location search, sort selection, own Help exclusion, personal access, removed Explore categories, reload persistence, same-origin peer reply, block/unblock, report persistence, failed-write draft retention, runtime errors and horizontal overflow. The helper suite covers timestamps, IST, distances, invalid/missing locations, changed location, stable sort, visibility, searches, history and unread rules. There is no existing server/database integration suite to run.

External GPS hardware/permission dialogs, reverse-geocoder availability, real Razorpay and different-device messaging are unverified. Frontend unit tests do not prove server authorization. Browser test timing waits for hydration/content rather than treating the pre-hydration shell as loaded data.

### Observed final results

- `npm test`: **23 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed with the two pre-existing `app/page.tsx` warnings only.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: passed; all 35 static pages generated.
- Browser harness against the development server: passed at 390×844 mobile and 1440×1000 desktop, with no runtime errors or horizontal overflow.
- Browser harness against `npm run start` on port 3001: passed at mobile size.
- No external service/database tests are claimed; limitations are listed above.

## Additional confirmed issues for future work

| Priority | Issue / evidence | Affected file | Suggested fix | Difficulty |
| --- | --- | --- | --- | --- |
| High | Resident passwords and shared account/application records are stored in localStorage. Local auth flags are editable and do not provide server authorization or cross-account isolation. | `lib/resident-auth.ts`, `components/AppStoreProvider.tsx`, `components/screens/AuthScreens.tsx` | Introduce server sessions, hashed credentials and owner-scoped database policies. Treat this as a demo until then. | Complex |
| High | Chat/post/report records cannot synchronize across devices; concurrent localStorage writes can still overwrite one another. Admin moderation operates on the current browser's data. | `components/AppStoreProvider.tsx`, `components/screens/AdminScreens.tsx` | Shared transactional datastore with authenticated message/report endpoints, membership checks, delivery acknowledgements and server timestamps. | Complex |
| High | Payment order amount is accepted from the request; order creation has no authenticated business ownership check. Missing keys intentionally enable mock verification. | `app/api/razorpay/create-order/route.ts`, `app/api/razorpay/verify-payment/route.ts` | Derive amounts from server plans, authenticate ownership, persist/verify paid orders and explicitly separate mock deployment mode. Do not deploy as a real payment service. | Complex |
| Medium | Several post management actions rely on the screen selecting an owned post, rather than independently checking ownership in every store action. Client checks would still not be a security boundary. | `components/AppStoreProvider.tsx`: delete/close/reject actions | Validate actors on each action and ultimately enforce ownership server-side. Creation and edit guards were improved in this change. | Moderate |
| Medium | Chat participant normalization may infer membership from message sender IDs and related posts. This must not become a server authorization rule. | `lib/chat-participants.ts` | Persist explicitly authorized membership on a server and validate any legacy migration separately. | Moderate |
| Medium | A shared post link adds `?post=...`, but Home does not select/focus that post. | `components/PostCard.tsx`, `components/screens/ResidentScreens.tsx` | Add an authorized post-detail route or handle the post query in Home with a missing/private state. | Moderate |
| Low | Two existing unused declarations cause lint warnings. | `app/page.tsx`: `BadgeCheck`, `PhonePreviewCard` | Remove unused declarations in a separate cleanup. | Easy |

These are confirmed by source inspection. Unverified concerns (external APIs, real device GPS, real payment integrations) are not described as reproduced bugs. The client-only architecture makes secure backend enforcement impossible without a new backend; these limits are intentionally not hidden behind passing frontend checks.

## Database and data preservation

No tables, indexes or destructive migrations were created. `Chat.readAtByParticipant` and `Report.reportedUserIds` are optional additive local record fields. Existing posts, chats, messages, historical solved status and saved arrays remain. Valid absolute creation dates are normalized to the same instant; unrecoverable relative strings are retained rather than dated today. Missing post locations remain unknown rather than inheriting the current viewer's position. A future backend should add immutable server `created_at`, validated post coordinates, geospatial indexes, authorized filtering and cursor pagination.

## Delivery

Branch: `feature/szocial-feed-search-chat-fixes`, based on `cc0cd335b21641806e3b82621878ca79d2814133` (confirmed main tip at start).

Implementation commit: `344e949` (Improve nearby discovery, help feeds, timestamps and local chat reliability).

The branch was successfully pushed to `origin/feature/szocial-feed-search-chat-fixes`. PR creation was attempted with `gh pr create --base main --head feature/szocial-feed-search-chat-fixes` and a complete description. GitHub returned `Post https://api.github.com/graphql: Forbidden`. Therefore **no pull request was created**; API access needs to be enabled before that operation can succeed. Git transport access works, so a new Git token is not being requested.

Manual PR creation link: https://github.com/vishv-tech/Szocial/pull/new/feature/szocial-feed-search-chat-fixes

The suggested PR description is saved in `docs/pull-request.md`. After GitHub API access is available, run:

```sh
gh pr create --base main --head feature/szocial-feed-search-chat-fixes --title "Improve nearby discovery, Help feeds and local chat reliability" --body-file docs/pull-request.md
```

No merge or force-push was performed. Local frontend testing is supported; production multiuser readiness is not claimed.
