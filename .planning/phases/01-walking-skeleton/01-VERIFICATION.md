---
phase: 01-walking-skeleton
verified: 2026-10-16T15:35:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/01-walking-skeleton/01-01-PLAN.md
  - .planning/phases/01-walking-skeleton/01-01-SUMMARY.md
  - .planning/phases/01-walking-skeleton/01-02-PLAN.md
  - .planning/phases/01-walking-skeleton/01-02-SUMMARY.md
  - .planning/phases/01-walking-skeleton/01-03-PLAN.md
  - .planning/phases/01-walking-skeleton/01-03-SUMMARY.md
  - .planning/phases/01-walking-skeleton/01-04-PLAN.md
  - .planning/phases/01-walking-skeleton/01-04-SUMMARY.md
  - README.md
  - frontend/next.config.ts
  - frontend/package.json
  - frontend/src/app/globals.css
  - frontend/src/components/Dashboard.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/Panel.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/format.ts
  - frontend/src/lib/testIds.ts
  - frontend/vitest.setup.ts
covered_digest: "v3:sha256:0901a29c2f89f72bdc00e76522cc956e7651e6e511a9c9fb56662b810bae1b83"
behavior_unverified: 0
overrides_applied: 0
gaps: []
human_verification:
  - test: "Open http://localhost:8000 (container finally-p1, fresh DB) in a desktop browser. Confirm: dark #0d1117 / #1a1a2e look with muted gray borders and no pure black; header shows Fin + yellow Ally, Portfolio value $10,000.00 in yellow, Cash $10,000.00, red connection dot; titled panels Watchlist, Chart, Trade, Heatmap, P&L, Positions and an AI Chat column on the right; at about 1024 px wide the layout fits without overlap."
    expected: "Dark FinAlly shell renders as described with the live $10,000.00 figures replacing the initial `--`."
    why_human: "Plan 01-03 Task 2 human-check. Visual appearance and layout fit cannot be proven by grep or curl; no agent has opened a browser."
  - test: "In the same browser session open DevTools Network and reload."
    expected: "Only same-origin requests (no font, script, style or analytics hosts), plus the single GET /api/portfolio."
    why_human: "Judgment-tier prohibition 'no third-party origins' (01-01). Source and built output grep clean (see below), but this is a non-authoritative LLM-judge result: unverified-prohibition, human review recommended."
  - test: "Judgment-tier prohibition 'no pure black in theme or shell' (01-01)."
    expected: "No pure black visible; backgrounds on #0d1117 / #1a1a2e."
    why_human: "Non-authoritative LLM-judge result (grep for #000 / bg-black in frontend/src is clean; theme tokens use #0d1117 / #1a1a2e). Flagged unverified-prohibition, confirm visually with the check above."
---

# Phase 1: Walking Skeleton Verification Report

**Phase Goal:** As a student, I want to run the container and see the dark FinAlly shell at localhost:8000, so that the app ships end to end.
**Verified:** 2026-10-16T15:35:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

