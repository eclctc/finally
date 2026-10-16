# Stack Research

**Domain:** Bloomberg-style live trading workstation UI (Next.js static export served by an existing FastAPI backend)
**Researched:** 2026-10-16
**Confidence:** HIGH (versions read from the npm registry today; the full toolchain was built and run in a scratch project, see "Verification performed")

Scope: the frontend stack only. The backend (FastAPI 0.143, Pydantic 2, LiteLLM, uv, Python 3.12) is not re-researched. The stack is fixed by `planning/PLAN.md` (Next.js + TypeScript `output: 'export'`, Tailwind, Recharts only, Vitest + RTL, Node 22 build stage). This document pins versions and lists the configuration that makes that stack work.

## Verification performed

A scratch project with the exact pins below was built and exercised (not just read about):

- `next build` with `output: 'export'` on Next 16.4.2 + TypeScript 7.0.2 + Tailwind 4.3.3 succeeds and emits `out/`.
- `out/` was served by the real `backend/app/main.py` (`StaticFiles(html=True)`); `/` returned 200, JS chunks were served as `text/javascript`, and Chromium rendered the page with no console errors and Tailwind styles applied.
- `npm ci && npm run build` succeeds inside `node:22-slim` (Node 22.23.3), the same base image as the Dockerfile.
- Vitest 5.0.5 + RTL + jsdom ran a Recharts component; `tsc --noEmit` (TS 7) passed including test files.
- Recharts output was inspected in Chromium against the selectors the existing Playwright suite uses.
- `next dev` with an `/api` rewrite was run against the live backend to test SSE proxying.
- Chromium's native `EventSource` was tested against a dropped and then refused connection.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 22 LTS (`node:22-slim`, currently 22.23.3) | Build-stage runtime only | PLAN.md fixes Node 22. Meets every engine range (Next >=20.9, Vitest `^22.12`, jsdom 30 `^22.22.2`). The floating `node:22-slim` tag satisfies jsdom's 22.22.2 floor; an older pinned 22.x patch would not. | HIGH |
| Next.js | 16.4.2 (`latest`, published 2026-10-15) | App framework, static export to `out/` | Fixed by PLAN. Turbopack is the default bundler for `next build` and handles CSS/PostCSS natively. App Router client components cover this single-page, all-client app. | HIGH |
| React / React DOM | 19.3.1 | UI | Next 16 peer range is `^19.0.0`. Recharts 3 supports 19. | HIGH |
| TypeScript | 7.0.2 (`latest`) | Type checking | Verified working with `next build` (Next 16.4 runs the project-local `tsc` CLI when TS 7 is installed, per official docs) and `tsc --noEmit`. See the ESLint caveat under "What NOT to Use". | MEDIUM |
| Tailwind CSS | 4.3.3 | Styling, custom dark theme | Fixed by PLAN. v4 is CSS-first: the theme is declared with `@theme` in `globals.css`, no `tailwind.config.js`. | HIGH |
| `@tailwindcss/postcss` | 4.3.3 (must equal `tailwindcss`) | Tailwind integration for Next | This is the official Next.js install path in the Tailwind docs. Turbopack reads `postcss.config.mjs` natively. Verified: utilities and `@theme` variables appear in the built CSS. | HIGH |
| PostCSS | 8.5.30 | Required by `@tailwindcss/postcss` | Peer of the Tailwind guide's install command. | HIGH |
| Recharts | 3.10.1 | All charts: sparklines, main chart, P&L line, Treemap heatmap | Fixed by PLAN ("Recharts only"). v3 declares React 19 support. Treemap, LineChart, AreaChart, and ResponsiveContainer cover every chart in PLAN section 10. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | 2.1.1 | Conditional class names (flash up/down, selected row) | Optional. Already a Recharts dependency, so it adds no weight. Skip it if template strings suffice. |

