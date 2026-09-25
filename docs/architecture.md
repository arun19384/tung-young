# Architecture and operating limits

## Request flow

`watchPosition` → throttled samples (default 4 seconds) → last 12 positions in memory → `POST /api/v1/location/resolve` → Fiber inbound adapter → application service → domain projection / graph routing → JSON → React tracking state.

Each request contains the short sample history needed for confidence and boundary confirmation. Functions do not maintain sessions, so cold starts and instance changes do not reset a trip. Coordinates are never placed in URLs, localStorage, application logs, or a database. API responses use `Cache-Control: no-store`; the service worker only caches build assets and navigation.

The outbound `TransitRepository` port currently reads embedded JSON. Replace that adapter to use a database or external feed without coupling the domain to Fiber or storage.

## Resolution rules

- Validate coordinates, positive accuracy, timestamp order, request size and destination membership.
- Refuse latest fixes older than 20 seconds or over `MAX_GPS_ACCURACY` (100m default).
- Reject positions farther than `MAX_ROUTE_DISTANCE` (300m default) from the selected line.
- Reject implausible jumps beyond 45m/s plus reported uncertainty.
- Require at least three distinct fixes spanning at least four seconds on the same segment; retain the previous UI state during ambiguous transitions.
- Average the last three projected segment positions. Movement across that edge estimates direction. Selecting a destination does not count as evidence of physical motion.
- Compute an on-line path through the station graph. Blue Line BL32–BL01–BL33 is represented explicitly.
- Confirm arrival only with three accurate fixes (at most 50m reported uncertainty) within `STATION_RADIUS` (90m default).
- Do not send notifications for stale, uncertain, paused, offline or wrong-direction states. Deduplicate approaching/arrival alerts within a trip.

## Important limitations

This is a working first release, not a field-validated railway positioning system. The bundled CC0 data covers four lines and 115 station memberships (Siam appears on both BTS lines). Routing includes the principal interchanges among these four lines; Yellow/Pink Lines are not implemented.

Geometry currently consists of chords between station coordinates, not surveyed rail centerlines. The projection algorithm accepts multi-point geometry for future better data. Curves, parallel lines, station exits and underground GPS can produce ambiguous or missing fixes. Proximity to a station cannot prove that someone is aboard a train. Users must choose the line they are actually riding. ETA uses approximately two minutes per remaining station, not an operator timetable or live train feed. Blue Line graph paths do not model platform-level transfer/service patterns at Tha Phra.

Browser geolocation is foreground-oriented. PWA installation does not make continuous GPS possible when the OS suspends the app. Wake Lock is optional and may be rejected or released by the OS. Notifications are triggered by fresh foreground position results; there is no push server and no promise of alerts after closing/locking the app. Always check station announcements as well.

## PWA lifecycle

Vite PWA injects hashed JS/CSS/local fonts and raster icons into the service worker precache. Navigation falls back to the cached shell; `/api` and `/health` are excluded. A newly installed worker waits until older app windows close so an update cannot interrupt a trip. Restart all app windows to apply updates. No remote font dependency is needed offline.

Android Chromium can offer an install prompt. On iOS use Safari → Share → Add to Home Screen. Notification and vibration availability depends on OS and browser. Notification denial falls back to in-app alerts.

## Validation

`go test ./...` covers bidirectional resolution, stale/poor fixes, jumps, confirmation, topology, validation, size limits, JSON responses and Vercel rewrite adaptation. `go vet ./...` checks the backend. `npm test` checks the frontend catalogue contract. `npm run build` type-checks, generates icons, bundles the frontend and precaches assets.

Actual BTS/MRT rides and locked-screen notification behavior require physical-device field testing. Those are not implied by passing simulated coordinate tests.
