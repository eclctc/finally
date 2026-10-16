# Phase 5: AI Chat - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 27 (13 new source, 8 modified source, 6 new/modified tests)
**Analogs found:** 25 / 27 (all analog paths verified git-tracked; paths relative to `/Users/brett/Projects/finally/frontend/` unless absolute)

Tag `[PHASE 4 FILE]` = file does not exist on disk; analog source is `/Users/brett/Projects/finally/.planning/phases/04-trading-portfolio/04-PATTERNS.md`. Reconcile against Phase 4's final plans before writing Phase 5 plans (05-RESEARCH "Phase 4 seams" S1-S12).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/chat.ts` (N) | utility | transform | `src/lib/portfolioValue.ts` (pure helpers + types) and `src/lib/format.ts` | role-match |
| `src/lib/aiChangeStore.ts` (N) | store | event-driven (timers + pub-sub) | `src/lib/priceStore.ts` | exact |
| `src/lib/useAiChange.ts` (N) | hook | pub-sub | `useTickerHistory` in `src/lib/usePrice.ts` | exact |
| `src/lib/useChat.ts` (N) | hook | request-response | `src/lib/useWatchlist.ts` (`add`) | role-match |
| `src/lib/useWatchlist.ts` (M, return `load`) | hook | request-response | itself | exact (self) |
| `src/lib/testIds.ts` (M, add `chatToggle`, `chatChip`) | config | n/a | itself | exact (self) |
| `src/components/Panel.tsx` (M, `actions` prop) | component | n/a | itself | exact (self) |
| `src/components/ChatDock.tsx` (N) | component (state owner) | request-response | `src/components/Dashboard.tsx` (aside) + `Watchlist.tsx` (hook owner) | role-match |
| `src/components/ChatPanel.tsx`, `ChatTranscript.tsx`, `ChatComposer.tsx`, `ChatChips.tsx`, `ChatRail.tsx` (N) | component | request-response | `src/components/Watchlist.tsx` (Panel + `flex h-full min-h-0 flex-col`, form, alert) | role-match |
| `src/components/Dashboard.tsx` (M) | component | request-response | itself; lift pattern from 04-PATTERNS | exact (self) |
| `src/components/Watchlist.tsx` (M, takes hook result as prop) | component | request-response | itself | exact (self) |
| `src/components/WatchlistRow.tsx` (M, `useAiChange`) | component | pub-sub | itself | exact (self) |
| `src/components/PositionRow.tsx` (M) `[PHASE 4 FILE]` | component | pub-sub | 04-PATTERNS "PositionsTable / PositionRow" | n/a (not on disk) |
| `vitest.setup.ts` (M, `resetAiChanges()`) | test util | n/a | itself (`resetPriceStore()`) | exact (self) |
| `src/lib/chat.test.ts` (N) | test | n/a | `src/lib/priceStore.test.ts`, `src/lib/format.test.ts` | role-match |
| `src/lib/aiChangeStore.test.ts` (N) | test | n/a | `src/lib/priceStore.test.ts` | exact |
| `src/components/ChatDock.test.tsx` (N) | test | n/a | `src/components/Watchlist.test.tsx` (fetch stub, userEvent) | role-match |
| `src/components/Dashboard.test.tsx` (M) | test | n/a | itself | exact (self) |
| `src/components/Watchlist.test.tsx` (M, harness) | test | n/a | itself | exact (self) |
| `src/test/fixtures.ts` (M, `makeChatReply`) | test util | n/a | itself | exact (self) |

## Pattern Assignments

### `src/lib/aiChangeStore.ts` (store, event-driven) - NEW

**Analog:** `src/lib/priceStore.ts` (module-level Maps, `Set<Listener>`, `subscribeTo`, explicit reset for tests). Reuse its shape:

`priceStore.ts` ~lines 104-130 (subscribe helper style) and `clearTicker` (lines 86-92):
```typescript
export function clearTicker(ticker: string) {
  entries.delete(ticker);
  histories.delete(ticker);
  notify(tickerListeners.get(ticker));
  version += 1;
  notify(versionListeners);
}
export const getEntry = (ticker: string) => entries.get(ticker);
```
Copy: module `Map`s, `/** */` one-line doc on each export, getter returning a primitive/`undefined`, `reset*` clearing everything. Full target code is 05-RESEARCH Pattern 7 (`markAiChanged`, `getAiChange`, `subscribeAiChanges`, `resetAiChanges`, `AI_HIGHLIGHT_HOLD_MS = 1500`, `AI_HIGHLIGHT_FADE_MS = 1000`). Snapshot must be a primitive (`"hold" | "fade" | null`).

### `src/lib/useAiChange.ts` (hook, pub-sub) - NEW

**Analog:** `src/lib/usePrice.ts` `useTickerHistory` (04-PATTERNS cites lines 21-25):
```typescript
export function useTickerHistory(ticker: string): readonly number[] {
  const subscribe = useCallback((listener: () => void) => subscribeTicker(ticker, listener), [ticker]);
  return useSyncExternalStore(subscribe, () => getHistory(ticker), () => EMPTY_HISTORY);
}
```
Copy as `useAiChange(kind, ticker)` using `useSyncExternalStore(subscribeAiChanges, () => getAiChange(kind, ticker), () => null)`. Add `aiHighlightClass(phase, resting)` lookup with full literal Tailwind strings; style reference for the literal-class lookup is `FlashingPrice.tsx` lines 11-16:
```typescript
const FLASH_CLASS = {
  up: "bg-up/25 transition-none motion-reduce:bg-transparent",
  down: "bg-down/25 transition-none motion-reduce:bg-transparent",
};
const IDLE_CLASS = "bg-transparent transition-colors duration-500 ease-out motion-reduce:transition-none";
```

### `src/lib/chat.ts` (utility, transform) - NEW

**Analog:** `src/lib/portfolioValue.ts` (exported types plus pure doc-commented functions) and `src/lib/format.ts` (`formatPrice`, `formatQuantity`, fixed `en-US`). Imports pattern:
```typescript
import { formatPrice, formatQuantity } from "./format";
import type { AiChangeKind } from "./aiChangeStore";
```
Body (types `ChatAction`/`ChatReply`, `QUICK_PROMPTS`, `describeAction`, `aiChangeTargets`, `removedTickers`) is verbatim in 05-RESEARCH "Contract" and Pattern 3. Do not add a formatter.

### `src/lib/useChat.ts` (hook, request-response) - NEW

**Analog:** `src/lib/useWatchlist.ts`.

Imports and error mapping (lines 3-9):
```typescript
import { useCallback, useEffect, useState } from "react";
import { ApiError, request } from "./api";
const NETWORK_ERROR = "Request failed. Try again.";
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : NETWORK_ERROR);
```
Request shape (lines 39-43):
```typescript
await request("/api/watchlist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ticker }),
});
```
Copy the POST shape with `/api/chat` and `{ message: text }`. Do not duplicate `errorMessage` a third time: Phase 4 `TradeBar` also needs it, so export it from `src/lib/api.ts` (04-PATTERNS: "Export or share `errorMessage` rather than duplicating it"). State machine (messages, attempt slot, draft; call `onActionsApplied` after the try/catch) is 05-RESEARCH Pattern 2.

### `src/lib/useWatchlist.ts` (M)

Line 76 currently: `return { tickers, loadFailed, error, adding, removing, add, remove, clearError };`. Add `load` (already a stable `useCallback(..., [])`, lines 19-28). Note `load` swallows errors (`catch { setLoadFailed(true); }`, lines 25-27), so `await Promise.all([...])` cannot detect a failed refresh (05-RESEARCH Open Question 1).

### `src/components/Panel.tsx` (M, add `actions`)

