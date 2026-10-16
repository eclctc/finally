---
phase: 01-walking-skeleton
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - README.md
  - frontend/.gitignore
  - frontend/next.config.ts
  - frontend/package.json
  - frontend/postcss.config.mjs
  - frontend/src/app/globals.css
  - frontend/src/app/layout.tsx
  - frontend/src/app/page.tsx
  - frontend/src/components/Dashboard.test.tsx
  - frontend/src/components/Dashboard.tsx
  - frontend/src/components/Header.test.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/Panel.tsx
  - frontend/src/lib/api.test.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/format.test.ts
  - frontend/src/lib/format.ts
  - frontend/src/lib/testIds.test.ts
  - frontend/src/lib/testIds.ts
  - frontend/src/test/harness.test.tsx
  - frontend/tsconfig.json
  - frontend/vitest.config.mts
  - frontend/vitest.setup.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The Phase 1 frontend skeleton is small and mostly sound. `npx vitest run` passes (6 files, 35 tests) and `npx tsc --noEmit` is clean. The numeric testid elements (`cash-balance`, `total-value`) contain only the formatted number, with labels kept in sibling elements, so the E2E `parseNumber` contract holds. The `--` placeholder parses to NaN, which `expect.poll` retries until the real figure arrives. The `!/src/lib/` override in `frontend/.gitignore` works: `git check-ignore` reports `src/lib` files as not ignored.

I found no security issues and no blockers. There are three warnings (inconsistent cent rounding in the money formatter, an ARIA misuse on the connection dot, and a test that can pass vacuously). The info items are small.

## Warnings

### WR-01: `cents()` pre-rounding disagrees with Intl rounding and rounds ties asymmetrically

**File:** `frontend/src/lib/format.ts:5`
**Issue:** `Math.round(n * 100) / 100 + 0` is a second, different rounding pass applied before `Intl.NumberFormat` rounds. It changes the displayed value relative to plain Intl in both directions. I ran these in node:

| Input | Plain Intl | After `cents()` |
|---|---|---|
| `1.005` | `1.01` | `1.00` |
| `-0.005` | `-0.01` | `0.00` |
| `0.005` | `0.01` | `0.01` |

Ties go toward +infinity for negatives but away from zero for positives, so `-0.005` shows `$0.00` while `0.005` shows `$0.01`. `format.test.ts:12-21` locks this behavior in as intended. The only real purpose is to remove `-0` and "-$0.00" for tiny negatives. A multiply-and-divide by 100 on arbitrary floats is a rounding source of its own, and the displayed cash and total can drift by a cent from the backend's rounding. Later phases will compare these figures with API values.
**Fix:** Drop the pre-rounding and only suppress the negative zero:
```ts
const noNegativeZero = (n: number) => (Math.abs(n) < 0.005 ? 0 : n);

export const formatCurrency = (n: number) => currency.format(noNegativeZero(n));
export const formatPrice = (n: number) => decimal2.format(noNegativeZero(n));
```
Update the "ties toward positive infinity" test accordingly.

### WR-02: Connection status dot uses `aria-label` on a generic `span`

**File:** `frontend/src/components/Header.tsx:56-62`
**Issue:** `aria-label` on a `span` with no role is not reliably exposed by assistive tech, and ARIA prohibits naming role-less generic elements. The connection state is otherwise conveyed only by color and a hover `title`, so screen-reader users get nothing. The same markup will be reused when the real connected/reconnecting states land.
**Fix:** Give the dot a role, for example `role="img"` with the `aria-label`, or `role="status"` with visually hidden text.

### WR-03: Testid parity test can pass vacuously for template ids

**File:** `frontend/src/lib/testIds.test.ts:40-44`
**Issue:** For template-literal spec ids the prefix before `${` is checked with `[...knownIds].some((known) => known.startsWith(id))`. A spec using `` getByTestId(`${x}`) `` yields `id === ""`, and `startsWith("")` is true for every known id, so the check passes for anything. Any prefix such as `trade-` also passes, because one known id starts with it, even if the spec builds an id that does not exist (for example `trade-${side}` with a bad side). This test is the only automated guard on the E2E contract, so false passes defeat its purpose.
**Fix:** In `isCovered`, reject empty prefixes (`id !== ""`). Better, make `extractIds` collect the real candidate values, or add an explicit allow-list of the known template shapes (`watchlist-row-`, `trade-${side}` with side in buy/sell) and fail on any other template.

## Info

### IN-01: `request` throws a raw `SyntaxError` on a 2xx response with a non-JSON or empty body

**File:** `frontend/src/lib/api.ts:10`
**Issue:** The error path handles a non-JSON body (`.catch(() => null)`), but the success path calls `response.json()` unguarded. A 204 or empty 2xx response rejects with a `SyntaxError`, not an `ApiError`, so callers cannot rely on `instanceof ApiError`. No current endpoint returns an empty 2xx body (the planned `DELETE /api/watchlist/{ticker}` may). Keep this in mind when the watchlist client is added.
**Fix:** Handle `response.status === 204` explicitly when the first empty-body endpoint is added. Do not add speculative guards now.

### IN-02: Tests assert Phase 1 placeholder state that the next phase must delete

**File:** `frontend/src/components/Dashboard.test.tsx:26-30`, `frontend/src/components/Header.test.tsx:41-48`
**Issue:** "attaches no watchlist row testids and no main chart testid yet" and "starts disconnected because Phase 1 opens no price stream" assert the absence of features the E2E contract requires. They will fail as soon as the watchlist, chart and stream land, and they test nothing about the current code's correctness.
**Fix:** Remove or replace them when those features are added. Do not let them gate the next phase.

### IN-03: `frontend/.gitignore` ignores every `.env*` file

**File:** `frontend/.gitignore:34`
**Issue:** `.env*` also ignores a future `frontend/.env.example`. The frontend reads no env vars today, so this is harmless now. The comment says opt-in is possible.
**Fix:** Add `!.env.example` if the frontend ever needs one.

### IN-04: No `color-scheme: dark`, so native scrollbars and form controls render light

**File:** `frontend/src/app/globals.css:18`
**Issue:** `Panel` uses `overflow-y-auto` on a dark surface, and the trade and chat inputs are coming. Without `color-scheme: dark`, browsers draw light scrollbars and default inputs on the dark theme.
**Fix:** `html { color-scheme: dark; }` in `globals.css`.

### IN-05: `"use client"` on `Dashboard` is unnecessary

**File:** `frontend/src/components/Dashboard.tsx:1`
**Issue:** `Dashboard` uses no hooks, state or browser APIs. `Header` already declares its own client boundary, so this directive only widens the client bundle boundary. It will become necessary if `Dashboard` later hosts shared state, which looks likely.
**Fix:** Remove it for now, or leave it deliberately if shared stream state is planned in `Dashboard`.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