All automated evidence supports the goal. The only open items are the browser visual check that Plan 01-03 deferred to a human and two judgment-tier prohibitions. No gaps, no blockers.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docker build` succeeds with the existing Dockerfile; the running container serves a dark-themed dashboard shell with a header at `:8000/` while `/api/health` responds | VERIFIED (visual part human) | `git diff e4f6e9b HEAD -- Dockerfile backend` is empty (Dockerfile and backend unchanged since before the phase). Container `finally-p1` (image `finally-phase1`, created 15:17:56Z, 10 s after the last frontend commit 9ffb493 at 15:17:46Z) is `healthy`. `curl /api/health` returns `{"status":"ok",...}`; `curl /` returns `<title>FinAlly</title>` with testids `cash-balance`, `total-value`, `connection-status`, `watchlist`, `heatmap`, `pnl-chart`, `positions-table`, `chat-panel`; served CSS `3uyqo-bkhf0u-.css` is the same hashed file my fresh local build produced and contains `.bg-surface`, `.bg-panel`, `.border-line`, `.text-accent`, `.text-muted`, `.text-down`. `/api/portfolio` returns `cash_balance: 10000.0`. Rendered appearance: see Human Verification. |
| 2 | `npm run build` in `frontend/` produces a static export in `out/`; lockfile and `frontend/.gitignore` committed | VERIFIED | I ran `npm --prefix frontend run build`: exit 0, routes `/` and `/_not-found` prerendered, `out/index.html` has `<title>FinAlly</title>`. `git ls-files frontend` lists `package.json`, `package-lock.json`, `.gitignore`, all of `src/lib/*`. `git check-ignore -q frontend/src/lib/format.ts` exits 1 (not ignored). `next.config.ts`: `output: isDev ? undefined : "export"`. Dockerfile stage 1 uses `npm ci` from the lockfile. |
| 3 | `npm test` runs the Vitest + RTL harness green; a component using `ResizeObserver`, `EventSource` or `scrollIntoView` renders under jsdom | VERIFIED | I ran `npm --prefix frontend test`: 6 files, 35/35 passed. `vitest.setup.ts` installs `FixedSizeResizeObserver`, `FakeEventSource` (open/emit/fail/close, readyState transitions), and a `scrollIntoView` mock. `src/test/harness.test.tsx` mounts a probe using all three plus Recharts `ResponsiveContainer` and asserts an `<svg>` renders. |
| 4 | `next dev` serves the shell with `/api/*` proxied to `:8000`, SSE frames arrive unbuffered | VERIFIED | I started `next dev -p 3101` against the running container: `/` returns `<title>FinAlly</title>`, `/api/health` returns 200 through the proxy, and `curl -N --max-time 8 /api/stream/prices` received 16 `data:` frames in 8 s (about 2 per second, consistent with the 500 ms cadence, so not buffered). Dev server stopped, port 3101 free, `git status` clean of runtime files, no `frontend/AGENTS.md`. `next.config.ts` has dev-only rewrite and `compress: false`. README lines 32 and 38 document `npm run build` and `npm run dev` (with `-p 3100` hint). The 40 s variant in Plan 01-04's summary was not re-run (8 s sample here). |
| 5 | Theme colors usable as Tailwind tokens; every E2E testid and number formatter comes from one shared module | VERIFIED | `globals.css` has one `@theme static` block declaring `--color-surface #0d1117`, `--color-panel #1a1a2e`, `--color-line #30363d`, `--color-accent #ecad0a`, `--color-primary #209dd7`, `--color-submit #753991`, each required hex exactly once (also exactly once in served CSS). `testIds.ts` is the single module of 22 static ids plus 4 per-ticker helpers; `testIds.test.ts` (parity against `test/tests/*.spec.ts`) passes. `Header.tsx`/`Dashboard.tsx` set every `data-testid` from `testIds` (no literals). `format.ts` produces bare en-US figures (`$10,000.00`) that `Header.test.tsx` shows `parseNumber` reads back as 10000. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Plan-level must-haves (spot reconciliation)

| Truth | Status | Evidence |
|-------|--------|----------|
| 01-01: single `@theme static`, each hex once; build deterministic | VERIFIED | Counts of each hex in served CSS: 1. Fresh local rebuild yields the same CSS chunk name as the image built earlier, evidencing determinism. Dockerfile uses `npm ci` and `uv sync --frozen`, so the two `backstop` concurrency truths (interrupted rebuild is safe; static tokens have no runtime state) hold by mechanism. |
| 01-02: formatter/api behavior, no `watchlist-row-` collisions | VERIFIED | `format.test.ts`, `api.test.ts`, `testIds.test.ts` pass inside the 35/35 run. |
| 01-03: Header shows `--` then `$10,000.00`; no `watchlist-row-*`/`main-chart` in Phase 1 markup | VERIFIED | `Header.tsx` single mount `request("/api/portfolio")`; 7 Header tests and 4 Dashboard tests pass; served HTML contains no `watchlist-row-` or `main-chart` ids. |
| 01-04: dev proxy + README | VERIFIED | See SC 4. |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/package.json`, `package-lock.json`, `.gitignore` | VERIFIED | Tracked; exact-pinned deps; `!/src/lib/` re-include present |
| `frontend/next.config.ts`, `postcss.config.mjs`, `tsconfig.json` | VERIFIED | Present and used by successful build/typecheck |
| `frontend/src/app/{globals.css,layout.tsx,page.tsx}` | VERIFIED | `page.tsx` renders `<Dashboard />`; layout sets FinAlly metadata |
| `frontend/vitest.config.mts`, `vitest.setup.ts`, `src/test/harness.test.tsx` | VERIFIED | Substantive, exercised by passing suite |
| `frontend/src/lib/{testIds,format,api}.ts` + tests | VERIFIED | Substantive, imported by components |
| `frontend/src/components/{Header,Panel,Dashboard}.tsx` + tests | VERIFIED | Wired: page -> Dashboard -> Header/Panel; Header -> request/formatCurrency/testIds |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| Dockerfile stage 1 | `frontend/package.json` | `npm ci`, `npm run build`, `COPY --from=frontend /frontend/out ./static` | WIRED (container serves the export) |
| `next.config.ts` | backend :8000 | dev-only `/api/:path*` rewrite | WIRED (exercised live, health 200 + SSE frames) |
| `Header.tsx` | `GET /api/portfolio` | `request<PortfolioSummary>("/api/portfolio")` in `useEffect` | WIRED |
| `Header.tsx` | `format.ts` | `formatCurrency` via `show()` | WIRED |
| `page.tsx` | `Dashboard.tsx` | `<Dashboard />` | WIRED |
| `testIds.test.ts` | `test/tests/*.spec.ts` | fs read and id extraction | WIRED (test passes) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Real Data | Status |
|----------|---------------|--------|-----------|--------|
| `Header.tsx` | `portfolio.cash_balance` / `total_value` | `fetch /api/portfolio` -> FastAPI -> SQLite | Yes, live endpoint returns `10000.0` | FLOWING |
| `Panel` bodies (Watchlist, Chart, ...) | none | Intentionally empty placeholders | N/A | Expected for Phase 1 (filled in Phases 3-5) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend unit suite | `npm --prefix frontend test` | 35/35, 6 files | PASS |
| Typecheck | `npm --prefix frontend run typecheck` | exit 0 | PASS |
| Static export | `npm --prefix frontend run build` | exit 0, `out/index.html` title FinAlly | PASS |
| Backend suite | `cd backend && uv run pytest -q` | 103 passed | PASS |
| Container health | `curl localhost:8000/api/health` | `status: ok` | PASS |
| Container portfolio | `curl localhost:8000/api/portfolio` | `cash_balance 10000.0` | PASS |
| Dev proxy | `next dev -p 3101` then health + 8 s SSE | 200; 16 data frames | PASS |

### Probe Execution

SKIPPED: no probes declared by this phase's plans.

### Requirements Coverage

All six IDs appear in PLAN frontmatter and ROADMAP; REQUIREMENTS.md maps FND-01..FND-06 to Phase 1 only. No orphans.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| FND-01 | 01-01 | Next 16 + TS 7 + Tailwind 4, static export in `out/`, lockfile and .gitignore committed | SATISFIED | package.json pins next 16.4.2, typescript 7.0.2, tailwindcss 4.3.3; build exit 0; files tracked |
| FND-02 | 01-01, 01-03 | docker build succeeds; container serves UI at :8000; `/api/health` responds | SATISFIED (visual human) | Image built from unchanged Dockerfile; live container serves shell and health ok |
| FND-03 | 01-01, 01-03 | Dark theme as Tailwind tokens | SATISFIED | `@theme static` palette; token utilities present in served CSS; shell uses them. `submit` purple token defined, not yet used (no submit buttons exist in Phase 1) |
| FND-04 | 01-02 | Vitest + RTL harness with ResizeObserver, EventSource, scrollIntoView stubs | SATISFIED | vitest.setup.ts + harness test pass |
| FND-05 | 01-02, 01-03 | Single testid module; bare-number formatters | SATISFIED | testIds.ts, format.ts, parity test, Header figures |
| FND-06 | 01-01, 01-04 | `next dev` proxies /api to :8000 without buffering SSE; export only for production | SATISFIED | next.config.ts; live proxy check; README |

Note: REQUIREMENTS.md still shows these six as `- [ ]` / "Pending" in the checklist and traceability table. Those need updating by the orchestrator once the human check is accepted; this is bookkeeping, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase files) | - | TBD/FIXME/XXX scan | none found | - |
| `frontend/src/components/Dashboard.tsx` | - | Empty `Panel` bodies | Info | Intentional skeleton placeholders; not wired to anything user-visible beyond titles |
| `frontend/src/components/Header.tsx` | 56-62 | Connection dot hard-coded `disconnected` | Info | Documented Phase 1 choice; LIVE-02 in Phase 3 |
| `frontend/src/lib/format.ts` | 5 | WR-01 double rounding (advisory from 01-REVIEW) | Warning | Edge-case tie rounding (`1.005` -> `1.00`); locked in by tests; does not affect the phase goal |
| `frontend/src/components/Header.tsx` | 56 | WR-02 `aria-label` on role-less span | Warning | Accessibility only |
| `frontend/src/lib/testIds.test.ts` | 40-44 | WR-03 parity check can pass vacuously for empty template prefix | Warning | Guard weakness; real parity currently holds |

No blockers. The three review warnings are open per 01-REVIEW-DISPOSITION.md and advisory.

### Human Verification Required

#### 1. Browser check of the dark shell

**Test:** Open http://localhost:8000 (container `finally-p1`, fresh DB) in a desktop browser; confirm dark `#0d1117` / `#1a1a2e` surfaces with muted gray borders, header with Fin + yellow Ally, "Portfolio value" `$10,000.00` in yellow, "Cash" `$10,000.00`, red connection dot, panels Watchlist, Chart, Trade, Heatmap, P&L, Positions, AI Chat column; layout fits at about 1024 px.
**Expected:** Shell renders as described; figures change from `--` to `$10,000.00`.
**Why human:** Visual appearance and layout; Plan 01-03 Task 2 human-check, performed by no agent.

#### 2. Same-origin network check (prohibition, judgment tier)

**Test:** DevTools Network, reload.
**Expected:** Only same-origin requests.
**Why human:** Prohibition is judgment tier; grep of source, built CSS and served HTML found no external origins or font loading, but the verdict is a non-authoritative LLM-judge result (unverified-prohibition, human review recommended).

#### 3. No pure black (prohibition, judgment tier)

**Test:** Visual confirmation within check 1.
**Expected:** No `#000` surfaces.
**Why human:** Same reason; grep for `#000`/`bg-black` in `frontend/src` is clean.

### Gaps Summary

No gaps. Every roadmap success criterion and every requirement FND-01..FND-06 has direct code or runtime evidence. The phase is held at `human_needed` only because the planned browser visual check was never performed and two judgment-tier prohibitions need human sign-off. The `finally-p1` container is still running for that check (stop with `docker stop finally-p1` afterwards).

---

_Verified: 2026-10-16T15:35:00Z_
_Verifier: Claude (gsd-verifier)_