No state library, data-fetching library, or UI kit is recommended. `EventSource` plus `fetch` plus React hooks cover the requirements, and PLAN calls for a small dependency surface. Do not add SWR or React Query for six REST calls.

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | 5.0.5 | Unit test runner | Requires Vite 6/7/8. `@vitejs/plugin-react` 6 pulls in Vite 8.3.4 transitively, so do not install `vite` directly. |
| `@vitejs/plugin-react` | 6.1.2 | JSX transform in Vitest | Peer is `vite ^8`. |
| jsdom | 30.1.3 | DOM environment | Needs Node `^22.22.2`. Preferred over happy-dom (21.0.3) because RTL and jest-dom are tested against jsdom. |
| `@testing-library/react` | 16.3.3 | Component tests | Peer needs `@testing-library/dom` installed explicitly. |
| `@testing-library/dom` | 10.4.2 | RTL peer | Must be a direct devDependency. |
| `@testing-library/jest-dom` | 7.0.1 | Matchers (`toBeInTheDocument`) | Import from `@testing-library/jest-dom/vitest`. |
| `@testing-library/user-event` | 14.6.8 | Typing and clicking in tests | Trade bar, chat input, watchlist add. |
| `@types/node` | ^22.20.5 | Node typings | Match the Node 22 build runtime, not the `^26` used in `test/`. Vitest allows `^22 || >=24`. |
| `@types/react` / `@types/react-dom` | 19.3.0 | React typings | |

## Installation

```bash
cd frontend
npm init -y   # then set "private": true and the scripts below

# Core (exact pins; commit package-lock.json, the Dockerfile uses `npm ci`)
npm install --save-exact next@16.4.2 react@19.3.1 react-dom@19.3.1 recharts@3.10.1

# Styling
npm install --save-exact --save-dev tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.30

# TypeScript
npm install --save-exact --save-dev typescript@7.0.2 @types/node@22.20.5 @types/react@19.3.0 @types/react-dom@19.3.0

# Tests
npm install --save-exact --save-dev vitest@5.0.5 @vitejs/plugin-react@6.1.2 jsdom@30.1.3 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.8
```

Scripts: `"dev": "next dev -p 3000"`, `"build": "next build"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`. The Dockerfile already runs `npm ci` then `npm run build` and copies `/frontend/out`, so the `build` script must produce `out/` and nothing else needs to change in the Dockerfile.

## Required configuration (verified)

`frontend/next.config.ts`

```ts
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

`frontend/postcss.config.mjs`

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`frontend/src/app/globals.css` (theme colors from PLAN section 2)

```css
@import "tailwindcss";

@theme {
  --color-surface: #0d1117;
  --color-accent: #ecad0a;
  --color-primary: #209dd7;
  --color-submit: #753991;
}
```

This produces utilities such as `bg-surface`, `text-accent`, `bg-submit`. Verified in the built CSS.

`frontend/vitest.config.mts`

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./vitest.setup.ts"], css: false },
});
```

