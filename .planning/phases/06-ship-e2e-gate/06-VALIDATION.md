---
phase: "6"
slug: "ship-e2e-gate"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 + React Testing Library 16.3.3 (frontend); pytest 9.1.1 (backend); Playwright 1.64.1 (E2E in `test/`) |
| **Config file** | `frontend/vitest.config.mts`, `frontend/vitest.setup.ts`; `backend/pyproject.toml`; `test/playwright.config.ts`; `test/docker-compose.test.yml` |
| **Quick run command** | `npm --prefix frontend test` (doc/script tasks: `bash -n scripts/start_mac.sh && bash -n scripts/stop_mac.sh`) |
| **Full suite command** | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build`, then the fresh-container Playwright gate (10 passed), then `cd backend && uv run pytest -q` (145 passed) |
| **Estimated runtime** | ~3 seconds for Vitest; build ~30 seconds; container gate a few minutes |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched area
- **After every plan wave:** Run `npm --prefix frontend test && npm --prefix frontend run typecheck`
- **Before `/gsd-verify-work`:** Full suite + build green, container gate 10/10 on a fresh DB, backend 145 passed, `SPECS_UNCHANGED` guard empty
- **Max feedback latency:** 30 seconds (excluding the container gate)

---

## Per-Task Verification Map

Filled in by the planner and executors. Requirement-to-test map (from 06-RESEARCH.md):

| Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-------------------|-------------|--------|
| INT-01 price store and merge | unit | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/lib/priceStream.test.ts src/lib/usePrice.test.tsx` | ✅ | ⬜ pending |
| INT-01 flash triggering | component | `npm --prefix frontend test -- src/components/FlashingPrice.test.tsx` | ✅ | ⬜ pending |
| INT-01 watchlist add/remove | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx src/lib/useWatchlist.test.tsx` | ✅ | ⬜ pending |
| INT-01 portfolio revaluation | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/Header.test.tsx src/components/PositionsTable.test.tsx src/lib/pnlSeries.test.ts` | ✅ | ⬜ pending |
| INT-01 chat rendering and loading | component | `npm --prefix frontend test -- src/components/ChatDock.test.tsx src/components/ChatBubble.test.tsx src/lib/chat.test.ts` | ✅ | ⬜ pending |
| INT-02 script build/start/idempotent/stop | scripted integration | `.env`-less git worktree + `FINALLY_IMAGE/CONTAINER/PORT/VOLUME` overrides + `--no-open`, then `curl -sf .../api/health` returns 200 immediately | plan task | ⬜ pending |
| INT-02 syntax | static | `bash -n scripts/start_mac.sh && bash -n scripts/stop_mac.sh` | ✅ | ⬜ pending |
| INT-03 full E2E suite | E2E | fresh `127.0.0.1:8010` container with `--tmpfs /app/db -e LLM_MOCK=true`, then `cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test --reporter=list` | ✅ | ⬜ pending |
| INT-03 compose path | E2E | `npm --prefix test run test:docker` (after exit-code fix) | ✅ (unproven) | ⬜ pending |
| Regression | unit | `cd backend && uv run pytest -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files are needed. Non-test prerequisites: `npm --prefix test ci` / `npm --prefix frontend ci` where `node_modules` is missing (worktrees), and the `test:docker` exit-status fix before relying on the compose path.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser opens to a working app | INT-02 | The agent must not bind host port 8000, stop `finally-p1` or pass `.env` into a container | User runs the script from the main checkout on a free port (e.g. `FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui scripts/start_mac.sh --build`) and confirms the browser lands on a working app, then stops it |
| Windows scripts | INT-02 (not gating) | No Windows host | Optional on a Windows machine |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