Current (lines 3-8 and 19-21):
```tsx
interface PanelProps { title: string; testId?: string; className?: string; children?: React.ReactNode; }
<header className="flex h-8 shrink-0 items-center border-b border-line px-2">
  <h2 id={titleId} className="truncate text-[11px] font-semibold text-muted">{title}</h2>
</header>
```
Add `actions?: React.ReactNode` to the props and render `{actions && <div className="ml-auto">{actions}</div>}` after the `h2`. Existing callers unaffected.

### `src/components/ChatDock.tsx` (state owner) and Chat* views - NEW

**Analog (aside to replace):** `Dashboard.tsx` lines 28-30:
```tsx
<aside className="w-[320px] shrink-0">
  <Panel title="AI Chat" testId={testIds.chatPanel} className="h-full" />
</aside>
```
`ChatDock` renders this `aside` itself with `w-[320px]` / `w-10` (the existing Dashboard test asserts `getByRole("complementary")).toHaveClass("w-[320px]")`, line 48, which still holds open). Code in 05-RESEARCH Pattern 1.

**Analog (panel body layout, form, alert):** `Watchlist.tsx`:

Structure (lines 86-88, 122-125): `<Panel ...><div className="flex h-full min-h-0 flex-col"><div className="shrink-0 border-b border-line">...form...</div><div className="min-h-0 flex-1 overflow-y-auto">` : use the same `flex h-full min-h-0 flex-col` with transcript `min-h-0 flex-1 overflow-y-auto` and composer `shrink-0`.

Class constants to reuse/derive for textarea and Send (lines 44-47):
```typescript
const INPUT_CLASS =
  "h-7 min-w-0 flex-1 border bg-surface px-2 text-text placeholder:text-muted focus-visible:outline-2 outline-primary";
const BUTTON_CLASS =
  "h-7 bg-submit px-4 font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 outline-primary";
```
Textarea: swap `h-7` for `h-14 resize-none py-1`; Send adds `self-end`. Form submit (lines 66-75) and input attrs (lines 90-106: `autoComplete="off"`, `spellCheck={false}`, `aria-label`, `border-line focus:border-primary`):
```tsx
<form onSubmit={handleSubmit} className="flex gap-2 p-2">
  <input ref={inputRef} data-testid={testIds.watchlistAddInput} ... autoComplete="off" spellCheck={false} />
  <button type="submit" disabled={adding || draft.trim() === ""} className={BUTTON_CLASS}>Add</button>
</form>
```
Error and loading lines (lines 28-30, 33; same copy classes for `chat-error` / `chat-loading`):
```tsx
<p role="alert" className="break-words px-2 py-2 text-down">...</p>
<p className="px-2 py-2 text-muted">Loading watchlist...</p>
```
Empty state (lines 9-16): `<div className="py-12 text-center">` : reuse for `Ask FinAlly about your portfolio.` (`text-muted`).

Auto-scroll: `row.scrollIntoView({ block: "nearest" })` in `Watchlist.tsx` line 62 is the in-repo `scrollIntoView` precedent; jsdom stub at `vitest.setup.ts` line 47. `sr-only` precedent: `ConnectionDot.tsx` line 21. No in-repo analog for `role="log"`, conditional `autoFocus`, or `[writing-mode:vertical-rl]`: use 05-RESEARCH Patterns 1, 2, 6.

Action list component: copy the 05-RESEARCH "Chat action list" example verbatim (`data-testid={testIds.chatAction}`, `data-status`).

### `src/components/Dashboard.tsx` (M)

**Analog:** itself (lines 11-34, shown above). Changes: call `useWatchlist()` here and pass to `<Watchlist watchlist={watchlist} .../>` (currently `<Watchlist />` at line 19); Phase 4 supplies `usePortfolio()`/`usePortfolioHistory()` `[PHASE 4 FILE]`; add `applyChatActions` (05-RESEARCH Pattern 4); replace the `aside` block (lines 28-30) with `<ChatDock onActionsApplied={applyChatActions} />`. Keep `useEffect(() => connectPriceStream(), [])` (line 12). `clearTicker` import comes from `@/lib/priceStore`.

