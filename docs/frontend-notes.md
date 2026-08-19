# Frontend Notes (Angular)

A record of what actually happened building `web/`, not a framework comparison — there's only one frontend in this project. Written after the frontend/backend integration pass and Week 4 Day 1's loading/error-state hardening.

## How it actually got built

The Angular app was built ahead of the plan's own schedule, by a separate concurrent session, before the Week 2/3 backend endpoints it calls even existed yet. It's a complete app — login, register, consultant discovery with filter/search, a slot picker, booking, a bookings list with cancel, plus a consultant's own profile/schedule editors and an admin specialties panel — but it had never been run against the real API before the integration pass, since the real API didn't exist yet when most of it was written.

## The one bug that made every page look broken

This project's Angular scaffold has **no `zone.js` anywhere** — Angular 21 defaults new projects to zoneless, and `zone.js` was never added to `package.json` or `angular.json`'s polyfills. Every page component was written the classic way: mutate a plain property (`this.isLoading = false`) inside an RxJS `.subscribe()` callback. That pattern only triggers a re-render with `zone.js` patching async APIs underneath it — without it, the HTTP call genuinely succeeds, the component's fields genuinely update, and the screen never repaints to show it. Every single page looked like it hung forever loading, for the same reason, and it had nothing to do with the API at all.

The fix was `npm install zone.js` plus `provideZoneChangeDetection()` in `app.config.ts` — a few lines, versus rewriting eight-plus components to signals (the alternative, and the "correct" long-term direction per this project's own `web/AGENTS.md`, which already says to use signals). Zoneless-by-default is a real, sharp edge for anyone dropping classic Angular patterns into a fresh `ng new` scaffold without checking what got included.

## Contract mismatches only a browser caught

See the backend note's section on this — the specific bugs (paginated list envelope, availability response shape, the specialties junction-row shape) are documented there. The frontend-side lesson: every one of them passed `tsc` cleanly. `ng build` succeeding is not evidence a page works.

## Known gaps, left as-is rather than expanded scope

- **Style consistency**: the existing components don't follow `web/AGENTS.md`'s own stated conventions — constructor injection instead of `inject()`, plain class properties instead of signals, `FormsModule`/`ngModel` instead of reactive forms, no `OnPush`. Fixing the *behavior* (real API shapes, then loading/error states) was in scope; rewriting the architecture to match the style guide was not, and would be a much larger, separate pass.
- **No frontend test coverage**: only the default `app.spec.ts` scaffold test exists. The backend now has a real business-rule test suite (Week 4 Day 2); the frontend has none of its own.
- **Native `confirm()` dialogs**: the cancel-appointment and delete-specialty actions use the browser's native `confirm()`. It works, but it's untestable via most automation and froze a browser automation session once during manual verification (recovered by closing the tab) - worth swapping for an in-app confirmation component if this were going further.
