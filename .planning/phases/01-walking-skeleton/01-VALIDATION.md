---
phase: "1"
slug: "walking-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1, jsdom 30.1.3 |
| **Config file** | `frontend/vitest.config.mts` + `frontend/vitest.setup.ts` (none yet; Wave 0 installs) |
| **Quick run command** | `cd frontend && npm test` |
| **Full suite command** | `cd frontend && npm test && npm run typecheck && npm run build` |
| **Container check** | `docker build -t finally-phase1 .` then run, `curl -sf localhost:8000/api/health`, `curl -sf localhost:8000/ \| grep -q FinAlly`, stop |
| **Estimated runtime** | ~10 seconds (unit); ~2-4 minutes (docker build) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test` (plus `npm run typecheck` when TS config or types change)
- **After every plan wave:** Run `cd frontend && npm test && npm run typecheck && npm run build`; once `npm run build` passes, also `docker build -t finally-phase1 .`
- **Before `/gsd-verify-work`:** Full suite green, docker build + run + curl checks, dev-proxy 40 s SSE check, end-of-phase browser check
- **Max feedback latency:** 15 seconds (unit suite)

---

## Per-Task Verification Map

Filled in by the planner and executor as tasks are created. Requirement-level map from RESEARCH.md:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FND-01 | — | N/A | build + git | `cd frontend && npm ci && npm run build && test -f out/index.html && git ls-files --error-unmatch package-lock.json .gitignore` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-01 | — | N/A | typecheck | `cd frontend && npm run typecheck` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-02 | — | N/A | integration | `docker build -t finally-phase1 .` | ✅ Dockerfile | ⬜ pending |
| TBD | TBD | TBD | FND-02 | — | N/A | integration | `curl -sf localhost:8000/api/health && curl -sf localhost:8000/ \| grep -q FinAlly` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-03 | — | N/A | build + grep | `grep -l '#ecad0a' frontend/out/_next/static/chunks/*.css && grep -l '#753991' frontend/out/_next/static/chunks/*.css` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-04 | — | N/A | unit | `cd frontend && npx vitest run src/test/harness.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-05 | — | N/A | unit | `cd frontend && npx vitest run src/lib/testIds.test.ts src/lib/format.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-05 | — | N/A | component | `cd frontend && npx vitest run src/components/Header.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-06 | — | N/A | manual-scripted | backend on :8000, `npm run dev -- -p 3100`, `curl -sf localhost:3100/api/health` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FND-06 | — | N/A | manual-scripted | `curl -N -sS --max-time 40 localhost:3100/api/stream/prices \| head -c 600` shows `data:` frames | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/package.json`, `frontend/package-lock.json`, `frontend/.gitignore`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/postcss.config.mjs`
- [ ] `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (ResizeObserver, EventSource, scrollIntoView stubs)
- [ ] `frontend/src/lib/testIds.ts`, `frontend/src/lib/format.ts`, `frontend/src/lib/api.ts` and their tests
- [ ] `frontend/src/test/harness.test.tsx`
- [ ] Framework install: pinned versions from RESEARCH.md Standard Stack

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header shows `cash-balance` `$10,000.00` read from same-origin `/api/portfolio` in the container | FND-02 | Browser render of the served static export; Playwright suite is a Phase 6 gate | Run container on a fresh volume, open `http://localhost:8000`, confirm dark shell and header values |
| SSE through `next dev` proxy stays unbuffered for 40 s | FND-06 | Needs two live processes (uvicorn + next dev) | Start backend on :8000 and `npm run dev -- -p 3100`; `curl -N --max-time 40 localhost:3100/api/stream/prices` shows continuous `data:` frames |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
