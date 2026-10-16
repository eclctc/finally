# Phase 1: Walking Skeleton - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 22 new (frontend/ is empty; nothing modified)
**Analogs found:** 17 / 22 (all analog paths are git-tracked; old-frontend analogs are read-only via `git show 5681c3a:<path>`)

Precedence: RESEARCH.md code examples win over the old frontend (Tailwind via @tailwindcss/postcss, `@theme static`, system font stack, TS 7, no ESLint).

## File Classification

| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `frontend/package.json`, `package-lock.json` | config | build | RESEARCH.md install block; `test/package.json` (private, exact pins) | partial |
| `frontend/.gitignore` | config | - | `5681c3a:frontend/.gitignore` | exact |
| `frontend/next.config.ts` | config | build / dev proxy | RESEARCH.md Code Examples (STACK.md verified) | spec |
| `frontend/postcss.config.mjs` | config | build | RESEARCH.md Code Examples | spec |
| `frontend/tsconfig.json` | config | build | `5681c3a:frontend/tsconfig.json` | role-match |
| `frontend/vitest.config.mts`, `vitest.setup.ts` | config/test | - | RESEARCH.md Code Examples | spec |
| `frontend/src/app/globals.css` | config (theme) | - | RESEARCH.md `@theme static` block | spec |
| `frontend/src/app/layout.tsx` | component | request-response | `5681c3a:frontend/src/app/layout.tsx` (minus next/font) | role-match |
| `frontend/src/app/page.tsx` | component | - | `5681c3a:frontend/src/app/page.tsx` | exact |
| `frontend/src/components/Dashboard.tsx` | component | request-response | `5681c3a:.../Dashboard.tsx` (strip all hooks) | partial |
| `frontend/src/components/Header.tsx` | component | request-response (one-shot GET) | `5681c3a:.../Header.tsx` + RESEARCH.md Header | exact |
| `frontend/src/components/Panel.tsx` | component | - | `5681c3a:.../Panel.tsx` | exact |
| `frontend/src/components/Header.test.tsx` | test | - | `5681c3a:.../Header.test.tsx` | role-match |
| `frontend/src/lib/testIds.ts` | utility | - | `test/tests/*.spec.ts` ids | exact |
| `frontend/src/lib/format.ts` | utility | transform | `test/tests/helpers.ts` parseNumber rule + RESEARCH.md | spec |
| `frontend/src/lib/api.ts` | utility | request-response | RESEARCH.md `request<T>()` | spec |
| `frontend/src/lib/{format,testIds,api}.test.ts` | test | - | `test/tests/helpers.ts` (parse rule) | partial |
| `frontend/src/test/harness.test.tsx` | test | event-driven | none in repo; RESEARCH.md description | none |

## Pattern Assignments

### `frontend/src/components/Panel.tsx` (component)
**Analog:** `git show 5681c3a:frontend/src/components/Panel.tsx`. Copy as is. Uses `border-line bg-panel` and `text-muted` tokens, so theme token names must match RESEARCH.md (`line`, `panel`, `muted`).
```tsx
interface PanelProps { title: string; testId?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode; dataAttributes?: Record<string, string>; }
export function Panel({ title, testId, actions, className = "", children, dataAttributes }: PanelProps) {
  return (
    <section data-testid={testId} {...dataAttributes} className={`flex min-h-0 flex-col border border-line bg-panel ${className}`}>
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <h2 className="text-[12px] font-medium text-muted">{title}</h2>{actions}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
```
Phase 1 simplification: take testId from `testIds` (import), drop `dataAttributes` if unused.

### `frontend/src/components/Header.tsx` (component, one-shot GET /api/portfolio)
**Analog:** `5681c3a:frontend/src/components/Header.tsx` for layout (`Figure` label wrapper, `h-14 border-b border-line bg-panel px-4`, brand `Fin<span className="text-accent">Ally</span>`). Data fetching: RESEARCH.md "Header with the one real backend read" (`useEffect` + `request<PortfolioSummary>("/api/portfolio")`).
Rules to carry over (from helpers.ts lines 3-11):
```ts
export function parseNumber(text: string): number { return Number(text.replace(/[^0-9.-]/g, "")); }
```
- `cash-balance` / `total-value` elements contain ONLY the formatted number (or `--`); labels go in sibling `Figure` label spans.
- Old Header took props and had P&L plus a ConnectionDot; Phase 1 drops P&L and renders a static `<span data-testid=connectionStatus data-status="disconnected">`. Fetch inside `useEffect` only (prerender safe).