### `src/components/Watchlist.tsx` (M)

Line 51 `const { tickers, loadFailed, error, adding, removing, add, remove, clearError } = useWatchlist();` becomes a destructure of the `watchlist` prop. Everything else (add form, `handleRemove` `useCallback` lines 77-83) unchanged. Phase 4 adds `selectedTicker`/`onSelect` props first `[PHASE 4 FILE edits]`; rebase on them.

### `src/components/WatchlistRow.tsx` (M)

Current `li` (line 30): `<li data-testid={testIds.watchlistRow(ticker)} className="flex h-7 items-center gap-1 px-2">`. Add `const aiPhase = useAiChange("watchlist", ticker);` next to the store hooks (lines 26-27), `data-ai-changed={aiPhase ? "true" : undefined}`, and class from `aiHighlightClass(aiPhase, selected ? "surface" : "transparent")` so only one `bg-*` utility is active. Keep `memo(...)` (line 25); no new props. `selected` comes from Phase 4's edit of this file.

### `PositionRow` `[PHASE 4 FILE]`

Analog per 04-PATTERNS: `WatchlistRow.tsx` (memo row subscribed per ticker) with `<tr data-testid={testIds.positionRow(ticker)}>`, no hover, no click. Phase 5 adds `useAiChange("position", ticker)`, `data-ai-changed`, resting `"transparent"`. Edit wherever Phase 4 actually puts it.

### `src/lib/testIds.ts` (M)

Add after line 28 (`chatError: "chat-error",`): `chatToggle: "chat-toggle",` and `chatChip: "chat-chip",`. Existing chat ids (`chatPanel`..`chatError`) and `positionRow` already exist. Parity test (`src/lib/testIds.test.ts`) only checks spec ids are known.

### `vitest.setup.ts` (M)

Lines 49-53:
```typescript
afterEach(() => {
  cleanup();
  FakeEventSource.instances = [];
  resetPriceStore();
});
```
Add `import { resetAiChanges } from "./src/lib/aiChangeStore";` beside line 4 and `resetAiChanges();` after `resetPriceStore();`.

## Test patterns

### Fetch stub and component tests
**Analog:** `src/components/Watchlist.test.tsx` lines 1-24:
```typescript
const stubWatchlist = (...entries) =>
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ tickers: entries }))));
afterEach(() => vi.unstubAllGlobals());
// pending: vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
// rejecting: vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("socket hang up"))));
// 502: jsonResponse({ error: "boom" }, 500)
```
Imports: `render, screen, waitFor, within, act` from RTL, `userEvent`, `jsonResponse` from `@/test/fixtures`. For `ChatDock.test.tsx`: deferred reply for the loading state, `jsonResponse({ error: "..." }, 502)` for CHAT-04, a path-and-method routing stub for the Dashboard integration (model on `Dashboard.test.tsx` lines 71-82, which routes by `path === "/api/watchlist"`). XSS test: `<img src=x onerror=...>` in message, ticker and error asserting no `img` (Phase 3 T-03-11 style, per 04-PATTERNS).

### Fixtures
`src/test/fixtures.ts` (lines 1-34): plain arrow builders with one-line doc comments; `jsonResponse(body, status = 200)` at line 33. Add `makeChatReply(message, actions = [])` and action builders the same way. Phase 4 adds `makePortfolio`, `makePosition`, `makeTradeResponse`, `makeSnapshot` `[PHASE 4 FILE]`: reuse, do not redefine.

