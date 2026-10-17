# FinAlly Project - the Finance Ally

All project documentation is in the `planning` directory.

The key document is PLAN.md included in full below; the market data component has been completed and is summarized in the file `planning/MARKET_DATA_SUMMARY.md` with more details in the `planning/archive` folder. Consult these docs only when required. The remainder of the platform is still to be developed.

## Progress (GSD workflow, branch `finally-gsd`)

The build is run through GSD. Planning artifacts live in `.planning/` (PROJECT.md, REQUIREMENTS.md with 41 v1 requirements, ROADMAP.md with 6 phases, STATE.md, research/, phases/).

- Backend (`backend/`) is complete and hardened in Phase 2 (145 pytest tests pass).
- Frontend (`frontend/`) is being built fresh. The old frontend at commit `5681c3a` is reference only.
- Key decisions: TypeScript 7 with no ESLint; chat history session-only; P&L history downsampled on the client; no cloud deploy, Docker hardening or root repo cleanup.

Roadmap: 1 Walking Skeleton, 2 Backend Hardening, 3 Live Watchlist & Header, 4 Trading & Portfolio, 5 AI Chat, 6 Ship & E2E Gate.

Phase 1 (Walking Skeleton) status: COMPLETE (UAT 3/3 passed, security 12/12 threats closed, UI review 20/24).
- Next.js 16 static export with Tailwind 4 `@theme static` dark tokens, built by the unchanged Dockerfile (image `finally-phase1`, container `finally-p1` on :8000).
- Vitest + RTL harness (35 tests), shared `testIds.ts`, `format.ts`, `api.ts`; Header reads `/api/portfolio`; 7-panel terminal layout.
- `next dev` proxies `/api/*` to :8000 with unbuffered SSE (port 3000 is busy locally; use `-p 3100`).
- UI design contract approved: `.planning/phases/01-walking-skeleton/01-UI-SPEC.md`.
- Verifier: 5/5 must-haves, status `human_needed`. Three manual checks are in `01-UAT.md` (browser look at :8000, same-origin requests, no pure black).
- Code review: 0 critical, 3 warnings (WR-01 rounding in `format.ts`, WR-02 connection dot a11y, WR-03 testid parity test can pass vacuously), 5 info; all open.

Phase 2 (Backend Hardening) status: COMPLETE (6 plans incl. gap closure 02-06; verification 5/5 passed; security 16/16 threats closed). LLM failures return fixed 502s (incl. non-finite quantities), duplicate watchlist adds are idempotent, each chat action is a savepoint unit with a 5-per-kind cap, session open survives re-add, history/chat queries are indexed. Open non-blocking review advisories: WR-01..WR-03, IN-01..IN-03 (`.planning/phases/02-backend-hardening/02-REVIEW-DISPOSITION.md`).

Phase 3 (Live Watchlist & Header) status: COMPLETE (5 plans; UAT 4/4; verification passed; security 16/16 closed; Playwright fresh-start/sse-reconnect/add-remove 3/3). One `EventSource` feeds a module-level price store (`frontend/src/lib/priceStore.ts`, `useSyncExternalStore`); watchlist flash/sparklines/add/remove; live header total and connection dot; 1280px minimum width. 138 frontend tests. Open non-blocking review advisories WR-01..WR-04 in `03-REVIEW-DISPOSITION.md`. Test container `finally-p3` (127.0.0.1:8010) may still be running; remove with `docker rm -f finally-p3`.

Phase 4 (Trading & Portfolio) status: COMPLETE (7 plans in 6 waves; UAT 3/3; verification passed; security 21/21 closed; Playwright 9/9 on a fresh DB; backend 145 passed). `Dashboard` owns one `usePortfolio()` (`refresh`, `setPortfolio`) and one `usePortfolioHistory()` (`refresh` as `refreshHistory`), both 30 s polls with stale-response guards returning `Promise<boolean>`; `selectedTicker` lives in `Dashboard` (first ticker by default). Trade bar applies the POST response directly. Main chart (1,200 timestamped points), Treemap heatmap (custom `<rect>` tiles), positions table (`PositionRow.tsx`), P&L chart (300-point downsample, `Start $10,000` baseline, live tail). 281 frontend tests. Review warnings WR-01..WR-05 fixed (`04-REVIEW-FIX.md`: flaky tests made deterministic, lost trade response now refreshes the portfolio, watchlist reload keeps a loaded list and ignores stale reloads); info items IN-01..IN-08 open in `04-REVIEW-DISPOSITION.md`. Gate image `finally-phase4` exists locally; container `finally-p4` was removed.

Phase 5 (AI Chat) status: COMPLETE (6 plans in 4 waves; UAT 5/5; verification passed; security 16/16 closed; Playwright 10/10 on a fresh DB; backend 145 passed). `ChatDock` (`useChat` above the expanded panel and the 40px collapsed rail) posts to `/api/chat`, shows the reply and one chip per action, `Thinking...` while pending, inline 502 errors with the draft kept, and quick-prompt chips. `Dashboard.applyChatActions` clears removed tickers, awaits the lifted `useWatchlist().load`, `refresh` and `refreshHistory` (all `Promise<boolean>`), then marks changed rows in `aiChangeStore` (blue, 1.5 s hold + 1 s fade) only if all three succeed. 374 frontend tests. Open review advisories WR-01..WR-03, IN-01..IN-04 in `05-REVIEW-DISPOSITION.md` (WR-01: a lost chat response refreshes nothing and invites a resend that can re-run trades). Gate image `finally-phase5` exists locally; containers removed.

Next steps: `/gsd-plan-phase 6` (Ship & E2E Gate). Optional: `/gsd-code-review 05 --fix` (WR-01..03), `/gsd-ui-review 5`, `/gsd-validate-phase 5`, `/gsd-map-codebase --paths README.md,backend` (map is stale).

Environment notes: the root `.gitignore` has a Python `lib/` rule, overridden by `!/src/lib/` in `frontend/.gitignore`. The shell `grep` may be ugrep; use `/usr/bin/grep` for GNU flags. Run post-merge checks with `npm --prefix frontend test|run typecheck|run build` and `cd backend && uv run pytest`, not the auto-detected root `pyproject.toml`.

@planning/PLAN.md