`frontend/vitest.setup.ts` (the ResizeObserver stub is mandatory for any test that asserts inside a chart)

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class FixedSizeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const contentRect = { width: 800, height: 400 } as DOMRectReadOnly;
    this.callback([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = FixedSizeResizeObserver;

afterEach(cleanup);
```

`tsconfig.json`: let `next build` generate it, then add `"types": ["node", "vitest/globals", "@testing-library/jest-dom"]` and the `@/*` path alias. Note `next build` auto-edits `tsconfig.json` on first run (adds `plugins: [{name: "next"}]` and `.next/dev/types/**/*.ts` to `include`); commit the result.

## Configuration gotchas (static export + FastAPI StaticFiles)

All items below were observed, not assumed, unless marked otherwise.

1. **`output: 'export'` is incompatible with `rewrites()`, `redirects()`, `headers()`, Server Actions, cookies, and the default image loader** (official docs, updated 2026-08-09). Dev needs `/api` proxied to port 8000, so enable export only for production builds (`output: isDev ? undefined : "export"`) and add the rewrite only in dev, as in the config above. Rewrites never reach the container; production is same-origin by construction. HIGH.

2. **SSE through the `next dev` proxy is buffered by gzip. Set `compress: false`.** Measured: with the default config, `curl --compressed` against `localhost:3100/api/stream/prices` received 0 events in 4 s; with `compress: false` it received 8, matching a direct connection. Without this fix, the dev experience looks like "prices never arrive" while the production build works. The option has no effect on the static export. HIGH.

3. **Static export builds `out/index.html` and `out/404.html`; `StaticFiles(html=True)` serves both correctly.** Verified: `/` and `/index.html` return 200 `text/html`, `/_next/static/chunks/*.js` returns `text/javascript`, unknown paths return 404 with the Next 404 page. Keep a single route (`app/page.tsx`); there is no client-side routing to break and no `trailingSlash` setting is needed. HIGH.

4. **Unknown `/api/*` paths fall through to the `/` static mount and return the HTML 404 page, not JSON.** The mount in `main.py` is registered after all routers, so real endpoints win, but a typo'd URL in the frontend returns HTML with status 404. The frontend fetch helper should treat non-2xx responses by status first and only parse `{"error": ...}` bodies on 400/502. HIGH.

5. **Native `EventSource` reconnects through network-level failures in Chromium.** Verified: after a stream that closes and then connection-refused retries, `readyState` stays `0` (CONNECTING), `onerror` fires on each retry, and `onopen` plus messages resume when the server returns. This matches the existing `test/tests/sse-reconnect.spec.ts` (drop, refuse, recover). Map `onopen` to "connected" and `onerror` with `readyState === 0` to "reconnecting"; only `readyState === 2` (CLOSED, which the HTML spec triggers on a non-200 or wrong-content-type response) is "disconnected", and that case needs a manual re-create of the `EventSource`. The CLOSED path was not exercised in the probe (MEDIUM). Do not add a polyfill or library. HIGH for the network-error path.

6. **Recharts 3 Treemap renders `<path class="recharts-rectangle">`, not `<rect>`, by default.** Verified in Chromium. The existing E2E test asserts `heatmap.locator("svg rect")`. Supply a custom `content` renderer that returns `<rect>` (needed anyway for the P&L green/red fill and text label). The renderer is also called for the root node, so guard on `name`/`depth`. The P&L chart selector `svg path.recharts-curve` is satisfied by a plain `<Line>` (verified). HIGH.

7. **Recharts `ResponsiveContainer` renders nothing in jsdom** (container measures 0x0, so no `<svg>`). Verified: the unit test saw 0 SVGs. With the `ResizeObserver` stub in `vitest.setup.ts` above, the chart rendered (2 SVGs, 3 rects). Without the stub, tests that merely check surrounding DOM still pass; with it, tests can assert on chart output. The parent of every `ResponsiveContainer` needs an explicit height (e.g. `h-64`), or it collapses in the real browser as well. HIGH.

8. **Set `isAnimationActive={false}` on every Recharts series and on Treemap.** Prices update every ~500 ms across 10 sparklines; re-triggering the entry animation on each data change causes visible flicker and wasted work. (Recommendation from the data rate in PLAN; the Treemap and Line props were used in the probe without issue.) MEDIUM.

9. **Client components only; no browser APIs at module scope.** Static export prerenders client components during `next build`. `EventSource`, `window`, and `localStorage` must be touched only inside `useEffect`. Put `"use client"` on every component that uses hooks or Recharts, including the root dashboard component; `app/page.tsx` can stay a server component that renders it. HIGH (official docs).

10. **`next dev` writes `AGENTS.md` into `frontend/` unless `agentRules: false`.** Observed on first run of `next dev` under an AI agent (message: "Generated AGENTS.md ... Set `agentRules: false` in next.config to disable"). The config above disables it to keep the repo clean. Useful alternative: Next 16.4 ships version-matched docs in `node_modules/next/dist/docs/`, which agents can read instead of relying on training data. HIGH.

11. **`frontend/` needs its own `.gitignore`.** The root `.gitignore` has no Node entries (only `test/.gitignore` ignores `node_modules`). Add `node_modules/`, `.next/`, `out/`, `next-env.d.ts`, and `*.tsbuildinfo` under `frontend/`. The root `.dockerignore` already excludes `frontend/node_modules`, `frontend/.next`, and `frontend/out`. HIGH.

12. **Commit `package-lock.json`.** The Dockerfile copies `frontend/package-lock.json` and runs `npm ci`; a missing lockfile is the current build blocker. Generate it with the same major npm used in the image (npm ships with `node:22-slim`; a lockfile from newer npm still works with `npm ci`, verified with a lockfile produced by npm 11). HIGH.

13. **The Next.js `env`/`NEXT_PUBLIC_*` mechanism is not needed.** All calls are same-origin relative paths (`/api/...`). Hard-coding an absolute backend URL would break the container and add a CORS requirement PLAN explicitly rules out. HIGH.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@tailwindcss/postcss` | `@tailwindcss/turbopack` 4.3.3 (a published loader used by the previous frontend at commit `5681c3a`) | Only if the PostCSS path breaks. It requires a `turbopack.rules` entry in `next.config.ts`, and the Tailwind Next.js guide does not mention it. The official PostCSS route was verified end to end, so use it. |
| TypeScript 7.0.2, no ESLint | TypeScript 5.9.3 + ESLint 9/10 + `eslint-config-next` | If the team wants lint rules (react-hooks rules are useful for the SSE effect). See below. |
| jsdom | happy-dom 21.0.3 | Faster, but RTL/jest-dom are validated against jsdom. Switch only if suite time becomes a problem (it will not at this size). |
| Native `EventSource` | `@microsoft/fetch-event-source`, `react-use-websocket` | Only if the stream needs POST or custom headers. The endpoint is a plain GET. |
| Plain React hooks + `fetch` | SWR / TanStack Query | Multi-user or heavy cache invalidation. Not needed for a single-user app with ~6 endpoints. |
| Recharts Treemap with custom `content` | d3-hierarchy / visx treemap | Prohibited by PLAN ("Recharts only"). |
| `output: 'export'` | `output: 'standalone'` (Node server) | Rejected by PLAN: one Python process, one port. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `eslint-config-next` together with TypeScript 7 | `typescript-eslint` (8.71.2 latest) throws "typescript-eslint does not support TS 7.0" at config load. Verified. | Skip ESLint for v1 (the repo has no linter anywhere; `next build` + `tsc --noEmit` already type-check). If lint is wanted, pin `typescript@~5.9.3` and add `eslint` + `eslint-config-next` 16.4.2 together. |
| `next lint` | Removed from Next 16; linting runs through the ESLint CLI directly. | `eslint .` if lint is adopted. |
| `next/image` with the default loader, `rewrites`/`redirects`/`headers` in the production config, Server Actions, Route Handlers reading the request | Unsupported with `output: 'export'`. | `<img>`/inline SVG, `images.unoptimized: true`, plain `fetch` to `/api/*`. |
| Tailwind v3 patterns (`tailwind.config.js`, `@tailwind base;`, `autoprefixer`) | v4 is CSS-first and bundles vendor prefixing; v3 setup guides found online will mislead. | `@import "tailwindcss";` + `@theme { ... }`. |
| WebSocket client libraries, `socket.io-client` | PLAN decides SSE. | Native `EventSource`. |
| A second chart library (lightweight-charts, Chart.js, ECharts) | Violates "Recharts only" and grows the bundle. | Recharts `LineChart`/`AreaChart`/`Treemap`. |
| Recharts default Treemap rectangles | Render `<path>`, fail the existing `svg rect` E2E assertion, and cannot color by P&L. | Custom `content` returning `<rect>`. |
| `moment`, `date-fns` | Timestamps are ISO strings and epoch numbers; `Intl.DateTimeFormat` and `toLocaleTimeString` suffice. | Built-ins. |
| Pinning `node:22.x.y` older than 22.22.2 | jsdom 30 declares `^22.22.2`; `npm ci` warns or fails on engine mismatch. | Floating `node:22-slim` (22.23.3 today). |

## Stack Patterns by Variant

**If TypeScript 7 causes tooling trouble (editor plugin, a library needing the JS compiler API):**
- Pin `typescript@~5.9.3` (latest 5.x is 5.9.3). Next, Vitest, and Recharts accept both; Next falls back to its bundled type checker.
- Because the Next IDE plugin and typescript-eslint need the JS API, this is also the path that enables ESLint.

**If a test needs real chart output (heatmap colors, curve present):**
- Keep the `ResizeObserver` stub in setup, and assert on `svg rect` fill attributes; leave pixel layout to Playwright.

**If the user wants hot reload against the real backend:**
- Run `uv run uvicorn app.main:app --port 8000` in `backend/` and `npm run dev` in `frontend/`; open `http://localhost:3000`. The dev rewrite forwards `/api/*` including the SSE stream (with `compress: false`).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.4.2` | `react@19.3.1`, `react-dom@19.3.1`, Node >=20.9 | Peer range `^19.0.0`; verified together. |
| `tailwindcss@4.3.3` | `@tailwindcss/postcss@4.3.3` | Keep versions identical (the postcss plugin pins `tailwindcss` to the exact same version). |
| `recharts@3.10.1` | `react@19.3.1`, `react-is@19.3.1` | `react-is` is a peer; npm 7+ auto-installs the matching 19.3.1 (verified in `npm ls`). Under pnpm or strict installs, add `react-is@19.3.1` explicitly. Recharts 3 also pulls in `@reduxjs/toolkit`, `react-redux`, `immer`, `es-toolkit`, and `victory-vendor` internally. |
| `vitest@5.0.5` | `vite` 6.4 / 7 / 8; Node `^22.12 \|\| ^24 \|\| >=26` | Installed with Vite 8.3.4 via `@vitejs/plugin-react@6.1.2`. |
| `@vitejs/plugin-react@6.1.2` | `vite@^8` only | Do not downgrade Vite while using plugin-react 6. |
| `@testing-library/react@16.3.3` | `@testing-library/dom@^10`, React 18/19 | The DOM package is a peer and must be listed. |
| `@testing-library/jest-dom@7.0.1` | Vitest via `@testing-library/jest-dom/vitest` | Used in the setup file; verified. |
| `typescript@7.0.2` | Next 16.4.2 (via the project-local `tsc` CLI), Vitest, `@types/*` | Not compatible with `typescript-eslint`. |
| `jsdom@30.1.3` | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26` | Local dev machine runs Node 26.9.0, which is fine; the container uses Node 22. |

## Sources

- npm registry (`npm view <pkg> version/peerDependencies/engines`, queried 2026-10-16): next 16.4.2, react 19.3.1, recharts 3.10.1, tailwindcss and @tailwindcss/postcss 4.3.3, typescript 7.0.2, vitest 5.0.5, @vitejs/plugin-react 6.1.2, jsdom 30.1.3, @testing-library/* versions above, typescript-eslint 8.71.2. HIGH.
- https://nextjs.org/docs/app/guides/static-exports (last updated 2026-08-09): config, supported and unsupported features. HIGH.
- https://nextjs.org/docs/app/api-reference/config/typescript (2026-08-25): "Using TypeScript 7" section. HIGH.
- https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack (2026-09-24): Turbopack handles CSS natively. HIGH.
- https://tailwindcss.com/docs/guides/nextjs: install with `@tailwindcss/postcss`, `postcss.config.mjs`, `@import "tailwindcss"`. HIGH.
- https://github.com/recharts/recharts/wiki/3.0-migration-guide: `accessibilityLayer` now defaults to true, `activeIndex` removed, Tooltip typing change (`TooltipContentProps`). HIGH.
- Empirical probe in the session scratchpad (build, serve through `backend/app/main.py`, Chromium via the repo's Playwright install, Vitest run, `node:22-slim` build, dev-proxy SSE test, EventSource reconnect test). HIGH for the observed behaviors.
- Existing repo files: `Dockerfile`, `backend/app/main.py`, `test/tests/*.spec.ts` (selectors), `.planning/PROJECT.md`, `planning/PLAN.md`; prior frontend package list at commit `5681c3a` (reference only). HIGH.
- Not exercised: `EventSource` behavior on a non-200 response (spec-based, MEDIUM); TS 7 in editors (not tested, MEDIUM).

---
*Stack research for: Next.js static-export trading workstation frontend*
*Researched: 2026-10-16*