### `frontend/src/components/Header.test.tsx` (test)
**Analog:** `5681c3a:frontend/src/components/Header.test.tsx`; adapt: Header now fetches, so stub `fetch` (`vi.stubGlobal("fetch", ...)` returning `{ok:true, json: async()=>({cash_balance:10000,total_value:10000})}`), then `await screen.findByTestId(testIds.cashBalance)` and `toHaveTextContent("$10,000.00")`; keep the `"--"` pre-load case.
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
expect(screen.getByTestId("cash-balance")).toHaveTextContent("$10,000.00");
expect(screen.getByTestId("connection-status")).toHaveAttribute("data-status", "disconnected");
```

### `frontend/src/app/layout.tsx` / `page.tsx`
**Analog:** `5681c3a:frontend/src/app/{layout,page}.tsx`. Keep `Metadata {title:"FinAlly"}`, `<html lang="en">`, `<body className="antialiased">`, `import "./globals.css"`. REMOVE the `next/font/google` imports and `className` font variables (system stack lives in `@theme static`). page.tsx verbatim:
```tsx
import { Dashboard } from "@/components/Dashboard";
export default function Home() { return <Dashboard />; }
```

### `frontend/src/components/Dashboard.tsx`
**Analog:** `5681c3a:.../Dashboard.tsx` header only: `"use client";` then composition of `<Header />` and `<Panel>` placeholders. Discard all hooks/imports (usePriceStream, useChat, etc.). Placeholder panels may carry `watchlist`, `positions-table`, `heatmap`, `pnl-chart`, `chat-panel` testids; NOT `watchlist-row-*` or `main-chart`.

### `frontend/src/lib/testIds.ts` (utility)
**Analog:** the specs in `/Users/brett/Projects/finally/test/tests/*.spec.ts`; the full table is in RESEARCH.md "testIds.ts contract". Copy that object verbatim. Include comment: no other id in the watchlist may start with `watchlist-row-` (fresh-start.spec counts `[data-testid^="watchlist-row-"]` == 10). `trade-${side}` in trading.spec requires `trade-buy`/`trade-sell` exact.
Parity test (`testIds.test.ts`): read `path.resolve(__dirname, "../../../test/tests")` with `node:fs`; regex for `getByTestId(...)` and `[data-testid^=...]`; normalize template ids at `${`.

### `frontend/src/lib/format.ts` and `format.test.ts`
**Analog:** RESEARCH.md format block (Intl.NumberFormat en-US, `cents()` with `+ 0` to kill -0). Test using the spec rule from `test/tests/helpers.ts:4-6`:
```ts
const parse = (t: string) => Number(t.replace(/[^0-9.-]/g, ""));
expect(parse(formatCurrency(10000))).toBe(10000);   // "$10,000.00"
expect(parse(formatCurrency(-0.004))).toBe(0);      // not -0 (use Object.is / toBe(0))
expect(parse(formatCurrency(-5))).toBe(-5);         // "-$5.00"
expect(formatPercent(0.0123)).toBe("+1.23%");
```
Avoid unicode minus, K/M abbreviations, units.

### `frontend/src/lib/api.ts`
Copy RESEARCH.md `ApiError` + `request<T>()` verbatim; relative paths only. Backend errors are `{"error": "..."}` (not FastAPI `detail`). Test with stubbed `fetch`: ok JSON, `{error}` 400, HTML 404 gives `Request failed (404)`.

### Config files
- `.gitignore`: copy `5681c3a:frontend/.gitignore` (lines include `/node_modules`, `/.next/`, `/out/`, `*.tsbuildinfo`, `next-env.d.ts`, `.env*`).
- `tsconfig.json`: start from `5681c3a:frontend/tsconfig.json` (target ES2017, strict, noEmit, bundler resolution, jsx react-jsx, `plugins:[{name:"next"}]`, paths `@/*`, include incl. `**/*.mts` and `.next/dev/types/**/*.ts`). ADD `"types": ["node","vitest/globals","@testing-library/jest-dom"]` (Pitfall 7). Let `next build` regenerate once, then commit. TS 7 may change defaults; re-run `npm run typecheck`.
- `next.config.ts`, `postcss.config.mjs`, `globals.css`, `vitest.config.mts`, `vitest.setup.ts`: copy RESEARCH.md Code Examples verbatim (dev-only rewrite, `compress:false`, `@theme static`, three stubs).
- `package.json`: model `private: true` and exact-pin style on `/Users/brett/Projects/finally/test/package.json`; scripts `dev` (`next dev -p 3000`), `build`, `test` (`vitest run`), `typecheck`. Lockfile from a clean dir.

### `frontend/src/test/harness.test.tsx`
No analog. Follow RESEARCH.md "Harness smoke test": in-file component using `new EventSource("/api/stream/prices")`, `ResizeObserver`, `scrollIntoView`, Recharts `ResponsiveContainer > LineChart` in fixed-height parent; assert svg present, `FakeEventSource.instances[0].url`, `scrollIntoView` called. Import `FakeEventSource` from `../../vitest.setup`.

## Shared Patterns

### Backend serving contract (do not modify)
`/Users/brett/Projects/finally/backend/app/main.py:69-70`: static mount registered after all routers, so `/api/*` wins:
```python
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
```
Dockerfile (`/Users/brett/Projects/finally/Dockerfile:2-7,24`): `COPY frontend/package.json frontend/package-lock.json ./`, `npm ci`, `COPY frontend/ ./`, `npm run build`, then `COPY --from=frontend /frontend/out ./static`. So the build must emit `out/index.html`, and both lockfile and package.json must be committed.

### testids and number formatting
Every `data-testid` comes from `testIds` (components and tests). Number elements contain bare numbers only.

### Client-only code
No `window`/`EventSource`/`fetch` at module scope; use `useEffect`. Fixed `en-US` locale to avoid hydration mismatch.

### Theme tokens
Use utilities from `@theme static`: `bg-surface`, `bg-panel`, `border-line`, `text-text`, `text-muted`, `text-accent`, `text-primary`, `bg-submit`, `text-up`, `text-down`; `.figures` class for tabular mono numbers.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `src/test/harness.test.tsx` | test | No Vitest tests exist in the repo; use RESEARCH.md recipe |
| `vitest.config.mts` / `vitest.setup.ts` | config | Old frontend vitest files are superseded by RESEARCH.md (adds EventSource and scrollIntoView stubs) |
| `next.config.ts`, `postcss.config.mjs`, `globals.css` | config | Old versions used turbopack loader and next/font; use RESEARCH.md |

## Metadata

**Analog search scope:** `/Users/brett/Projects/finally/{Dockerfile,backend/app/main.py,test/}`, git `5681c3a:frontend/`
**Files scanned:** about 12
**Pattern extraction date:** 2026-10-16
