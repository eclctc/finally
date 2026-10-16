---
phase: "5"
slug: "ai-chat"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1 + user-event 14.6.8 (jsdom 30.1.3); Playwright 1.64.1 in `test/` for the phase gate |
| **Config file** | `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (stubs `ResizeObserver`, `EventSource`, `scrollIntoView`; `resetPriceStore()` after each test; Phase 5 adds `resetAiChanges()`) |
| **Quick run command** | `npm --prefix frontend test -- <touched test file>` |
| **Full suite command** | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` |
| **Estimated runtime** | ~3 seconds for Vitest; build ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix frontend test -- <touched test file>`
- **After every plan wave:** Run `npm --prefix frontend test && npm --prefix frontend run typecheck`
- **Before `/gsd-verify-work`:** Full suite + build green, `cd backend && uv run pytest`, then the E2E gate (`chat.spec.ts` against a fresh `finally-p5` container on `127.0.0.1:8010` with tmpfs DB and `LLM_MOCK=true`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled in by the planner and executors. Requirement-to-test map (from 05-RESEARCH.md):

| Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-------------------|-------------|--------|
| CHAT-01 | component | `npm --prefix frontend test -- src/components/ChatDock.test.tsx src/components/Dashboard.test.tsx` | partial (ChatDock ❌ W0) | ⬜ pending |
| CHAT-02 | component | `npm --prefix frontend test -- src/components/ChatDock.test.tsx` | ❌ W0 | ⬜ pending |
| CHAT-03 | unit + component | `npm --prefix frontend test -- src/lib/chat.test.ts src/components/ChatDock.test.tsx` | ❌ W0 | ⬜ pending |
| CHAT-04 | component | `npm --prefix frontend test -- src/components/ChatDock.test.tsx` | ❌ W0 | ⬜ pending |
| CHAT-05 | unit + component + integration | `npm --prefix frontend test -- src/lib/chat.test.ts src/lib/aiChangeStore.test.ts src/components/Dashboard.test.tsx src/components/Watchlist.test.tsx src/components/PositionsTable.test.tsx` | partial | ⬜ pending |
| CHAT-06 | unit + component | `npm --prefix frontend test -- src/lib/chat.test.ts src/components/ChatDock.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/chat.test.ts` — `describeAction`, `aiChangeTargets`, `removedTickers`, `QUICK_PROMPTS` keyword check (CHAT-03, 05, 06)
- [ ] `frontend/src/lib/aiChangeStore.test.ts` — hold / fade / gone, restart, reset (CHAT-05)
- [ ] `frontend/src/components/ChatDock.test.tsx` — transcript, composer, chips, loading, error, collapse persistence, focus, XSS (CHAT-01..04, 06)
- [ ] Row `data-ai-changed` tests in `Watchlist.test.tsx` and Phase 4's positions test file (CHAT-05)
- [ ] `Dashboard.test.tsx` integration: chat reply to refetch to highlight (CHAT-05)
- [ ] `vitest.setup.ts`: `resetAiChanges()` in `afterEach`
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI-change highlight is visible as a blue tint that fades; hover does not hide it confusingly | CHAT-05 | jsdom does not paint CSS transitions | Ask the AI (mock mode) to buy; watch the AAPL position and watchlist rows |
| Real LLM reply quality | CHAT-01..03 | Needs a live OpenRouter key; E2E uses `LLM_MOCK=true` | Optional: run with a key and ask "Analyze my portfolio" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
