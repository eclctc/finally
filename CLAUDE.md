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

Phase 4 and 5 UI contracts: APPROVED (`04-trading-portfolio/04-UI-SPEC.md`, `05-ai-chat/05-UI-SPEC.md`). User-confirmed: first watchlist ticker selected by default; main chart keeps 1,200 timestamped points (10 min), sparkline shows last 300; quick-prompt chips send immediately; AI-change highlight is blue, 1.5s hold + 1s fade. Phase 4 has no row highlight and no Panel change; Phase 5 adds the Panel `actions` prop and `data-ai-changed` on watchlist/position rows. Heatmap Treemap `<rect>` spike is a blocking first task of the heatmap plan. UI-consideration probe extras are backstopped (user's Phase 3 rule).

Next steps: `/gsd-plan-phase 4` (Trading & Portfolio). Phase 4 must lift `usePortfolio()` (currently only in Header) to Dashboard with `refresh()`/`refreshHistory()` so trades (and Phase 5 chat) refresh the header. Plan Phase 5 after Phase 4's plans are fixed. Optional: `/gsd-code-review 01 --fix` / `02 --fix`, `/gsd-validate-phase 2`, `/gsd-map-codebase --paths README.md,backend` (map is stale).

Environment notes: the root `.gitignore` has a Python `lib/` rule, overridden by `!/src/lib/` in `frontend/.gitignore`. The shell `grep` may be ugrep; use `/usr/bin/grep` for GNU flags. Run post-merge checks with `npm --prefix frontend test|run typecheck|run build` and `cd backend && uv run pytest`, not the auto-detected root `pyproject.toml`.

@planning/PLAN.md