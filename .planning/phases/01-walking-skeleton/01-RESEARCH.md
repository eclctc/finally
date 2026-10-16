# Phase 1: Walking Skeleton - Research

**Researched:** 2026-10-16
**Domain:** Next.js 16 static export + Tailwind 4 + Vitest/RTL scaffold, built by the existing Dockerfile and served by the existing FastAPI `StaticFiles` mount
**Confidence:** HIGH (stack was built end to end in a scratch project during project research; this session re-verified versions, read every contract file, and tested the formatter behavior)

<user_constraints>
## User Constraints (from CONTEXT.md)

No `01-CONTEXT.md` exists for this phase (`.planning/phases/01-walking-skeleton/` is empty). The effective locked decisions come from `.planning/STATE.md`, `.planning/REQUIREMENTS.md` and the planner prompt:

### Locked Decisions
- TypeScript 7 with no ESLint (typescript-eslint does not support TS 7). [STATE.md "Roadmap" decisions]
- Next.js 16 + Tailwind 4 + Recharts only + Vitest/RTL; static export via `output: 'export'`; Node 22 build stage; same-origin `/api/*`, no CORS. [PLAN.md, REQUIREMENTS.md FND-01..06]
- Phase runs in MVP mode with WALKING_SKELETON=true: thinnest end-to-end slice. The backend already exists and is complete; do not modify it.
- The existing `Dockerfile` is used as is (stage 1 copies `frontend/package.json` + `frontend/package-lock.json`, runs `npm ci` + `npm run build`, copies `out/` to `/app/static`).
- User global rules: simple, incremental, no over-engineering, no defensive programming, no emojis in code, `uv run` / `uv add` only for Python.

### Claude's Discretion
- Which minimal real backend read the skeleton shell exercises (recommended below: one-shot `GET /api/portfolio`).
- Token names beyond the required palette, shell layout, plan slicing.