### Store tests
`src/lib/priceStore.test.ts` lines 1-25: import named exports plus `resetPriceStore`; small local helper builders. For `aiChangeStore.test.ts` use fake timers: `vi.useFakeTimers()` before `markAiChanged`, `act(() => vi.advanceTimersByTime(...))`, `vi.useRealTimers()` in `afterEach`; with fake timers use `fireEvent` or `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. Timing test sketch in 05-RESEARCH "Test: highlight timing".

### Existing tests that must change
- `Dashboard.test.tsx`: line 48 holds open; add collapsed `w-10` assertion; line 28/35 headings still include `AI Chat`; line 53 `chatPanel` testid holds. Phase 4 also edits this file: rebase.
- `Watchlist.test.tsx`: every `render(<Watchlist />)` (lines 29, 40, 51, ...) must supply the lifted hook; use Phase 4's `renderWatchlist()` helper if it exists, else add one that calls `useWatchlist()` in a wrapper.
- E2E `/Users/brett/Projects/finally/test/tests/chat.spec.ts`: do not edit; selector map in 05-RESEARCH is satisfied.

## Shared Patterns

### Backend request and error text
**Source:** `src/lib/api.ts` lines 7-13:
```typescript
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (response.ok) return response.json() as Promise<T>;
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
}
```
**Apply to:** `useChat`. A 502 `{error}` becomes `ApiError.message`; a `fetch` rejection maps to `Request failed. Try again.`. No new fetch wrapper.

### Module store + `useSyncExternalStore`
**Source:** `src/lib/priceStore.ts` + `src/lib/usePrice.ts`. **Apply to:** `aiChangeStore`/`useAiChange`. Primitive snapshots; explicit reset registered in `vitest.setup.ts`.

### Reduced motion and literal Tailwind classes
**Source:** `FlashingPrice.tsx` lines 11-16 (`motion-reduce:` variants, full literal strings). **Apply to:** `aiHighlightClass`. Assert on `data-ai-changed`, never class strings.

### Untrusted text
**Source:** Phase 3 rule (text nodes only), e.g. `Watchlist.tsx` line 117-119 `{error}` rendered as a child. **Apply to:** every bubble, chip, and error in the chat. No `dangerouslySetInnerHTML`, no markdown.

### Component conventions
`"use client"` at top of any file using hooks; `@/` alias imports; `/** */` one-line doc on exports; token classes only (`bg-surface`, `bg-panel`, `border-line`, `text-muted`, `text-down`, `bg-submit`, `outline-primary`), `figures` for mono numbers; no emojis; no new npm dependency.

### Refresh-then-mark ordering
`removedTickers(actions).forEach(clearTicker)` before `load()` mirrors the manual remove (`useWatchlist.ts` line 62 then `finally { await load(); }` line 67). Mark rows only after `Promise.all([watchlist.load(), refresh(), refreshHistory()])` settles; `refresh`/`refreshHistory` come from Phase 4 `[PHASE 4 FILE]` (currently `usePortfolio.refresh` returns void, lines 10-17 of `usePortfolio.ts`, so Phase 4 must make it return a promise or Phase 5 falls back to marking after `watchlist.load()`).

## No Analog Found

| File / feature | Role | Data Flow | Reason |
|---|---|---|---|
| `ChatRail.tsx` (vertical-label button, `[writing-mode:vertical-rl]`) | component | event-driven | No vertical or rail UI exists; follow UI-SPEC "Collapsed rail" |
| Transcript `role="log"`, sentinel `scrollIntoView`, conditional `autoFocus` | component | event-driven | No log region or focus-management precedent beyond `inputRef.current?.focus()` (`Watchlist.tsx` line 74); use 05-RESEARCH Patterns 1 and 6 (spiked) |
| `PositionRow` / positions table | component | pub-sub | Not built yet; `[PHASE 4 FILE]` |

## Metadata

**Analog search scope:** `frontend/src/{components,lib,test}`, `frontend/vitest.setup.ts`, `test/tests/` (via `git ls-files`)
**Files read:** Dashboard, Panel, Watchlist, WatchlistRow, FlashingPrice (head), useWatchlist, usePortfolio, api, testIds, priceStore (lines 60-110), vitest.setup, Dashboard.test, Watchlist.test (head), priceStore.test (head), fixtures; 05-UI-SPEC, 05-RESEARCH, 04-PATTERNS. Phase 4 PLAN files not read.
**Pattern extraction date:** 2026-10-16
