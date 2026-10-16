# Walking Skeleton — FinAlly (AI Trading Workstation)

**Phase:** 1
**Generated:** 2026-10-16

## Capability Proven End-to-End

A student builds the image with the existing `Dockerfile`, runs it, and opens `http://localhost:8000` to see the dark FinAlly terminal shell, whose header shows the real `$10,000.00` cash balance and total value read from SQLite through `GET /api/portfolio`, while `GET /api/health` still answers from the same container.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.4.2 App Router, React 19.3.1, TypeScript 7.0.2, one route (`src/app/page.tsx`) | Fixed by `planning/PLAN.md`; TS 7 locked in STATE.md (no ESLint, since typescript-eslint does not support TS 7) |
| Build output | Static export (`output: "export"`) only when `NODE_ENV !== "development"`; `images.unoptimized`, `compress: false`, `agentRules: false` | One container, one port, no Node at runtime; export forbids rewrites, so they exist only in dev |
| Serving | Existing FastAPI `StaticFiles(directory=STATIC_DIR, html=True)` mounted at `/` after all routers; Dockerfile copies `frontend/out` to `/app/static` | Backend and Dockerfile are unchanged; `/api/*` routes always win over the static mount |
| Data layer | Existing FastAPI + SQLite backend; the browser reads it with same-origin relative `fetch` through one `request<T>()` wrapper (`src/lib/api.ts`) that turns `{"error": ...}` bodies into `ApiError` | Same origin by construction, no CORS, no absolute URLs or public env vars |
| Auth | None (single user `"default"`) | PLAN.md: no login, no signup |
| Styling | Tailwind 4.3.3 CSS-first via `@tailwindcss/postcss`; palette as `@theme static` tokens in `src/app/globals.css` (`surface #0d1117`, `panel #1a1a2e`, `line`, `text`, `muted`, `accent #ecad0a`, `primary #209dd7`, `submit #753991`, `up`, `down`); system font stacks | `static` keeps every token variable in the built CSS so Recharts `var(--color-…)` strokes work in later phases; system fonts keep `docker build` free of font downloads |
| Charts | Recharts 3.10.1 only (installed in Phase 1, first rendered by the harness smoke test) | PLAN.md "Recharts only" |
| UI contract | `src/lib/testIds.ts` is the single source of every Playwright `data-testid`, guarded by a parity test against `test/tests/*.spec.ts`; `src/lib/format.ts` renders bare `en-US` figures the specs' `parseNumber` reads back exactly | Keeps every later phase aligned with the existing E2E suite |
| Unit testing | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1 on jsdom 30.1.3; `vitest.setup.ts` stubs `ResizeObserver` (fixed 800x400), `EventSource` (controllable `FakeEventSource`) and `scrollIntoView` | jsdom lacks all three; later phases (price stream, charts, chat scroll) depend on them |
| Dev loop | `next dev` (port 3000, or `-p 3100` when 3000 is busy) rewrites `/api/:path*` to `http://localhost:8000/api/:path*`; backend runs with `uv run uvicorn app.main:app --port 8000` | Same relative URLs in dev and prod; `compress: false` keeps SSE unbuffered |
| Deployment target | Single Docker container on port 8000 (fresh tag `finally-phase1` for verification); start scripts are Phase 6 | PLAN.md section 11 |
| Directory layout | `frontend/src/app` (layout, page, globals.css), `frontend/src/components` (one component per file), `frontend/src/lib` (pure TS contracts), `frontend/src/test` (harness tests); tests sit beside their module as `*.test.ts(x)` | `frontend/.gitignore` re-includes `/src/lib/`, which the root Python `.gitignore` rule `lib/` would otherwise hide (this is how the previous frontend lost its `src/lib`) |
| Supply chain | Exact version pins, committed `package-lock.json` generated in a clean `frontend/`, `npm ci` in Docker, one blocking human legitimacy check before the first install | RESEARCH.md Package Legitimacy Audit |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js, TypeScript 7, Tailwind 4, Vitest + RTL; no linter by decision, `next build` + `tsc --noEmit` are the static checks)
- [x] Routing: one real route `/` served as `out/index.html`
- [x] Database: real read (`GET /api/portfolio`, SQLite `users_profile` + `positions`). Real writes in Phase 1 are the backend's own lazy init + seed and its 30 s snapshot task; the first UI-originated writes arrive with watchlist add/remove (Phase 3) and trades (Phase 4)
- [ ] UI interactive element wired to the API: arrives in Phase 3 (watchlist add/remove). Phase 1 wires the on-mount header read only, per the FND-01..06 scope
- [x] Deployment: the Docker container serves UI and API on port 8000; dev loop documented in `README.md`

## Out of Scope (Deferred to Later Slices)

- SSE price store, watchlist rows, price flashes, sparklines, live connection status and live header revaluation (Phase 3)
- Ticker selection, main chart, trade bar, positions table, heatmap, P&L chart (Phase 4)
- Chat panel behavior, action rendering, quick prompts (Phase 5)
- Start-script changes, full Playwright gate (Phase 6)
- Backend hardening (Phase 2); ESLint; Docker hardening; cloud deploy; root repo cleanup

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Backend hardening, chat and watchlist APIs fail cleanly (independent of the frontend)
- Phase 3: One `EventSource` price store drives watchlist rows, flashes, sparklines, the connection dot and live header totals
- Phase 4: Ticker selection, main chart, trade bar, positions table, heatmap and P&L chart
- Phase 5: Docked AI chat panel with inline action results and post-action refresh
- Phase 6: One start script launches the app and the full Playwright suite passes with `LLM_MOCK=true`
