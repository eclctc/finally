---
phase: 01-walking-skeleton
plan: 01
subsystem: frontend
tags: [nextjs, static-export, tailwind4, docker, theme-tokens]

requires:
  - phase: none
    provides: existing Dockerfile, backend static mount, empty frontend/
provides:
  - Committed Next.js 16 static-export project in frontend/ with exact-pinned deps and lockfile
  - Dark theme tokens (@theme static) and the FinAlly shell served by the unchanged Docker image
  - next.config.ts with dev-only /api rewrite and compress off (for Plan 04)
  - frontend/.gitignore that re-includes src/lib/ (hidden by the root Python lib/ rule)
affects: [01-02, 01-03, 01-04, frontend phases]

actuals:
  tokens: 39000
  tasks: 2
  commits: 1
plan_head_before: e4f6e9b11a30f36d7fa3ba2b37391330cf4860b5
plan_head_after: 79d300c6585ffc6611e6d9c95792a1281161d073

tech-stack:
  added: [next 16.4.2, react 19.3.1, react-dom 19.3.1, recharts 3.10.1, tailwindcss 4.3.3, "@tailwindcss/postcss 4.3.3", postcss 8.5.30, typescript 7.0.2, vitest 5.0.5, "@vitejs/plugin-react 6.1.2", jsdom 30.1.3, "@testing-library/react 16.3.3", "@testing-library/dom 10.4.2", "@testing-library/jest-dom 7.0.1", "@testing-library/user-event 14.6.8", "@types/node 22.20.5", "@types/react 19.3.0", "@types/react-dom 19.3.0"]
  patterns: ["Tailwind 4 @theme static palette as the single source of colors", "Export only outside development; rewrites only in development", "Single install of all packages so later plans never touch the lockfile"]

key-files:
  created:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/.gitignore
    - frontend/next.config.ts
    - frontend/postcss.config.mjs
    - frontend/tsconfig.json
    - frontend/src/app/globals.css
    - frontend/src/app/layout.tsx
    - frontend/src/app/page.tsx
  modified: []

key-decisions:
  - "Package set approved by the human at the Task 1 checkpoint: reply 'approved', the exact 18 pins as listed, no fallbacks"
  - "System font stacks in the theme; no next/font so docker build downloads no fonts"
  - "next build left tsconfig.json unchanged (the next plugin and .next type globs were already in the 5681c3a analog)"

requirements-completed: [FND-01, FND-02, FND-03, FND-06]

coverage:
  - id: D1
    description: "npm run build produces frontend/out/index.html with title FinAlly; lockfile and frontend/.gitignore committed; src/lib not ignored"
    requirement: "FND-01"
    verification:
      - kind: other
        ref: "npm --prefix frontend run build; git check-ignore -q frontend/src/lib/format.ts (exit 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docker build -t finally-phase1 . succeeds with unchanged Dockerfile/backend; container serves the shell at / and /api/health ok"
    requirement: "FND-02"
    verification:
      - kind: integration
        ref: "docker build + docker run -p 8000:8000 + curl / , /api/health, served CSS"
        status: pass
    human_judgment: false
  - id: D3
    description: "Palette tokens #0d1117 #1a1a2e #ecad0a #209dd7 #753991 present in built and served CSS; shell uses bg-surface bg-panel border-line text-accent"
    requirement: "FND-03"
    verification:
      - kind: integration
        ref: "grep over frontend/out/_next/static CSS and the CSS served by the container"
        status: pass
    human_judgment: false
  - id: D4
    description: "next.config.ts: export outside dev, dev-only /api rewrite to localhost:8000, compress false"
    requirement: "FND-06"
    verification:
      - kind: other
        ref: "file content check; live dev proxy proof is Plan 04"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 01: Next.js Static Export Shell Summary

**Next.js 16 static-export project with a Tailwind 4 `@theme static` dark palette, built by the unchanged Dockerfile and served by the unchanged FastAPI static mount at :8000 alongside `/api/health`.**

## Performance

- **Duration:** about 25 min (this continuation run)
- **Tasks:** 2 of 2 (Task 1 checkpoint approved, Task 2 tracer committed)
- **Files created:** 9

## Accomplishments

- Task 1 (blocking-human checkpoint): all 18 pins verified on the registry, then the human replied **"approved"** for the exact pinned set as listed, with no fallbacks. No install happened before this approval.
- Task 2 (tracer): installed all packages once with `--save-exact`, wrote the config, theme and shell files, and proved the whole path: `next build`, `docker build -t finally-phase1 .`, container run, `/api/health`, `/`, served CSS.
- `frontend/.gitignore` re-includes `src/lib/` so the root Python `lib/` rule no longer hides it (`git check-ignore` exits 1 for `frontend/src/lib/format.ts`).
- Lockfile contains Linux optional native packages (19 matches for swc/lightningcss/oxide linux), and `npm ci` inside `node:22-slim` succeeded.

## Task Commits

1. **Task 1: package approval checkpoint** - no commit (checkpoint, no files)
2. **Task 2: end-to-end tracer** - `79d300c` (feat)

## Tracer feedback gate

The tracer task had no `blocking-human` gate, auto mode is off and `human_verify_mode` is `end-of-phase` with an automated-only `<verify>`. The verify commands were re-run end to end (build, token check, docker build and container curl checks, ignore checks) and all passed. No expansion task follows in this plan.

## Verification Results

- `npm --prefix frontend run build` exit 0; `out/index.html` has `<title>FinAlly</title>`
- Five palette hexes found in built CSS and in the CSS served by the container; `bg-surface`, `bg-panel`, `border-line`, `text-accent` present in served HTML
- `docker build -t finally-phase1 .` succeeded; container returned `{"status":"ok",...}` on `/api/health` and the FinAlly shell on `/`; container stopped afterwards
- `git check-ignore`: `src/lib/format.ts` and `package-lock.json` not ignored; `out/` and `node_modules` ignored; Dockerfile, .dockerignore and backend unchanged
- Acceptance greps: no `#000`/`bg-black`, no `next/font`, no `NEXT_PUBLIC`, no `^`/`~` pins, exactly one `@theme static`

## Deviations from Plan

None to the plan's code or files. Two environment notes:

- The first `docker build` failed in `npm ci` with a registry network error (transient, no code or lockfile change). An identical rebuild succeeded, so the lockfile is sound.
- This shell's `grep` is a ugrep function that rejects `--include=*.css`, which made the plan's token-check loop report MISSING for a file that does contain the values. The same check with `/usr/bin/grep` passes. The CSS was verified directly; no code change needed.

**Total deviations:** 0 code deviations.

## Authentication Gates

None. Task 1 was a human package-legitimacy checkpoint, handled as normal flow (approved).

## Known Stubs

`frontend/src/app/page.tsx` body is an intentionally empty `<div className="min-h-0 flex-1" />`; Plan 03 replaces it with the Dashboard. Not a goal blocker for this plan.

## Threat Flags

None. No new network endpoints or trust boundaries beyond the plan's threat model.

## Next Phase Readiness

Plans 02-04 can add source files without changing package.json or the lockfile. Plan 04 exercises the dev rewrite in `next.config.ts`.

## Self-Check: PASSED

- All nine frontend files exist and are tracked
- Commit 79d300c is an ancestor of HEAD