### Deferred Ideas (OUT OF SCOPE)
- SSE price store, watchlist, flashes, sparklines, connection-status wiring (Phase 3).
- Charts, trade bar, positions (Phase 4); chat (Phase 5); Playwright gate and start-script work (Phase 6).
- Backend hardening (Phase 2). ESLint. Docker hardening. Cloud deploy.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Next 16 + TS 7 + Tailwind 4 project; `npm run build` produces `out/`; lockfile and `.gitignore` committed | Standard Stack pins, `next.config.ts`, lockfile cross-platform check, `frontend/.gitignore` |
| FND-02 | `docker build` succeeds with existing Dockerfile; container serves UI at `/`; `/api/health` still works | Dockerfile/main.py facts, Docker verification recipe, one-shot `/api/portfolio` read |
| FND-03 | Dark terminal theme as Tailwind tokens | `@theme static` token block, tree-shaking pitfall |
| FND-04 | Vitest + RTL harness; setup stubs `ResizeObserver`, `EventSource`, `scrollIntoView` | `vitest.config.mts`, `vitest.setup.ts` with all three stubs, harness smoke test |
| FND-05 | All E2E testids in one module; shared number formatters render bare numbers | `testIds.ts` contract table, `format.ts` verified behavior, contract-parity test |
| FND-06 | `next dev` proxies `/api/*` to :8000 without buffering SSE; export only for production builds | `next.config.ts` (`compress: false`, dev-only rewrite), dev verification recipe |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md`, `./.claude/CLAUDE.md` and `~/.claude/CLAUDE.md` that bind this phase:

- Tech stack fixed: Next.js (TypeScript, static export), Tailwind, Recharts only, FastAPI, uv, SQLite. One container, one port 8000, same-origin `/api/*`, no CORS. Node 22 LTS in the build stage.
- Code style: simple and incremental, no over-engineering, no defensive programming, short well-named functions and modules, docstring-style comments sparingly, no emojis in code or logs, README concise.
- Frontend testing is Vitest + RTL; E2E is Playwright with `LLM_MOCK=true`. No ESLint config anywhere (project decision).
- GSD workflow enforcement: file edits go through a GSD command (`/gsd-execute-phase` for this phase).
- Always validate each small increment before moving on (user global "work incrementally ALWAYS").
- Use LATEST APIs as of now (Tailwind 4 CSS-first, Next 16, React 19, Vitest 5).

## Summary

The frontend directory is empty (only `frontend/` with nothing in it), which is the single blocker for `docker build`: the Dockerfile's `COPY frontend/package.json frontend/package-lock.json ./` fails today. Phase 1 therefore has one job: create a minimal Next 16 static-export project whose `npm ci && npm run build` produces `out/index.html`, so the existing image builds and the existing FastAPI mount (`StaticFiles(directory=STATIC_DIR, html=True)` at `/`, registered after all routers) serves it. [VERIFIED: Dockerfile:1-7, 24; backend/app/main.py:69-70]

The stack is not in question. `.planning/research/STACK.md` records a scratch build of these exact pins (build, serve through the real FastAPI mount, Chromium render, Vitest, `node:22-slim`, dev-proxy SSE test). This session re-confirmed every version against the npm registry (all match) and added four planning-relevant findings the earlier research did not state: (1) Tailwind 4 only emits `@theme` variables that are used, so the theme must use `@theme static` or Recharts' `var(--color-...)` strokes in later phases will silently resolve to nothing; (2) the harness must add `EventSource` and `scrollIntoView` stubs, because STACK.md's `vitest.setup.ts` only stubs `ResizeObserver`; (3) the `next/font/google` import used by the deleted frontend fetches fonts at build time and makes `docker build` network-dependent, so use a system font stack; (4) port 3000 is currently occupied on this machine (a node process), and a stale `finally:latest` image exists, so verification recipes must use free ports and rebuild explicitly.

For the "minimal real backend read", use a single one-shot `GET /api/portfolio` from the Header on mount. It proves relative-path fetch in the container, exercises `testIds` + `format.ts` (the header shows `cash-balance` and `total-value` as bare numbers, exactly `10,000.00` on a fresh DB), and is already the data source Phase 3 needs. It does not pull in the SSE store, watchlist, or live revaluation. `GET /api/health` still must respond and is checked by curl, not by the UI.

**Primary recommendation:** Scaffold `frontend/` with the exact STACK.md pins and configs, add `src/lib/{testIds,format,api}.ts`, build a Header + placeholder-panel shell that fetches `/api/portfolio` once, prove `npm run build` then `docker build` early (before adding the test harness), and verify the browser shows `cash-balance` = 10,000.00 from the container at `:8000`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Serve the dashboard shell at `/` | API / Backend (FastAPI `StaticFiles`) | CDN / Static (the `out/` export) | One container, one port; Next is build-time only, no Node server at runtime |
| Render the shell, header, theme | Browser / Client | CDN / Static | All-client single page; static HTML is prerendered, hydrated in browser |
| Header cash/total (one-shot read) | Browser / Client (fetch) | API / Backend (`GET /api/portfolio`) | Backend owns the numbers; client only formats them |
| `/api/*` routing in dev | Frontend server (`next dev` rewrite) | API / Backend | Rewrite is dev-only; production is same-origin by construction |
| Number formatting + testids | Browser / Client (`src/lib`) | — | Pure TS shared by components and tests |
| Theme tokens | Browser / Client (CSS) | — | Tailwind 4 `@theme` in `globals.css` |
| Build of `out/` | Build stage (Node 22) | — | Dockerfile stage 1; nothing from Node ships in the runtime image |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.2 | App framework, `output: 'export'` | Fixed by PLAN. [VERIFIED: npm registry, `npm view next version` = 16.4.2, published 2026-10-15] |
| react / react-dom | 19.3.1 | UI | Next 16 peer `^19.0.0`. [VERIFIED: npm registry 19.3.1] |
| recharts | 3.10.1 | Charts (not used in Phase 1 UI; installed now so harness smoke test proves ResponsiveContainer under jsdom) | Fixed by PLAN ("Recharts only"). [VERIFIED: npm registry 3.10.1] |
| typescript | 7.0.2 | Type checking | Locked decision (no ESLint). [VERIFIED: npm registry 7.0.2] |
| tailwindcss + @tailwindcss/postcss | 4.3.3 (identical) | Styling, CSS-first theme | Official Next install path. [VERIFIED: npm registry 4.3.3 both] |
| postcss | 8.5.30 | Peer of `@tailwindcss/postcss` | [VERIFIED: npm registry 8.5.30] |

### Supporting (dev / test)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.5 | Test runner | `npm test` |
| @vitejs/plugin-react | 6.1.2 | JSX in Vitest; pulls Vite 8 transitively (do not install `vite`) | Always with vitest |
| jsdom | 30.1.3 | DOM env (needs Node `^22.22.2`; floating `node:22-slim` satisfies) | Always |
| @testing-library/react / dom / jest-dom / user-event | 16.3.3 / 10.4.2 / 7.0.1 / 14.6.8 | Component tests; `dom` must be a direct dep | Always |
| @types/node | 22.20.5 (pin; registry latest is 26.6.5) | Match Node 22 build runtime | [VERIFIED: `npm view @types/node@22.20.5 version` = 22.20.5] |
| @types/react / @types/react-dom | 19.3.0 | Typings | Always |

All versions above were read from the registry this session and match `.planning/research/STACK.md`. [VERIFIED: npm registry, 2026-10-16]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tailwindcss/postcss` | `@tailwindcss/turbopack` (used by deleted frontend) | Needs a `turbopack.rules` entry and is not in the Tailwind Next guide; PostCSS path was verified end to end. Use PostCSS. |
| `next/font/google` (IBM Plex, deleted frontend) | System font stack | Google fonts are downloaded during `next build` [ASSUMED], making `docker build` depend on network. System stack removes that risk. Use system stack. |
| TS 7, no ESLint | TS 5.9 + ESLint | Locked: TS 7, no ESLint. |

**Installation (run in `frontend/`, exact pins, commit `package-lock.json`):**
```bash
npm init -y   # then set "private": true and the scripts below
npm install --save-exact next@16.4.2 react@19.3.1 react-dom@19.3.1 recharts@3.10.1
npm install --save-exact --save-dev tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.30
npm install --save-exact --save-dev typescript@7.0.2 @types/node@22.20.5 @types/react@19.3.0 @types/react-dom@19.3.0
npm install --save-exact --save-dev vitest@5.0.5 @vitejs/plugin-react@6.1.2 jsdom@30.1.3 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.8
```
Scripts: `"dev": "next dev -p 3000"`, `"build": "next build"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`. Generate the lockfile from a clean directory (no pre-existing `node_modules`) so npm records optional platform packages for all OS/arch combinations. [CITED: .planning/research/STACK.md gotcha 12]

**Version verification:** `npm view <pkg> version` was run for all 16 packages on 2026-10-16 and each matched the pin above.

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm ...` was run on all 16 packages. No package returned `SLOP`. The `SUS` verdicts are all the single reason `too-new`: the exact pinned version (the registry `latest`) was published within the last ~week. Every flagged package is a mainstream package with tens of millions of weekly downloads, an official source repo, and no `postinstall` script.

| Package | Registry | Latest publish | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------|--------------|-------------|---------|-------------|
| next | npm | 2026-10-15 | 67.5M | github.com/vercel/next.js | SUS (too-new) | Flagged - checkpoint |
| react | npm | 2026-10-14 | 188M | github.com/react/react | SUS (too-new) | Flagged - checkpoint |
| react-dom | npm | 2026-10-14 | 177M | github.com/react/react | SUS (too-new) | Flagged - checkpoint |
| postcss | npm | 2026-10-12 | 308M | postcss/postcss | SUS (too-new) | Flagged - checkpoint |
| @types/node | npm | 2026-10-09 | 461M | DefinitelyTyped | SUS (too-new) | Flagged - checkpoint (pin 22.20.5 is older than the flagged latest 26.6.5) |
| vitest | npm | 2026-10-15 | 125M | vitest-dev/vitest | SUS (too-new) | Flagged - checkpoint |
| @vitejs/plugin-react | npm | 2026-10-05 | 96.7M | vitejs/vite-plugin-react | SUS (too-new) | Flagged - checkpoint |
| jsdom | npm | 2026-10-15 | 114M | jsdom/jsdom | SUS (too-new) | Flagged - checkpoint |
| @testing-library/user-event | npm | 2026-10-13 | 58.8M | testing-library | SUS (too-new) | Flagged - checkpoint |
| recharts | npm | 2026-07-25 | 54.9M | github.com/recharts/recharts | OK | Approved |
| tailwindcss | npm | 2026-07-16 | 137M | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @tailwindcss/postcss | npm | 2026-07-16 | 47M | tailwindlabs | OK | Approved |
| typescript | npm | 2026-07-08 | 307M | microsoft/TypeScript | OK | Approved |
| @types/react, @types/react-dom | npm | 2026-09-09 | 171M / 146M | DefinitelyTyped | OK | Approved |
| @testing-library/react, dom, jest-dom | npm | Aug-Sep 2026 | 70-85M | testing-library | OK | Approved |

`postinstall` was empty for next, react, react-dom, typescript, vitest, jsdom, @tailwindcss/postcss. [VERIFIED: `npm view <pkg> scripts.postinstall`]

**Packages removed due to SLOP verdict:** none.
**Packages flagged SUS:** next, react, react-dom, postcss, @types/node, vitest, @vitejs/plugin-react, jsdom, @testing-library/user-event.

**Planner guidance:** add ONE consolidated `checkpoint:human-verify` before the first `npm install` (not nine separate ones): the human confirms the pinned version table above (all are the registry `latest` of household-name packages; the only signal is recency). If the human prefers, fall back to the previous patch of any flagged package (for example `next@16.4.0`, `react@19.3.0`, published 2026-10-06 and 2026-09-09), but the scratch-project verification was done on the pins above, so deviating means re-verifying.

## Architecture Patterns

### System Architecture Diagram

```
  BUILD TIME (docker build, stage 1: node:22-slim)
  frontend/package.json + package-lock.json --npm ci--> node_modules
  frontend/ source --npm run build (next build, NODE_ENV=production, output: export)--> /frontend/out
                                                                                         |
  RUNTIME (stage 2: python:3.12-slim, one uvicorn worker, port 8000)                      v COPY --from=frontend
  Browser --GET /------------------------------> FastAPI --route miss--> StaticFiles(/app/static, html=True) --> out/index.html
  Browser --GET /_next/static/*---------------->     "          "               "        --> hashed JS/CSS chunks
  Browser --GET /api/health  (curl check)------> health router -> {"status":"ok","market_data":{...}}
  Browser (Header useEffect, once) --GET /api/portfolio--> portfolio router -> {cash_balance,total_value,...}
        |                                                                          (same origin, relative URL)
        +--format.ts--> "10,000.00" inside data-testid="cash-balance" / "total-value"

  DEV (two processes)
  Browser :3000 --> next dev (output undefined, compress:false) --/api/:path* rewrite--> uvicorn :8000
                                                                    (SSE passes through unbuffered)
```

### Recommended Project Structure
```
frontend/
├── .gitignore               # node_modules, .next, out, next-env.d.ts, *.tsbuildinfo
├── package.json / package-lock.json   # exact pins; lockfile committed
├── next.config.ts           # prod: export; dev: rewrite; compress:false; agentRules:false
├── postcss.config.mjs       # { "@tailwindcss/postcss": {} }
├── tsconfig.json            # generated by next build, then add types + @/* alias; commit it
├── vitest.config.mts
├── vitest.setup.ts          # jest-dom, cleanup, ResizeObserver/EventSource/scrollIntoView stubs
└── src/
    ├── app/
    │   ├── layout.tsx       # html lang, metadata, imports globals.css (no next/font/google)
    │   ├── page.tsx         # server component rendering <Dashboard />
    │   └── globals.css      # @import "tailwindcss"; @theme static {...}
    ├── components/
    │   ├── Dashboard.tsx    # "use client" shell: Header + placeholder Panels
    │   ├── Header.tsx       # brand, cash-balance, total-value, connection dot (static)
    │   ├── Panel.tsx        # titled bordered container
    │   └── Header.test.tsx
    ├── lib/
    │   ├── testIds.ts       # single source of every E2E testid
    │   ├── format.ts        # formatCurrency / formatPrice / formatQuantity / formatPercent
    │   ├── api.ts           # request<T>() wrapper, ApiError from body.error
    │   └── *.test.ts        # format, testIds contract parity, api
    └── test/
        └── harness.test.tsx # throwaway component using ResizeObserver, EventSource, scrollIntoView, Recharts
```
This is a deliberately small subset of the architecture in `.planning/research/SUMMARY.md` (no `priceStore`, `history`, hooks, or charts yet).

### Pattern 1: Production-only export, dev-only rewrite
**What:** `output: isDev ? undefined : "export"` and spread the `rewrites` only in dev. **When:** always; rewrites/redirects/headers are unsupported with export. **Example:** the full `next.config.ts` under Code Examples. [CITED: nextjs.org/docs/app/guides/static-exports; STACK.md gotchas 1-2]

### Pattern 2: Theme as `@theme static` tokens
**What:** declare palette once in `globals.css`; Tailwind generates `bg-surface`, `text-accent`, etc., and (with `static`) always emits the CSS variables so non-class consumers (Recharts `stroke="var(--color-primary)"`, tests) can read them. [CITED: tailwindcss.com/docs/theme: "By default only used CSS variables will be generated in the final CSS output ... use the `static` theme option"]

### Pattern 3: One contract module, three consumers
`src/lib/testIds.ts` is imported by components (to set `data-testid`), by Vitest tests, and by a parity test that parses `test/tests/*.spec.ts` to prove nothing in the E2E suite references an id the module does not define. This is the cheap guard that closes Pitfall 1 for every later phase.

### Pattern 4: Single `request<T>()` fetch wrapper
Relative URL only, `res.ok` checked first, parse `{"error"}` only on 400/502, treat any non-JSON (the static 404 HTML for a typo'd `/api/...` path) as a status-only `ApiError`. [CITED: STACK.md gotcha 4; PITFALLS.md Pitfall 16]

### Anti-Patterns to Avoid
- **`next/font/google`:** network at build time; no benefit for a localhost terminal.
- **Browser APIs at module scope:** `window`, `EventSource`, `localStorage` only inside `useEffect` (prerender runs client components at build). `fetch` in the Header goes in `useEffect`.
- **`tailwind.config.js` / `@tailwind base`:** ignored in v4. Use `@import "tailwindcss"` + `@theme`.
- **`rewrites()` unconditionally:** breaks `output: 'export'` production build.
- **Absolute backend URLs / `NEXT_PUBLIC_*`:** breaks the container and invents a CORS need.
- **Sub-element testids starting with `watchlist-row-`:** inflates the E2E row count (not exercised in Phase 1 but encode the rule in `testIds.ts` now).
- **Putting labels, deltas or units inside the `cash-balance` / `total-value` elements:** corrupts `readNumber`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number/currency formatting | Manual `toFixed` + comma regexes | `Intl.NumberFormat("en-US", ...)` | Locale-fixed, grouping and rounding correct; behavior verified below |
| Dev API proxy | Custom Node proxy / CORS middleware | `next.config.ts` `rewrites()` (dev only) | One line; same-origin story preserved |
| Dark theme plumbing | Hand-written CSS variable system | Tailwind 4 `@theme static` | Generates utilities and variables from one block |
| SSE client (later phases) | Reconnect timers | Native `EventSource` | Out of scope here; harness only needs a stub |
| Test DOM APIs | Real polyfills | Minimal stubs in `vitest.setup.ts` | jsdom lacks these; stubs are 20 lines |
| Fetch error shapes | Per-component try/parse | One `request()` + `ApiError` | Backend error body is `{"error": ...}`, not FastAPI `detail` |

**Key insight:** the phase is configuration and contract, not logic. Every custom solution here is a chance to drift from the verified scratch build.

## Common Pitfalls

### Pitfall 1: Tailwind drops unused theme variables
**What goes wrong:** with plain `@theme`, a token not used by any class (for example `--color-submit` before a submit button exists) is absent from built CSS, so `var(--color-submit)` in inline SVG/CSS resolves to nothing and a "token exists" check fails. **Why:** Tailwind 4 only emits used variables by default. **Avoid:** `@theme static { ... }`. **Warning sign:** `grep '#753991' out/_next/static/chunks/*.css` finds nothing. [CITED: tailwindcss.com/docs/theme]

### Pitfall 2: `docker build` still fails after `npm run build` works locally
**What goes wrong:** lockfile generated on macOS lacks Linux optional native packages (swc, lightningcss, Tailwind oxide) so `npm ci` in `node:22-slim` fails or builds without them; or `frontend/node_modules` copied from host. **Avoid:** generate the lockfile in a clean dir; the existing `.dockerignore` already excludes `frontend/node_modules`, `frontend/.next`, `frontend/out` (keep it); run `docker build` as the arbiter. Cheap pre-check: `grep -cE 'node_modules/(@next/swc-linux|@tailwindcss/oxide-linux|lightningcss-linux)' frontend/package-lock.json` is non-zero [ASSUMED package-name prefixes; adjust to what the lockfile shows]. [VERIFIED: .dockerignore lines `frontend/node_modules`, `frontend/.next`, `frontend/out`]

### Pitfall 3: Stale image masks success
**What goes wrong:** `finally:latest` and `finally:dev` images already exist on this machine (built earlier, 1.05GB). `scripts/start_mac.sh` only rebuilds with `--build`. A passing run may be the old image. **Avoid:** verify with an explicit `docker build -t finally-phase1 .` and `docker run` of that tag. [VERIFIED: `docker images finally` output this session]

### Pitfall 4: Port 3000 is taken
**What goes wrong:** a node process (PID 47859) is already listening on `*:3000` on this machine, so `next dev -p 3000` fails or silently picks another port. **Avoid:** check `lsof -nP -iTCP:3000 -sTCP:LISTEN` first, or run the dev check with `npm run dev -- -p 3100`. [VERIFIED: `lsof` output this session]

### Pitfall 5: Dev SSE appears dead (gzip buffering)
**What goes wrong:** `next dev` compresses proxied responses, buffering the SSE stream. **Avoid:** `compress: false` in `next.config.ts`. Measured earlier: 0 events in 4 s with defaults vs 8 with `compress: false`. [CITED: STACK.md gotcha 2]

### Pitfall 6: Long-lived dev SSE may be cut by the rewrite proxy
**What goes wrong:** the Next dev proxy may have a default timeout (reported ~30 s) after which the stream drops. **Status:** not confirmed in official docs this session (the rewrites page does not mention it; a web search found only an example config using `experimental.proxyTimeout`). **Avoid/verify:** the FND-06 check should hold the stream open for 40+ seconds. EventSource reconnects automatically, so even if a cut happens it is non-fatal; only add `experimental.proxyTimeout` if the 40 s check fails. [ASSUMED]

### Pitfall 7: Test files type-checked by `next build`
**What goes wrong:** `tsconfig.json` `include` covers `**/*.ts(x)`, so `*.test.tsx` and `vitest.setup.ts` are type-checked during `next build`; missing `types` entries break the production build. **Avoid:** add `"types": ["node", "vitest/globals", "@testing-library/jest-dom"]`; verified earlier that `tsc --noEmit` passes including tests. Re-run `next build` after adding the first test file. [CITED: STACK.md tsconfig note; PITFALLS.md Pitfall 7]

### Pitfall 8: `next build` rewrites `tsconfig.json` on first run
It adds `plugins: [{name: "next"}]` and `.next/dev/types/**/*.ts` to `include`. Commit the result so later builds are clean. [CITED: STACK.md]

### Pitfall 9: Placeholder inside `cash-balance` / `total-value`
While the one-shot fetch is pending, the elements may show `--`. `readNumber("--")` is `NaN`, which is fine under `expect.poll` (retries) but would break a one-shot read. Phase 3 owns the final loading UX; for Phase 1 keep the placeholder inside the element only if no E2E spec reads it before the poll (true for all current specs, which use `expect.poll`). [VERIFIED: test/tests/fresh-start.spec.ts, trading.spec.ts use `expect.poll(() => readNumber(...))`]

### Pitfall 10: Hydration mismatch from locale-dependent output
Format with a fixed `en-US` locale and fixed fraction digits only. Never render `Date.now()` or `toLocaleString()` without locale at prerender. [CITED: PITFALLS.md Pitfall 7]

## Code Examples

### `frontend/next.config.ts` (verified in scratch project)
```ts
// Source: .planning/research/STACK.md "Required configuration (verified)"
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: isDev ? undefined : "export",
  images: { unoptimized: true },
  compress: false,
  agentRules: false,
  ...(isDev && {
    async rewrites() {
      return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }];
    },
  }),
};

