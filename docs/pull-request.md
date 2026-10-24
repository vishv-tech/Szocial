## Changes

Home and Explore now share functional location/keyword search and Nearby, Newest, Oldest and Farthest sorting. Help discovery excludes the viewer's own requests, Offer Help and Mark as Solved controls are removed, and Explore no longer lists Business/Events categories. Valid original timestamps are retained; unrecoverable legacy dates no longer become today's date.

Local chat fixes cover pair-wide blocks, membership checks, duplicate/history ordering, current-state thread creation, requested conversation selection, per-participant unread state, reload persistence, same-origin tab replies, draft retention on failed writes, locally persisted reports and mobile overflow.

## Validation

- 23 regression tests pass (`npm test`).
- TypeScript, lint and production build pass; lint has only two existing landing-page warnings.
- Playwright mobile and desktop discovery/chat checks pass; mobile checks also pass against the production server.

## Scope and limitations

The application has no resident-authenticated backend or shared database. Server timestamps, cross-device messaging, secure backend blocking/privacy and remote reports remain incomplete. Existing posts without coordinates use locality-name fallback rather than invented distances. Reports explicitly state they are saved only in this browser. No database migrations, destructive data changes or new dependencies.

See `docs/feed-chat-delivery.md` for task-by-task status, test details and confirmed audit findings. This is ready for frontend/demo testing, not a claim of production multiuser readiness.