export default nextConfig;
```

### `frontend/postcss.config.mjs`
```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

### `frontend/src/app/globals.css` (theme tokens; `static` is the change from STACK.md)
```css
@import "tailwindcss";

@theme static {
  --color-surface: #0d1117;
  --color-panel: #1a1a2e;
  --color-line: #30363d;
  --color-text: #d5dce6;
  --color-muted: #7b8698;
  --color-accent: #ecad0a;
  --color-primary: #209dd7;
  --color-submit: #753991;
  --color-up: #2fbf71;
  --color-down: #f0524f;
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

html, body { height: 100%; background: var(--color-surface); color: var(--color-text); }
body { font-family: var(--font-sans); font-size: 13px; }
.figures { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```
Required values (surface `#0d1117`, panel `#1a1a2e`, accent `#ecad0a`, primary `#209dd7`, submit `#753991`) come from PLAN.md section 2 / FND-03. `--color-line`, `text`, `muted`, `up`, `down` are design choices (the up/down hexes match the deleted frontend's palette at 5681c3a; `line` is a muted GitHub-dark-style gray) and may be tuned by the UI-SPEC. [ASSUMED for the non-required values]

### `frontend/src/lib/testIds.ts` contract (Phase 1 defines the whole table once)
Source of truth is `test/tests/*.spec.ts`; the verbatim ids used there are listed below. [VERIFIED: test/tests/{fresh-start,sse-reconnect,watchlist,trading,chat,portfolio-charts}.spec.ts, read this session]

| Group | Ids as they appear in the specs |
|-------|---------------------------------|
| Static | `connection-status`, `cash-balance`, `total-value`, `watchlist`, `watchlist-add-input`, `watchlist-add-button`, `main-chart`, `trade-ticker`, `trade-quantity`, `trade-buy`, `trade-sell`, `trade-error`, `positions-table`, `heatmap`, `pnl-chart`, `chat-panel`, `chat-input`, `chat-send`, `chat-loading`, `chat-message`, `chat-action` |
| Per ticker | `` `watchlist-row-${ticker}` ``, `` `watchlist-price-${ticker}` ``, `` `watchlist-remove-${ticker}` ``, `` `position-row-${ticker}` `` |
| Not asserted by specs but in the TEAM.md contract | `chat-error` (from `git show 5681c3a:planning/TEAM.md` section 5: "`chat-error` | chat error message") |
| Attributes | `data-status` on `connection-status` = `connected` / `reconnecting` / `disconnected`; `data-ticker` on `main-chart`; `data-role` on `chat-message` = `user` / `assistant`; `data-status` on `chat-action` = `ok` / `failed` |

Note `trading.spec.ts` builds ``getByTestId(`trade-${side}`)`` with `side: "buy" | "sell"`, so `trade-buy` and `trade-sell` are required as written.

```ts
/** Every data-testid the Playwright suite relies on. Components and tests import from here. */
export const testIds = {
  connectionStatus: "connection-status",
  cashBalance: "cash-balance",
  totalValue: "total-value",
  watchlist: "watchlist",
  watchlistAddInput: "watchlist-add-input",
  watchlistAddButton: "watchlist-add-button",
  mainChart: "main-chart",
  tradeTicker: "trade-ticker",
  tradeQuantity: "trade-quantity",
  tradeBuy: "trade-buy",
  tradeSell: "trade-sell",
  tradeError: "trade-error",
  positionsTable: "positions-table",
  heatmap: "heatmap",
  pnlChart: "pnl-chart",
  chatPanel: "chat-panel",
  chatInput: "chat-input",
  chatSend: "chat-send",
  chatLoading: "chat-loading",
  chatMessage: "chat-message",
  chatAction: "chat-action",
  chatError: "chat-error",
  watchlistRow: (ticker: string) => `watchlist-row-${ticker}`,
  watchlistPrice: (ticker: string) => `watchlist-price-${ticker}`,
  watchlistRemove: (ticker: string) => `watchlist-remove-${ticker}`,
  positionRow: (ticker: string) => `position-row-${ticker}`,
} as const;
```
Rule to encode in a comment: no other id inside the watchlist may start with `watchlist-row-` (fresh-start asserts `[data-testid^="watchlist-row-"]` count is 10). [VERIFIED: fresh-start.spec.ts: `toHaveCount(10)` on `'[data-testid^="watchlist-row-"]'`]

### `frontend/src/lib/format.ts` (behavior verified in node this session)
```ts
const cents = (n: number) => Math.round(n * 100) / 100 + 0; // "+ 0" turns -0 into 0
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const decimal2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("en-US", {
  style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero",
});

export const formatCurrency = (n: number) => currency.format(cents(n)); // "$10,000.00"
export const formatPrice = (n: number) => decimal2.format(cents(n));    // "1,234.57"
export const formatQuantity = (n: number) => quantity.format(n);        // 0.12345678 -> "0.1235", 2 -> "2"
export const formatPercent = (fraction: number) => percent.format(fraction); // 0.0123 -> "+1.23%"
```
Observed output: `10000 -> "$10,000.00"` (parses to 10000), `-0.004 -> "$0.00"` (parses to 0, no `-0`), `-5 -> "-$5.00"` (parses to -5), `pct(0.0123) = "+1.23%"`, `pct(-0.0004) = "-0.04%"`, `pct(0.00001) = "0.00%"`. The parse used was the specs' own rule `Number(text.replace(/[^0-9.-]/g, ""))`. [VERIFIED: node run in session scratchpad; helper rule VERIFIED: test/tests/helpers.ts `parseNumber`]

Why this satisfies "bare numbers": `$` and `,` are stripped by `parseNumber`; the elements must contain nothing else (no label, no delta, no unit, no unicode minus, no abbreviation like `10K`).

### `frontend/src/lib/api.ts`
```ts
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Fetch same-origin JSON. Backend error bodies are {"error": "..."}; anything else is status-only. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (response.ok) return response.json() as Promise<T>;
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
}
```
Keep it this small in Phase 1; Phase 3/4 reuse it. (`.catch(() => null)` is the one justified guard: the static mount returns HTML for unknown `/api/*` paths.) [VERIFIED: STACK.md gotcha 4; backend error shape VERIFIED in CLAUDE.md error-handling section `ValidationError -> HTTP 400 {"error": "<reason>"}`]

### Header with the one real backend read
`GET /api/portfolio` returns (verbatim keys from `get_portfolio`): `cash_balance`, `total_value`, `positions_value`, `unrealized_pnl`, `positions`. [VERIFIED: backend/app/services/portfolio.py:91-102]
```tsx
"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { testIds } from "@/lib/testIds";

interface PortfolioSummary { cash_balance: number; total_value: number }

export function Header() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  useEffect(() => { request<PortfolioSummary>("/api/portfolio").then(setPortfolio); }, []);
  const show = (n?: number) => (n === undefined ? "--" : formatCurrency(n));
  return (
    <header className="flex h-14 items-center border-b border-line bg-panel px-4">
      <span className="text-lg font-semibold">Fin<span className="text-accent">Ally</span></span>
      <div className="ml-auto flex items-center gap-8">
        <span data-testid={testIds.totalValue} className="figures text-xl text-accent">{show(portfolio?.total_value)}</span>
        <span data-testid={testIds.cashBalance} className="figures text-text">{show(portfolio?.cash_balance)}</span>
        <span data-testid={testIds.connectionStatus} data-status="disconnected" className="size-2.5 rounded-full bg-down" />
      </div>
    </header>
  );
}
```
Notes: labels ("Portfolio value", "Cash") belong in sibling elements outside the testid element. The connection dot is a static `disconnected` placeholder until Phase 3 wires `EventSource`; do not add SSE logic now. A failed fetch leaves `--` (no defensive UI). Unhandled rejection in a skeleton is acceptable; if the planner wants it quiet, add a single `.catch(() => {})` and no more.

### `frontend/vitest.config.mts` and `vitest.setup.ts` (STACK.md config plus the two missing stubs)
```ts
// vitest.config.mts - Source: STACK.md (verified); alias added to match tsconfig "@/*"
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./vitest.setup.ts"], css: false },
});
```
```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class FixedSizeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const contentRect = { width: 800, height: 400 } as DOMRectReadOnly;
    this.callback([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

/** Controllable EventSource double: tests call emit()/fail() on the latest instance. */
export class FakeEventSource {
  static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  open() { this.readyState = FakeEventSource.OPEN; this.onopen?.(); }
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
  fail(closed = false) { this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING; this.onerror?.(); }
  close() { this.readyState = FakeEventSource.CLOSED; }
}

globalThis.ResizeObserver = FixedSizeResizeObserver;
globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  FakeEventSource.instances = [];
});
```
Keep `FakeEventSource` exactly this small in Phase 1 (it is a harness stub, not the Phase 3 price-stream tests); the open/emit/fail helpers are the minimum Phase 3 needs for the status mapping (`onopen`, `onerror` with CONNECTING vs CLOSED) and avoid a rewrite later. If the planner prefers minimal, `open`/`emit`/`fail` may be deferred to Phase 3 and only the class shell kept.

`tsconfig.json`: after `next build` generates it, add `"types": ["node", "vitest/globals", "@testing-library/jest-dom"]` and `"paths": { "@/*": ["./src/*"] }`, and commit.

### Harness smoke test (proves FND-04 success criterion 3)
A throwaway component defined inside the test file (not shipped) that, in a `useEffect`, constructs `new EventSource("/api/stream/prices")`, observes a `ResizeObserver`, and calls `ref.current?.scrollIntoView()`, rendering a Recharts `<ResponsiveContainer><LineChart>` with a fixed-height parent. Assertions: it renders without throwing; `FakeEventSource.instances` has one instance with that URL; `scrollIntoView` was called; `container.querySelector("svg")` is present. This reproduces the STACK.md finding that without the stub `ResponsiveContainer` renders 0 SVGs and with it renders them. [CITED: STACK.md gotcha 7]

### Contract-parity test (cheap guard for FND-05)
`src/lib/testIds.test.ts` reads every `test/tests/*.spec.ts` with `node:fs`, extracts ids with a regex over `getByTestId(...)` and `data-testid` selectors, and asserts each one is covered by `testIds`. Template ids such as `` `watchlist-row-${TICKER}` `` and `` `trade-${side}` `` are normalized to the prefix before `${`; a prefix is covered if some static id or per-ticker function output (`fn("")`) starts with it. Path from the test file: `path.resolve(__dirname, "../../../test/tests")`. It reads the repo, not the network, and runs in under a second. It is excluded from nothing: `next build` only type-checks it and Docker stage 1 never executes it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js`, `@tailwind base` | `@import "tailwindcss"` + `@theme` in CSS | Tailwind 4 | Theme lives in `globals.css`; v3 guides mislead |
| `@tailwindcss/turbopack` loader (deleted frontend) | `@tailwindcss/postcss` + `postcss.config.mjs` | Official Next guide | No `turbopack.rules` entry |
| `next lint` | Removed in Next 16; no ESLint here by decision | Next 16 | `next build` + `tsc --noEmit` are the checks |
| Next default AGENTS.md generation in dev | `agentRules: false` | Next 16.4 | Keeps repo clean |

**Deprecated/outdated:** TS 5 + ESLint stack of the deleted frontend (locked decision supersedes); `next/font/google` for this project.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next/font/google` downloads fonts during `next build`, making Docker build network-dependent | Standard Stack, Anti-Patterns | Low: using a system font stack is harmless either way |
| A2 | Lockfile package-name prefixes `@next/swc-linux*`, `@tailwindcss/oxide-linux*`, `lightningcss-linux*` are what appear for Linux optional deps | Pitfall 2 | Low: pre-check grep may need adjusting; `docker build` remains the arbiter |
| A3 | `next dev` rewrite proxy may cut SSE after ~30 s | Pitfall 6 | Low: EventSource reconnects; verify with the 40 s check |
| A4 | Non-required palette values (`line`, `text`, `muted`, `up`, `down`) are acceptable | Code Examples | Low: UI-SPEC may retune; no code depends on hex values |
| A5 | The `FakeEventSource` helper surface (`open/emit/fail`) is what Phase 3 tests need | vitest.setup.ts | Low: extend in Phase 3 |

## Open Questions (RESOLVED)

1. **Does the 40 s dev-proxy SSE hold work, or is `experimental.proxyTimeout` needed?**
   - Known: 4 s of unbuffered frames was measured earlier with `compress: false`.
   - Unclear: behavior past ~30 s (unconfirmed in official docs).
   - Recommendation: include the 40 s `curl -N` check in FND-06 verification; add the option only if it fails.
   - **RESOLVED:** adopted. Plan 01-04 Task 1 runs the 40 s `curl -N` check through `next dev` and passes only when curl's own `--max-time` ends the stream (exit 28) after at least 60 frames. `experimental: { proxyTimeout: 3600000 }` is added to the dev-only config only if that check fails and the `next dev` log proves the proxy closed the request.
2. **Should the skeleton's Header show `--` or `0.00` while loading?**
   - Known: all specs use `expect.poll`, so either works.
   - Recommendation: `--` for Phase 1; Phase 3 revisits (FEATURES.md notes placeholders are safest outside the testid element).
   - **RESOLVED:** `--`. Plan 01-03 Task 1 renders exactly `--` in `cash-balance` and `total-value` until `/api/portfolio` answers, and its Header test asserts that text. Phase 3 owns the final loading UX.
3. **Should placeholder panels carry final testids (`watchlist`, `chat-panel`, ...)?**
   - Recommendation: yes for wrappers that need no children (`watchlist`, `positions-table`, `heatmap`, `pnl-chart`, `chat-panel`) is harmless and shows the shell layout; but do NOT add `watchlist-row-*` or `main-chart` until their phases. Planner/UI-SPEC discretion.
   - **RESOLVED:** yes for the five wrappers only. Plan 01-03 Task 2 sets `watchlist`, `heatmap`, `pnl-chart`, `positions-table` and `chat-panel` from `testIds`, and its Dashboard test asserts that no `watchlist-row-*` id and no `main-chart` id exist.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | local build, tests, dev | yes | v26.9.0 (container uses 22.x; jsdom 30 needs `^22.22.2 \|\| ^24.15.0 \|\| >=26`) | — |
| npm | install, lockfile | yes | 11.19.1 (lockfile from npm 11 works with `npm ci` on image npm, verified earlier) | — |
| Docker daemon | FND-02 build and run | yes | 29.8.2, daemon running (`docker info` returns server) | — |
| uv | run backend for dev proxy check | yes | 0.12.3 | — |
| curl | health/SSE checks | yes | 8.7.1 | — |
| Playwright Chromium (test/node_modules + `~/Library/Caches/ms-playwright`) | optional browser check of the skeleton | yes | chromium-1243 and chromium-1248 cached; pairing with `@playwright/test` 1.64.1 not confirmed | Manual browser check via the human-verify step |
| Port 8000 | container run | free | — | `-p 8100:8000` |
| Port 3000 | `next dev` | NO - node PID 47859 listening on `*:3000` | — | `npm run dev -- -p 3100` |
| Existing images `finally:latest`, `finally:dev` | — | present, stale | — | build a new tag `finally-phase1` |
| Internet during `docker build` | `npm ci`, `uv sync`, base image pulls | assumed yes | — | none |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** port 3000 (use another port).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1, jsdom 30.1.3 |
| Config file | `frontend/vitest.config.mts` (does not exist yet; Wave 0) |
| Quick run command | `cd frontend && npm test` (`vitest run`; whole Phase 1 suite is a handful of tiny tests, seconds) |
| Full suite command | `cd frontend && npm test && npm run typecheck && npm run build` |
| Container check | `docker build -t finally-phase1 . && docker run --rm -d --name finally-p1 -p 8000:8000 -e LLM_MOCK=true finally-phase1` then the curl checks below, then `docker stop finally-p1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | Static export produced; lockfile and `frontend/.gitignore` tracked | build + git | `cd frontend && npm ci && npm run build && test -f out/index.html && git ls-files --error-unmatch package-lock.json .gitignore` | Wave 0 |
| FND-01 | TS 7 type-checks including tests | typecheck | `cd frontend && npm run typecheck` | Wave 0 |
| FND-02 | Image builds with existing Dockerfile | integration | `docker build -t finally-phase1 .` | Dockerfile yes |
| FND-02 | Container serves shell and keeps `/api/health` | integration | `curl -sf localhost:8000/api/health` and `curl -sf localhost:8000/ \| grep -q FinAlly` | Wave 0 (shell) |
| FND-02 | Browser to same-origin `/api/portfolio` works in the container | manual / optional ad-hoc Playwright | Open `http://localhost:8000`, header `cash-balance` reads `$10,000.00`; optional throwaway script via `test/node_modules/@playwright/test` (not committed) | manual (human-verify, end-of-phase) |
| FND-03 | Required palette present as tokens in built CSS | build + grep | `grep -l '#ecad0a' frontend/out/_next/static/chunks/*.css && grep -l '#753991' ...` (works because `@theme static`) | Wave 0 |
| FND-03 | Utilities usable (`bg-surface`, `text-accent`, `bg-submit`) | unit/build | Header/Panel use at least `bg-panel`, `border-line`, `text-accent`; `next build` succeeds | Wave 0 |
| FND-04 | Harness green; ResizeObserver, EventSource, scrollIntoView stubs work; Recharts renders in jsdom | unit | `cd frontend && npx vitest run src/test/harness.test.tsx` | Wave 0 |
| FND-05 | testids come from one module; parity with E2E specs | unit | `cd frontend && npx vitest run src/lib/testIds.test.ts` | Wave 0 |
| FND-05 | Formatters yield parseable bare numbers (10000, -5, 0 not -0, quantity trim) using the specs' `parseNumber` rule | unit | `cd frontend && npx vitest run src/lib/format.test.ts` | Wave 0 |
| FND-05 | Header renders `cash-balance`/`total-value` containing only the formatted number | component | `cd frontend && npx vitest run src/components/Header.test.tsx` (mock `fetch`) | Wave 0 |
| FND-06 | Dev server proxies `/api/*` to :8000 | manual-scripted | start backend (`cd backend && LLM_MOCK=true uv run uvicorn app.main:app --port 8000`), `cd frontend && npm run dev -- -p 3100`, `curl -sf localhost:3100/api/health` | Wave 0 |
| FND-06 | SSE unbuffered through the proxy, held 40 s | manual-scripted | `curl -N -sS --compressed --max-time 40 localhost:3100/api/stream/prices \| head -c 600` shows `data:` frames within a few seconds and keeps flowing | Wave 0 |
| FND-06 | Production build is export-only and has no rewrite problem | build | covered by FND-01 `npm run build` (would error if `rewrites` leaked into export) | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npm test` (plus `npm run typecheck` when TS config or types change).
- **Per wave merge:** `npm test && npm run typecheck && npm run build`; after the first wave that makes `npm run build` pass, also `docker build -t finally-phase1 .`.
- **Phase gate:** full suite green, `docker build` + run + curl checks, dev-proxy 40 s SSE check, and the end-of-phase human-verify browser check of `http://localhost:8000` before `/gsd-verify-work`.

### Wave 0 Gaps
Everything is a gap because `frontend/` is empty:
- [ ] `frontend/package.json`, `package-lock.json` (clean-dir install), `.gitignore`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- [ ] `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (all three stubs)
- [ ] `src/lib/testIds.ts`, `src/lib/format.ts`, `src/lib/api.ts` and their tests
- [ ] `src/test/harness.test.tsx`
- [ ] Framework install: the `npm install` commands under Standard Stack

Recommended ordering for the walking skeleton (thinnest end to end first):
1. Minimal Next project (config, tailwind, one page) so `npm run build` and `docker build` pass. This removes the project's current blocker immediately.
2. Theme tokens, `testIds`, `format`, `api`, Header with the one-shot `/api/portfolio` read, placeholder panels; rebuild image; browser check.
3. Vitest harness, stubs, smoke/parity/format/Header tests; re-run `next build` (Pitfall 7).
4. Dev proxy verification (FND-06 recipes), README one-liner for `npm run dev`.

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Spec: no login; single-user |
| V3 Session Management | no | No sessions or cookies |
| V4 Access Control | no | Single user; app is localhost-oriented (binding to 127.0.0.1 is a Phase 6 start-script item) |
| V5 Input Validation | minimal | No user input in Phase 1; React escapes output; render backend `error` text as plain text only |
| V6 Cryptography | no | None |
| V14 Configuration / supply chain | yes | Exact version pins, committed lockfile, `npm ci` in Docker, legitimacy audit above; no `NEXT_PUBLIC_*` secrets; dev rewrite exists only when `NODE_ENV=development` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Typosquatted / freshly hijacked npm package | Tampering | Pinned versions + lockfile + human-verify checkpoint on `SUS (too-new)` flags; no postinstall scripts found |
| XSS via rendering backend/LLM text with `dangerouslySetInnerHTML` | Tampering | Never use it; JSX text nodes only (matters from Phase 5, set the habit now) |
| Dev proxy exposed on LAN | Information disclosure | `next dev` is a local-only developer tool; production has no rewrite |
| Secrets in the image | Information disclosure | `.dockerignore` already excludes `.env`; frontend uses no env vars |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `Dockerfile`, `.dockerignore`, `backend/app/main.py`, `backend/app/routes/{health,portfolio}.py`, `backend/app/services/portfolio.py` (`get_portfolio`), `test/tests/*.spec.ts`, `test/tests/helpers.ts`, `test/playwright.config.ts`, `test/docker-compose.test.yml`, `.planning/{REQUIREMENTS,STATE,ROADMAP}.md`, `.planning/research/{SUMMARY,STACK,PITFALLS,FEATURES}.md`, `scripts/start_mac.sh`.
- Deleted frontend at commit 5681c3a (reference only): `frontend/next.config.ts`, `package.json`, `.gitignore`, `tsconfig.json`, `vitest.*`, `globals.css`, `layout.tsx`, `Header.tsx`, `Panel.tsx`, `Dashboard.tsx`; `planning/TEAM.md` section 5.
- npm registry (`npm view`, 2026-10-16) and `gsd-tools query package-legitimacy check`.
- https://tailwindcss.com/docs/theme - used-only variable generation, `@theme static`, namespaces.
- Node run of the `Intl.NumberFormat` formatter in the session scratchpad.

### Secondary (MEDIUM confidence)
- https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites (2026-09-28): rewrite semantics; contains no proxy-timeout statement.
- `.planning/research/STACK.md` scratch-build verification (build, FastAPI mount, Chromium, Vitest, node:22-slim, dev SSE).

### Tertiary (LOW confidence, validate)
- Dev-proxy ~30 s SSE timeout (unconfirmed; web search found no authoritative statement).
- `next/font/google` build-time download behavior (training knowledge).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pins re-verified against the registry; full toolchain previously built end to end.
- Architecture: HIGH - thin subset of the verified scratch build; backend integration read from source.
- Pitfalls: HIGH for Docker/lockfile/Tailwind/testid items (observed or cited); MEDIUM for dev-proxy timeout (unconfirmed).

**Research date:** 2026-10-16
**Valid until:** 2026-10-23 (7 days; most pins are less than a week old and Next/Vitest/jsdom are releasing patch versions quickly; re-run `npm view` before install if planning slips)
