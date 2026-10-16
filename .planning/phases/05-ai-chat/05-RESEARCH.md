# Phase 5: AI Chat - Research

**Researched:** 2026-10-16
**Domain:** Frontend-only React 19 / Next.js 16 static export. A docked, collapsible chat panel (transcript, composer, quick-prompt chips, inline action chips, inline 502 error), a post-reply refresh of watchlist / portfolio / P&L history, and a short-lived "AI changed this row" highlight. The backend chat (`POST /api/chat`) is complete and hardened in Phase 2; no backend change is needed.
**Confidence:** HIGH for the backend contract, mock rules, E2E selector mapping and the pure-logic design (all read from source this session; two browser-behavior assumptions verified by a jsdom + user-event spike). MEDIUM for every item that touches a Phase 4 name (Phase 4 plans were not read by design; see "Phase 4 seams").

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase (the user chose "Continue without context"). The locked inputs are the APPROVED UI design contract `.planning/phases/05-ai-chat/05-UI-SPEC.md` (status: approved 2026-10-16). Per the invocation, its D-01 and D-03 and every "user-confirmed" item are locked; the rest of the spec is the approved contract.

### Locked Decisions
- **D-01 (confirmed by user):** A quick-prompt chip click sets the composer text and sends immediately (one click asks the question). Failure keeps the text in the composer, so the reserved follow-up copy stays true.
- **D-03 (confirmed by user):** The AI-change highlight is a whole-row `bg-primary/20` fill, 1500ms hold plus 1000ms fade, applied to the watchlist row of an added ticker and the position row of a traded ticker, and it starts after the refresh settles.
- User-confirmed (CLAUDE.md, 04/05 UI-SPEC): first watchlist ticker selected by default; main chart keeps 1,200 timestamped points (10 min), sparkline shows the last 300; quick-prompt chips send immediately; AI-change highlight is blue, 1.5s hold + 1s fade. Phase 4 has no row highlight and no `Panel` change; Phase 5 adds the `Panel` `actions` prop and `data-ai-changed` on watchlist/position rows.
- Stack (CLAUDE.md, PLAN.md): Next.js static export, Tailwind 4 `@theme static` tokens, Recharts only (not used in this phase), TypeScript 7 with no ESLint, no new npm package.
- Chat history is session-only (STATE.md Roadmap decision; `GET /api/chat` is CHAT-V2-01). No unread indicator on the rail (D-06), no clear/retry control (D-10), plain-text rendering with no markdown (D-08).

### Claude's Discretion
- The spec is silent on the implementation seams below; this research decides them: the watchlist-reload seam (lift `useWatchlist` to `Dashboard`), the highlight store shape, where chat state lives (`ChatDock` mounted above the collapsible body), file layout, and the test strategy.

### Deferred Ideas (OUT OF SCOPE)
- Chat history restore on reload (CHAT-V2-01), token streaming, markdown rendering, clear-conversation control, retry button, unread rail indicator, highlighting heatmap tiles / P&L chart / header figures, persisting the collapsed state. Any Phase 4 internals (those belong to Phase 4's plans).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | Docked, collapsible chat panel, open on load, input + send + scrolling session conversation | `ChatDock` owns chat state and collapse state above the body (Pattern 1, 2); layout and `Panel` `actions` prop (Pattern 6) |
| CHAT-02 | Loading indicator while waiting, removed from the DOM when idle | `attempt` slot state machine (Pattern 2); `Thinking...` only while `attempt.error === null` |
| CHAT-03 | Executed and failed trades / watchlist changes inline under the reply with status and reason | Backend action shape (Contract), `describeAction` mapping table (Pattern 3) |
| CHAT-04 | A chat error (502) shows inline and the typed input is kept | Draft cleared only on success; `chat-error` block; `errorMessage` rule (Pattern 2, 5) |
| CHAT-05 | After successful actions the watchlist, portfolio and P&L history refresh and AI-changed rows are briefly highlighted | Refresh orchestration (Pattern 4), highlight store (Pattern 7), row attributes (Pattern 8) |
| CHAT-06 | Quick-prompt chips without mock-trigger keywords | `QUICK_PROMPTS` constant + keyword-substring test (Pattern 9); verified against `mock.py` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Sources: `/Users/brett/.claude/CLAUDE.md`, `/Users/brett/Projects/finally/CLAUDE.md`, `/Users/brett/Projects/finally/.claude/CLAUDE.md`.

- Be simple and incremental. No over-engineering, no defensive programming; use exception handling only where needed.
- Short, clearly named functions and modules. Docstring-style comments, sparse inline comments. No emojis in code, tests or logging.
- Frontend: TypeScript 7 (`typescript@7.0.2`), **no ESLint**, Tailwind 4 tokens, Recharts only (not needed here), **no new npm package**.
- Check commands: `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `cd backend && uv run pytest`. Do not use the auto-detected root `pyproject.toml`.
- Use `/usr/bin/grep` for GNU flags (shell `grep` may be ugrep). Never read or print `.env` (use `.env.example` for variable names).
- Do not stop or modify container `finally-p1` on :8000. Frontend dev port 3000 is busy locally; use `-p 3100`.
- Backend (145 tests) is not touched by this phase. All file-changing work goes through a GSD command.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Project skill `cerebras` (`.claude/skills/cerebras/SKILL.md`) covers the backend LLM call only; it is not relevant to this frontend-only phase.

## Summary

Phase 5 is a frontend-only phase on top of a finished backend. `POST /api/chat` takes `{message}` and returns `{message, actions[]}` where each action is either a trade (`ok` with a fill `price`, or `failed` with an `error`) or a watchlist change (`ok`, or `failed` with an `error`). An LLM failure is a fixed-message 502 `{"error": ...}` and nothing is stored. The backend executes watchlist changes first, then trades, capped at 5 per kind, and the existing `request<T>()` / `ApiError` already turn a 502 body into a readable `message`. No backend change is required (HIGH, read from source below).

The design splits cleanly into four small, independently testable pieces: (1) pure logic in `lib/chat.ts` (types, `describeAction`, `aiChangeTargets`, `removedTickers`, `QUICK_PROMPTS`); (2) a `useChat` hook that holds the committed messages, one non-committed "attempt" slot (the pending or failed send) and the composer draft; (3) a tiny module-level `aiChangeStore` (mirrors the Phase 3 `priceStore` pattern: map + timers + `useSyncExternalStore`) read by `WatchlistRow` and `PositionRow` to render `data-ai-changed`; (4) a `ChatDock` that renders the `<aside>`, owns the collapsed flag and the `useChat` instance (so collapsing never loses state) and renders either the open `Panel` or the 40px rail. `Dashboard` supplies one callback that refreshes the watchlist, portfolio and history in parallel and then marks the changed rows.

The one structural decision is how chat triggers a watchlist reload. Recommendation: **lift `useWatchlist()` from `Watchlist` into `Dashboard`** (Phase 4 deliberately left it inside `Watchlist` and explicitly assigned this lift to Phase 5), return `load` from the hook, and pass the hook result to `Watchlist` as a prop. That gives an awaitable `load()`, needs no global registry, and mirrors Phase 4's portfolio lift. The cost is one harness change in `Watchlist.test.tsx`. All E2E selectors in `chat.spec.ts` map to ids that exist or are specified; no mismatch was found.

**Primary recommendation:** Build the pure logic and `aiChangeStore` first (no Phase 4 dependency), then `useChat` + `ChatDock` + `Panel actions`, then wire `Dashboard` (lift `useWatchlist`, one `applyChatActions` callback) and add the `data-ai-changed` attribute to `WatchlistRow` / `PositionRow` against Phase 4's actual files, then gate on `chat.spec.ts` in a rebuilt container.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM call, structured output, action execution, validation, 5-per-kind cap, persistence | API / Backend | — | Already built and hardened (Phase 2); the client only sends `{message}` and renders the result |
| Conversation state, attempt slot, composer draft, collapsed flag | Browser / Client | — | Session-only by decision; held in a hook above the collapsible body |
| Action-to-chip text mapping, quick-prompt list | Browser / Client | — | Pure presentation logic over the backend action shape |
| Post-reply refresh of watchlist, portfolio, history | Browser / Client | API / Backend | Client re-issues three GETs; backend remains the source of truth (the chat response carries no portfolio) |
| Row highlight timing (hold / fade) | Browser / Client | — | Pure UI feedback with timers in a module store; no server involvement |
| Static asset delivery | CDN / Static (FastAPI `StaticFiles`) | — | Unchanged |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | UI, `useSyncExternalStore`, `autoFocus` | Existing [VERIFIED: `frontend/package.json` dependencies block] |
| next | 16.4.2 | Static export | Existing |
| tailwindcss | 4.3.3 | Token classes (`bg-primary/20`, `border-down/50`, `sr-only`, `motion-reduce:`) | Existing; `sr-only` already used in `ConnectionDot.tsx:21`, `motion-reduce:` already used in `FlashingPrice.tsx:13-16` |
| typescript | 7.0.2 | Typecheck gate | Existing, no ESLint |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest 5.0.5, @testing-library/react 16.3.3, user-event 14.6.8, jest-dom 7.0.1, jsdom 30.1.3 | as installed | Unit and component tests | All Phase 5 tests [VERIFIED: `frontend/package.json`] |
| @playwright/test 1.64.1 (in `test/`) | installed | `chat.spec.ts` phase gate | Final plan only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lift `useWatchlist` to `Dashboard` | A module-level reload registry (`reloadWatchlist()` that calls registered `load`s) | Zero test churn and no `Watchlist` signature change, but a hidden global. Use only if Phase 4's `Watchlist.test.tsx` harness makes the lift expensive. |
| `useState` x3 in `useChat` | `useReducer` | Reducer guarantees the attempt-to-committed swap is one transition. Plain `useState` is fine because React 18+ batches updates after `await` (see A1); a test guards it. |
| Per-key listener sets in the highlight store | One global listener set + per-row snapshot read | Per-row `useSyncExternalStore` snapshot is a primitive (`"hold"` / `"fade"` / `null`), so React re-renders only rows whose value changed. One listener set is enough for at most about 20 rows and rare events. |

**Installation:** none. Do not install or upgrade anything.

**Version verification:** no package is added. Existing versions read from `frontend/package.json` this session.

## Package Legitimacy Audit

No external package is installed or upgraded in this phase, so the audit is not applicable and the `package-legitimacy` seam was not run.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none added) | — | — | — | — | n/a | n/a |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Contract: `POST /api/chat` (read from source this session)

**Request.** [VERIFIED: `backend/app/chat/router.py:16-17`] `class ChatRequest(BaseModel):` / `    message: str`. Route [VERIFIED: `router.py:20`] `@router.post("/api/chat")`. Send `Content-Type: application/json` and `JSON.stringify({ message })`. An empty string is accepted by the backend; the UI never sends one (Send is disabled on empty trimmed text).

**Success (200).** [VERIFIED: `backend/app/chat/service.py:115`] `return {"message": reply.message, "actions": actions}`. Each action starts as one of two records [VERIFIED: `service.py:28-35`]:

```python
return {"type": "watchlist", "ticker": change.ticker.upper(), "action": change.action}
return {"type": "trade", "ticker": trade.ticker.upper(), "side": trade.side, "quantity": trade.quantity}
```

and then gets its outcome [VERIFIED: `service.py:49`, `service.py:52`, `service.py:53`, `service.py:74`]:

```python
return {**action, "status": "failed", "error": str(exc)}
return {**action, "status": "failed", "error": UNEXPECTED_ERROR}
return {**action, "status": "ok", **outcome}
return {"price": executed.price}
```

with `UNEXPECTED_ERROR = "Action failed unexpectedly and was not applied"` [VERIFIED: `service.py:19`]. Literal values from the schema [VERIFIED: `backend/app/chat/schemas.py:13,20`]: `side: Literal["buy", "sell"]` and `action: Literal["add", "remove"]`. So the TypeScript shape is:

```typescript
export type ChatAction =
  | { type: "trade"; ticker: string; side: "buy" | "sell"; quantity: number; status: "ok"; price: number }
  | { type: "trade"; ticker: string; side: "buy" | "sell"; quantity: number; status: "failed"; error: string }
  | { type: "watchlist"; ticker: string; action: "add" | "remove"; status: "ok" }
  | { type: "watchlist"; ticker: string; action: "add" | "remove"; status: "failed"; error: string };
export interface ChatReply { message: string; actions: ChatAction[] }
```

Order and cap. Watchlist actions come first, then trades [VERIFIED: `service.py:109-110`] `actions = await run_watchlist_changes(...)` / `actions += await run_trades(...)`. Items over the cap are recorded as failed, not run [VERIFIED: `service.py:81`] `error = f"Skipped: only the first {MAX_ACTIONS_PER_KIND} {noun} per message are executed"`, with the nouns `"watchlist changes"` and `"trades"` (`service.py:89`, `service.py:96`) and `MAX_ACTIONS_PER_KIND = 5` [VERIFIED: `backend/app/chat/prompt.py:5`]. So a reply has at most 5 watchlist actions plus 5 trades that ran, plus any number of skipped entries. The UI renders them all in order, no truncation.

Error texts a failed action can carry (rendered verbatim after `failed - `):
- [VERIFIED: `backend/app/services/portfolio.py:40`] `Insufficient cash: need ${cost:,.2f}, have ${cash:,.2f}`
- [VERIFIED: `portfolio.py:53`] `Insufficient shares: selling {quantity:g} {ticker}, hold {held:g}`
- [VERIFIED: `portfolio.py:26`] `Unknown ticker: {ticker}`
- [VERIFIED: `backend/app/services/watchlist.py:23,39`] `Invalid ticker: {raw_ticker!r}` and `{ticker} is not on the watchlist`

These strings echo LLM-supplied tickers, so they are untrusted text (render as text nodes only).

**Failure (502).** [VERIFIED: `router.py:28-29`] `except LLMError as exc:` / `return JSONResponse(status_code=502, content={"error": str(exc)})`. The fixed messages [VERIFIED: `backend/app/chat/llm.py:19-21,35`]:
- `UPSTREAM_ERROR = "The AI assistant is unavailable, please try again"`
- `TIMEOUT_ERROR = "The AI assistant timed out, please try again"`
- `BAD_REPLY_ERROR = "The AI assistant returned an unusable reply, please try again"`
- `raise LLMError("OPENROUTER_API_KEY is not set")` (missing key, when `LLM_MOCK` is not true)

Nothing is executed or stored on a 502 (service raises before the action loop, `service.py:107`). `request<T>()` already maps this body: [VERIFIED: `frontend/src/lib/api.ts:12`] `throw new ApiError(body?.error ?? \`Request failed (${response.status})\`, response.status);`. A `fetch` rejection is not an `ApiError`, so it maps to the network copy `Request failed. Try again.` using the same rule as [VERIFIED: `frontend/src/lib/useWatchlist.ts:7-9`] `const NETWORK_ERROR = "Request failed. Try again.";` / `const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : NETWORK_ERROR);`.

**Mock rules (`LLM_MOCK=true`).** [VERIFIED: `backend/app/chat/mock.py:8-21`] `text = user_message.lower()`, then `if "buy" in text:` (buy 1 AAPL, message `"Done. Buying 1 share of AAPL."`), `if "sell" in text:` (sell 1 AAPL), `if "add" in text:` (watchlist add PYPL), else a canned reply with empty `trades` and `watchlist_changes`. Matching is **case-insensitive substring**, so `address`, `ladder`, `counsel` would trigger. Order is buy, sell, add (first match wins). The three starter chips contain none of the three substrings [VERIFIED: shell check this session: `Analyze my portfolio`, `What is my biggest risk?`, `Summarize my P&L` each lower-cased and tested against `buy|sell|add` returned count 0]. So clicking a chip in mock mode returns the canned reply with zero actions and never changes the portfolio.

**Chip text mapping (CHAT-03; copy from 05-UI-SPEC).**

| Backend action | Chip text | `data-status` |
|----------------|-----------|---------------|
| trade ok, buy 1 AAPL, price 190.1234 | `BUY 1 AAPL @ 190.12` | `ok` |
| trade ok, sell 2.5 NVDA, price 120.4 | `SELL 2.5 NVDA @ 120.40` | `ok` |
| trade failed | `BUY 1 AAPL failed - Insufficient cash: need $190.12, have $0.00` | `failed` |
| trade skipped (over cap) | `BUY 1 AAPL failed - Skipped: only the first 5 trades per message are executed` | `failed` |
| watchlist add ok | `Added PYPL` | `ok` |
| watchlist remove ok | `Removed PYPL` | `ok` |
| watchlist add failed | `Add PYPL failed - Unknown ticker: PYPL` | `failed` |
| watchlist remove failed | `Remove PYPL failed - PYPL is not on the watchlist` | `failed` |

Format helpers exist [VERIFIED: `frontend/src/lib/format.ts:19-20`] `export const formatPrice = (n: number) => decimal2.format(noNegativeZero(n));` and `export const formatQuantity = (n: number) => quantity.format(n);` (max 4 decimals, `quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })` at `format.ts:10`). No new formatter is needed.

## Architecture Patterns

### System Architecture Diagram

```
User types / clicks chip                     Dashboard (owns lifted hooks)
        |                                      useWatchlist()  -> { tickers, load, ... }   (LIFTED in Phase 5)
        v                                      usePortfolio()  -> { portfolio, refresh, setPortfolio }   [Phase 4]
 ChatDock  --------------------------------   usePortfolioHistory() -> { ..., refresh }                 [Phase 4]
  |  useChat(onActionsApplied)  <-- state lives HERE (above the collapsible body)
  |    messages[]  attempt{text,error|null}  draft
  |
  |  collapsed ? <ChatRail/>  : <ChatPanel/>  (Panel + actions=toggle; transcript role=log; composer form)
  |
  | send(text)
  v
 POST /api/chat {message} ----> backend: LLM -> watchlist changes -> trades (cap 5/kind) -> store
  |                                   |
  | 200 {message, actions[]}          | 502 {"error": fixed text}  (nothing stored)
  v                                   v
 commit [user, assistant+actions]     attempt.error = text; draft kept; Send re-enabled
 clear attempt + draft
  |
  v  onActionsApplied(actions)   (Dashboard.applyChatActions)
  any status "ok"?  -- no --> stop (no refresh, no highlight)
  | yes
  v
 clearTicker(removed tickers)           <- same cleanup as a manual remove
 await Promise.all([ watchlist.load(), refresh(), refreshHistory() ])
  v
 markAiChanged("watchlist", added)  markAiChanged("position", traded)   --> aiChangeStore (timers: 1500 hold, 1000 fade)
                                                                              |
                          WatchlistRow / PositionRow: useAiChange(kind, ticker) -> data-ai-changed + bg-primary/20
```

### Recommended Project Structure
```
frontend/src/
├── lib/
│   ├── chat.ts            # NEW: ChatAction/ChatReply types, QUICK_PROMPTS, describeAction, aiChangeTargets, removedTickers
│   ├── useChat.ts         # NEW: messages, attempt slot, draft, send()
│   ├── aiChangeStore.ts   # NEW: module store, markAiChanged, getAiChange, subscribe, resetAiChanges, hold/fade constants
│   ├── useAiChange.ts     # NEW: useSyncExternalStore hook + aiHighlightClass lookup
│   ├── useWatchlist.ts    # CHANGE: also return load
│   └── testIds.ts         # CHANGE: add chatToggle, chatChip
├── components/
│   ├── ChatDock.tsx       # NEW: <aside>, collapsed flag, owns useChat, renders ChatPanel or ChatRail
│   ├── ChatPanel.tsx      # NEW: Panel + toggle + Transcript + Composer
│   ├── ChatTranscript.tsx # NEW (optional split): bubbles, action list, loading, error, sentinel
│   ├── ChatComposer.tsx   # NEW (optional split): textarea + Send
│   ├── ChatChips.tsx      # NEW (optional split): empty state + chips
│   ├── ChatRail.tsx       # NEW: collapsed 40px button
│   ├── Panel.tsx          # CHANGE: optional actions prop
│   ├── Dashboard.tsx      # CHANGE: lift useWatchlist, applyChatActions, <ChatDock/> replaces <aside>
│   ├── Watchlist.tsx      # CHANGE: takes the useWatchlist result as a prop      [DEPENDS ON PHASE 4 PLAN]
│   ├── WatchlistRow.tsx   # CHANGE: useAiChange + data-ai-changed                [DEPENDS ON PHASE 4 PLAN]
│   └── PositionRow.tsx    # CHANGE: useAiChange + data-ai-changed                [DEPENDS ON PHASE 4 PLAN]
└── vitest.setup.ts        # CHANGE: resetAiChanges() in afterEach (next to resetPriceStore)
```
Keep each file short (project rule). Splitting `ChatPanel` into transcript / composer / chips is recommended so no file passes about 100 lines.

### Pattern 1: Chat state above the collapsible body (CHAT-01)
`ChatDock` renders the `<aside>` itself (replacing the `<aside className="w-[320px] shrink-0">` at [VERIFIED: `frontend/src/components/Dashboard.tsx:28`]), so the width can follow the collapsed flag without lifting that flag into `Dashboard`. It calls `useChat(onActionsApplied)` once; the open `ChatPanel` and the `ChatRail` are children that receive the chat object. Because the hook lives in `ChatDock`, which never unmounts, collapse unmounts only the view; messages, attempt, draft and an in-flight request survive.

```tsx
"use client";
export function ChatDock({ onActionsApplied }: { onActionsApplied: (actions: ChatAction[]) => void }) {
  const chat = useChat(onActionsApplied);
  const [collapsed, setCollapsed] = useState(false);
  const [toggled, setToggled] = useState(false); // autoFocus only after a user toggle, never on load
  const toggle = () => { setToggled(true); setCollapsed((c) => !c); };
  return (
    <aside className={`${collapsed ? "w-10" : "w-[320px]"} shrink-0`}>
      {collapsed ? <ChatRail onExpand={toggle} /> : <ChatPanel chat={chat} onCollapse={toggle} focusInput={toggled} />}
    </aside>
  );
}
```
Focus rules (UI-SPEC "Collapse and focus behavior") need no effects: the rail button always has `autoFocus` (it only ever mounts after a collapse click) and the textarea has `autoFocus={focusInput}` (false on first load, true after any toggle). [VERIFIED: jsdom + React 19.3.1 spike this session: initial `document.activeElement` was `body`; after collapse the rail button was focused; after expand the textarea was focused.] The rail also keeps `data-testid="chat-panel"` (UI-SPEC), so `chat.spec`'s `chat-panel` visibility check holds in both states.

### Pattern 2: `useChat` and the attempt slot (CHAT-02, CHAT-04)
State: `messages` (committed, append-only), `attempt` (`null`, or `{ text, error }` where `error === null` means in flight), `draft`. Success commits the user and assistant messages and clears the attempt and draft in one tick; failure sets `attempt.error` and leaves the draft alone. A resend replaces the attempt, so a retry never duplicates a bubble.

```typescript
"use client";
import { useCallback, useState } from "react";
import { ApiError, request } from "./api";
import type { ChatAction, ChatReply } from "./chat";

export interface ChatMessage { role: "user" | "assistant"; content: string; actions: ChatAction[] }
export interface ChatAttempt { text: string; error: string | null }
const NETWORK_ERROR = "Request failed. Try again.";

/** Session-only conversation: committed messages, one pending-or-failed attempt, and the composer draft. */
export function useChat(onActionsApplied: (actions: ChatAction[]) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attempt, setAttempt] = useState<ChatAttempt | null>(null);
  const [draft, setDraft] = useState("");
  const pending = attempt !== null && attempt.error === null;

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (text === "" || pending) return;
    setAttempt({ text, error: null });
    let reply: ChatReply;
    try {
      reply = await request<ChatReply>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
    } catch (err) {
      setAttempt({ text, error: err instanceof ApiError ? err.message : NETWORK_ERROR });
      return;
    }
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, actions: [] },
      { role: "assistant", content: reply.message, actions: reply.actions },
    ]);
    setAttempt(null);
    setDraft("");
    onActionsApplied(reply.actions);
  }, [pending, onActionsApplied]);

  return { messages, attempt, pending, draft, setDraft, send };
}
```
Notes: (a) the call to `onActionsApplied` sits after the `try/catch` on purpose, so a refresh problem can never be reported as a chat error. (b) `errorMessage` is duplicated here from `useWatchlist.ts` and (per Phase 4 patterns) will also be needed by `TradeBar`; export it once from `api.ts` if Phase 4 has not already [DEPENDS ON PHASE 4 PLAN]. (c) The empty state is `messages.length === 0 && attempt === null`.

Rendering rules that matter for tests and E2E:
- `chat-message` is rendered for committed bubbles and for the attempt's user bubble, nothing else. After success the attempt bubble is replaced by the committed pair in the same render, so exactly one new assistant `chat-message` appears per reply (`chat.spec.ts:15` asserts `messagesBefore + 1`).
- `chat-loading` (`role="status"`, text `Thinking...`) renders only when `pending`. `chat-error` (`role="alert"`) renders only when `attempt?.error`. Both are removed from the DOM otherwise (`chat.spec.ts:16` asserts `toHaveCount(0)`).
- Textarea: `readOnly={pending}` (not `disabled`), Send `disabled={pending || draft.trim() === ""}`.
- Enter sends, Shift+Enter inserts a newline, and Enter during IME composition does nothing. [VERIFIED: jsdom + user-event 14.6.8 spike this session with `onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ... } }}`: typing `hi{Enter}` sent `"hi"` and left the value `"hi"`; typing `a{Shift>}{Enter}{/Shift}b` produced the value `"hia\nb"` and sent nothing.] A textarea does not submit its form on Enter natively, so the key handler must call `send` itself; the Send button uses `type="submit"` on a `<form onSubmit>` so button and Enter share `send(draft)`.
- Quick-prompt chip: `onClick={() => { chat.setDraft(label); chat.send(label); }}`. `send` takes the text as an argument, so it does not depend on the draft state update. The chips unmount as soon as the attempt exists, so the "disabled while in flight" state is unreachable; a one-line `disabled={chat.pending}` satisfies the spec at no cost.

### Pattern 3: Pure logic in `lib/chat.ts`
```typescript
import { formatPrice, formatQuantity } from "./format";
import type { AiChangeKind } from "./aiChangeStore";

/** Starter prompts. None may contain buy, sell or add (case-insensitive substring): backend/app/chat/mock.py keys on them. */
export const QUICK_PROMPTS = ["Analyze my portfolio", "What is my biggest risk?", "Summarize my P&L"] as const;

/** One-line chip text for an action (copy contract in 05-UI-SPEC). */
export function describeAction(action: ChatAction): string {
  if (action.type === "trade") {
    const head = `${action.side.toUpperCase()} ${formatQuantity(action.quantity)} ${action.ticker}`;
    return action.status === "ok" ? `${head} @ ${formatPrice(action.price)}` : `${head} failed - ${action.error}`;
  }
  if (action.status === "ok") return `${action.action === "add" ? "Added" : "Removed"} ${action.ticker}`;
  return `${action.action === "add" ? "Add" : "Remove"} ${action.ticker} failed - ${action.error}`;
}

/** Rows to highlight: ok adds (watchlist row) and ok trades (position row). Removals highlight nothing. */
export function aiChangeTargets(actions: ChatAction[]): { kind: AiChangeKind; ticker: string }[] {
  return actions.flatMap((action) => {
    if (action.status !== "ok") return [];
    if (action.type === "trade") return [{ kind: "position" as const, ticker: action.ticker }];
    return action.action === "add" ? [{ kind: "watchlist" as const, ticker: action.ticker }] : [];
  });
}

/** Tickers an ok remove action took off the watchlist. */
export const removedTickers = (actions: ChatAction[]) =>
  actions.flatMap((a) => (a.type === "watchlist" && a.status === "ok" && a.action === "remove" ? [a.ticker] : []));
```
`ticker` is already upper-cased by the backend [VERIFIED: `service.py:30,35` `change.ticker.upper()` / `trade.ticker.upper()`], matching the `watchlist-row-{T}` / `position-row-{T}` keys. The executed text uses side upper-case, quantity via `formatQuantity`, price via `formatPrice` (no `$`), exactly as the spec table.

### Pattern 4: Post-reply refresh orchestration (CHAT-05)
`Dashboard` supplies one stable callback. Rules from the spec: refresh only if at least one action is `ok`; clean the price store for AI removals the same way a manual removal does; mark rows only after the refresh settles.

```tsx
const applyChatActions = useCallback(async (actions: ChatAction[]) => {
  if (!actions.some((action) => action.status === "ok")) return;
  removedTickers(actions).forEach(clearTicker);
  await Promise.all([watchlist.load(), refresh(), refreshHistory()]);
  aiChangeTargets(actions).forEach(({ kind, ticker }) => markAiChanged(kind, ticker));
}, [watchlist.load, refresh, refreshHistory]);
```
- `clearTicker` is the Phase 3 function [VERIFIED: `frontend/src/lib/priceStore.ts:86` `export function clearTicker(ticker: string) {`], the same call a manual remove makes [VERIFIED: `useWatchlist.ts:62`]. Call it before `load()` (same order as the manual path).
- `watchlist.load` exists and is stable (`useCallback(..., [])`, [VERIFIED: `useWatchlist.ts:19-28`]) but is **not currently returned**: [VERIFIED: `useWatchlist.ts:76`] `return { tickers, loadFailed, error, adding, removing, add, remove, clearError };`. Add `load` to that return.
- `refresh()` and `refreshHistory()` must return promises for the `await` to mean anything. Phase 4's research defines `refresh` as an `async` `useCallback` [DEPENDS ON PHASE 4 PLAN]; confirm `refreshHistory` does too. If either is fire-and-forget in the final Phase 4 code, fall back to marking rows immediately after the awaited `load()` (rows that do not exist yet render the mark when they mount, because the mark lives in the store, not in the row).
- Which refresh is needed: a trade also triggers a history snapshot server-side (`execute_trade_and_sync` records a snapshot in the same savepoint, [VERIFIED: `backend/app/services/portfolio.py:66-68`] `trade = execute_trade(conn, cache, ticker, side, quantity)` / `record_portfolio_snapshot(conn, cache)`), so history must be refetched after a trade. For simplicity and per the spec always refresh all three when any action is `ok`.

### Pattern 5: Error block and copy (CHAT-04)
```tsx
{attempt?.error != null && (
  <div role="alert" data-testid={testIds.chatError} className="max-w-[85%] border border-down/50 bg-panel px-2 py-1">
    <p className="break-words text-down">{attempt.error}</p>
    <p className="text-muted">Your message was kept. Press Send to try again.</p>
  </div>
)}
```
The error text is the backend string verbatim (fixed sentences, safe) or `Request failed. Try again.`; both render as React text nodes only.

### Pattern 6: Layout, `Panel` `actions`, and the 1280px minimum
- `Panel` gets one optional prop. Current header [VERIFIED: `frontend/src/components/Panel.tsx:19-21`]: `<header className="flex h-8 shrink-0 items-center border-b border-line px-2">` / `<h2 id={titleId} className="truncate text-[11px] font-semibold text-muted">{title}</h2>` / `</header>`. Add `actions?: React.ReactNode` and render `{actions && <div className="ml-auto">{actions}</div>}` after the `h2`. Existing callers pass nothing and are unaffected.
- Open: `<Panel title="AI Chat" testId={testIds.chatPanel} className="h-full" actions={<CollapseToggle .../>}>` whose child is `<div className="flex h-full min-h-0 flex-col">` containing the transcript (`role="log"`, `aria-label="Conversation"`, `tabIndex={0}`, `min-h-0 flex-1 overflow-y-auto bg-surface p-2`, inner column `gap-2`, zero-height sentinel last) and the composer `form` (`flex shrink-0 gap-2 border-t border-line bg-panel p-2`). This is the same `flex h-full min-h-0 flex-col` structure `Watchlist` uses inside `Panel` [VERIFIED: `frontend/src/components/Watchlist.tsx:87`] so the Panel body's own `overflow-y-auto` never scrolls and the transcript owns the scroll.
- Collapsed: the `<aside>` is `w-10`; its only child is the rail `section` (`data-testid="chat-panel"`, `aria-label="AI Chat"`) with one full-height button (`data-testid="chat-toggle"`, `aria-expanded="false"`, `aria-label="Expand AI Chat"`, glyph `‹` plus the vertical label with `[writing-mode:vertical-rl]`). Exactly one `chat-toggle` exists at a time.
- No Dashboard grid change: the freed 280px goes to `<main className="grid ... flex-1">` which is already `min-w-0 flex-1` [VERIFIED: `Dashboard.tsx:18`]. The page minimum stays `min-w-[1280px]` [VERIFIED: `Dashboard.tsx:15`].
- Auto-scroll: a zero-height sentinel as the last child, `useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, attempt])`. The effect also runs when the open body remounts after an expand, which returns the scroll to the newest message. `scrollIntoView` is stubbed globally in jsdom [VERIFIED: `frontend/vitest.setup.ts:47` `window.HTMLElement.prototype.scrollIntoView = vi.fn();`], so tests can assert the call.

### Pattern 7: The highlight store (CHAT-05, D-03)
Mirrors `priceStore`: module-level state, `useSyncExternalStore`, an explicit reset for tests. Keys are `kind:ticker`; each key has a phase (`"hold"` or `"fade"`) and two timers. A second mark for the same key clears its timers and restarts at `"hold"`.

```typescript
export const AI_HIGHLIGHT_HOLD_MS = 1500;
export const AI_HIGHLIGHT_FADE_MS = 1000;
export type AiChangeKind = "watchlist" | "position";
export type AiChangePhase = "hold" | "fade";

const phases = new Map<string, AiChangePhase>();
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
const listeners = new Set<() => void>();
const keyOf = (kind: AiChangeKind, ticker: string) => `${kind}:${ticker}`;

function setPhase(key: string, phase: AiChangePhase | null) {
  if (phase) phases.set(key, phase);
  else phases.delete(key);
  for (const listener of listeners) listener();
}

/** Start (or restart) the highlight for one row: hold, then fade, then gone. */
export function markAiChanged(kind: AiChangeKind, ticker: string) {
  const key = keyOf(kind, ticker);
  timers.get(key)?.forEach(clearTimeout);
  setPhase(key, "hold");
  timers.set(key, [
    setTimeout(() => setPhase(key, "fade"), AI_HIGHLIGHT_HOLD_MS),
    setTimeout(() => { timers.delete(key); setPhase(key, null); }, AI_HIGHLIGHT_HOLD_MS + AI_HIGHLIGHT_FADE_MS),
  ]);
}
export const getAiChange = (kind: AiChangeKind, ticker: string) => phases.get(keyOf(kind, ticker)) ?? null;
export function subscribeAiChanges(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** Clear all marks, timers and listeners (tests). */
export function resetAiChanges() { timers.forEach((ts) => ts.forEach(clearTimeout)); timers.clear(); phases.clear(); listeners.clear(); }
```
```typescript
// useAiChange.ts
export const useAiChange = (kind: AiChangeKind, ticker: string): AiChangePhase | null =>
  useSyncExternalStore(subscribeAiChanges, () => getAiChange(kind, ticker), () => null);
```
The snapshot is a primitive, so a row re-renders only when its own phase changes. The marker lives in the store, not in the row, so it does not matter whether the row exists yet when the mark is set: a row that mounts later in the window renders the mark, and a row that never exists (a removed ticker, a closed position) renders nothing. This implements "rows that no longer exist get nothing" without having to inspect the refreshed portfolio, and it is why the callback does not need to check "does the position still exist after the refresh".

Class lookup (full literal strings, because Tailwind cannot detect dynamic names). Exactly one `bg-*` utility may be active on the row at a time, because two background utilities on one element are resolved by stylesheet order, not class order:

```typescript
const HOLD = "bg-primary/20 transition-none";
const FADE = "transition-colors duration-1000 ease-out motion-reduce:transition-none";
export const aiHighlightClass = (phase: AiChangePhase | null, resting: "transparent" | "surface") => {
  if (phase === "hold") return HOLD;
  if (phase === "fade") return resting === "surface" ? `bg-surface ${FADE}` : `bg-transparent ${FADE}`;
  return "";
};
```
`data-ai-changed={phase ? "true" : undefined}` goes on the row `li` / `tr`. Tests assert on the attribute, never on class strings (spec). Behavior under `prefers-reduced-motion`: the fade class carries `motion-reduce:transition-none`, so the fill switches instantly after the 1500ms hold (the spec keeps the highlight, drops the fade); the attribute stays for the extra 1000ms, which is harmless. This is the same mechanism `FlashingPrice` uses [VERIFIED: `frontend/src/components/FlashingPrice.tsx:16` `const IDLE_CLASS = "bg-transparent transition-colors duration-500 ease-out motion-reduce:transition-none";`].

The price flash sits on a child cell (`FlashingPrice` span) and paints over the row fill, so both stay legible (spec "Stacking"); no change to `FlashingPrice`.

### Pattern 8: Row attributes `[DEPENDS ON PHASE 4 PLAN]`
- `WatchlistRow` today: [VERIFIED: `frontend/src/components/WatchlistRow.tsx:30`] `<li data-testid={testIds.watchlistRow(ticker)} className="flex h-7 items-center gap-1 px-2">`. Phase 4 adds `selected` (fill `bg-surface`), hover `hover:bg-surface/60`, `tabIndex`, `aria-current`. Phase 5 adds `const aiPhase = useAiChange("watchlist", ticker)`, `data-ai-changed`, and `aiHighlightClass(aiPhase, selected ? "surface" : "transparent")`. When `aiPhase !== null` the row must drop its own `bg-surface` (selected) so there is a single background utility; at rest it keeps it. Note the hover variant has higher specificity than a plain background utility, so a hovered row shows the hover fill instead of the highlight; accept (backstop item), or omit the hover class while highlighted.
- `PositionRow` (Phase 4, small separate component by design, [CITED: 04-UI-SPEC.md "Positions Table Contract": "Keep the positions row as a small separate component (`PositionRow`) so that edit is local."]): `useAiChange("position", ticker)` on the `tr`, resting `"transparent"`. Position rows have no hover and no selection, so no conflict.
- `memo` stays: the hook subscribes per row, so no new prop is passed and memoization is unaffected.

### Pattern 9: Quick-prompt chips (CHAT-06)
`QUICK_PROMPTS` is exported from `lib/chat.ts`; a unit test iterates it and asserts `!/buy|sell|add/i.test(prompt)` and that there are exactly three, in the reserved order. The component renders them only when `messages.length === 0 && attempt === null`, each a `button type="button"` with `data-testid={testIds.chatChip}`. Add `chatToggle: "chat-toggle"` and `chatChip: "chat-chip"` to `testIds` [VERIFIED: current block `frontend/src/lib/testIds.ts:22-28` has `chatPanel`, `chatInput`, `chatSend`, `chatLoading`, `chatMessage`, `chatAction`, `chatError`]. The parity test only checks that spec ids are known [VERIFIED: `frontend/src/lib/testIds.test.ts` `isCovered` / "covers every id the specs reference"], so adding ids is safe.

### Anti-Patterns to Avoid
- **Chat state inside the open panel body:** collapsing would unmount it and lose the conversation (the exact CHAT-01 failure). State lives in `ChatDock` / `useChat`.
- **Clearing the composer on send:** the text must survive a 502 (CHAT-04). Clear only on success.
- **Keeping a failed bubble in `messages`:** the backend stores nothing on a 502, and a retry would show two copies. Use the non-committed attempt slot.
- **`dangerouslySetInnerHTML`, markdown, auto-links:** assistant text, tickers and failure reasons are untrusted (LLM-echoed). Text nodes only.
- **Two `bg-*` utilities on a highlighted row:** conflict resolved by stylesheet order. One at a time (Pattern 7).
- **Dynamic Tailwind class names** (`` `bg-${x}/20` ``): not detected at build time. Use literal strings in a lookup.
- **Calling the refresh inside the `try` that wraps `request`:** a refresh problem would surface as a chat error.
- **`useEffect(refresh, [refresh])`-style effects with async functions** (Phase 4 Pattern 2 warning applies if `Dashboard` adds effects).
- **Marking before the refresh settles:** the highlight window (2.5s) could expire before the row exists on a slow refresh.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP + backend `{"error"}` text | A chat-specific fetch wrapper | `request<T>()` / `ApiError` in `src/lib/api.ts` | Already maps 502 bodies to `message`; reused by `useWatchlist` |
| Number text in chips | `toFixed` | `formatQuantity` / `formatPrice` | Already match the E2E number rules; fixed `en-US` locale |
| Subscribing rows to the highlight | Context re-render of the whole table | `useSyncExternalStore` over a primitive snapshot | Same pattern as `priceStore`; only changed rows re-render |
| Focus on collapse / expand | Effects + refs + flags | Conditional `autoFocus` | Verified to work in React 19 / jsdom; no effect needed |
| Reduced-motion handling | A `matchMedia` hook | Tailwind `motion-reduce:` variant | Already the project pattern in `FlashingPrice` |
| Scroll-to-newest | Manual `scrollTop = scrollHeight` math | `sentinel.scrollIntoView({ block: "end" })` | UI-SPEC mandates it; the jsdom stub exists |

**Key insight:** every hard piece already exists (request wrapper, formatters, store pattern, reduced-motion pattern, the backend contract). The work is a state machine, a mapping function, one small store and wiring.

## Runtime State Inventory

Not a rename/refactor/migration phase: omitted. (No stored data, service config, OS registration, secret name or build artifact changes name. The only persisted data touched is the existing `chat_messages` table, which the backend already writes and the frontend never reads in v1.)

## Phase 4 seams `[DEPENDS ON PHASE 4 PLAN]`

Phase 4 is being planned in parallel. Its `*-PLAN.md` files were deliberately not read. Everything below comes from 04-UI-SPEC.md, 04-RESEARCH.md and 04-PATTERNS.md; reconcile each line against Phase 4's actual plans before writing Phase 5 plans.

| # | Seam | What Phase 5 assumes (source) | If Phase 4 differs |
|---|------|-------------------------------|--------------------|
| S1 | `usePortfolio()` lifted into `Dashboard`, returning `{ portfolio, failed, refresh, setPortfolio }`, with `refresh` an `async` function that returns a promise (04-RESEARCH Pattern 2; 04-UI-SPEC "Shared state placement") | `applyChatActions` awaits `refresh()` | If `refresh` is not awaitable, mark rows right after the awaited `watchlist.load()` instead |
| S2 | `usePortfolioHistory()` returning a `refresh` that Phase 4 names `refreshHistory`, also awaitable (04-UI-SPEC "Shared state placement") | `applyChatActions` awaits it | Same fallback as S1 |
| S3 | Hooks swallow request errors (`catch` sets a failed flag, resolves normally) (04-RESEARCH Pattern 2) | Cannot detect a failed refresh | Spec says "if the refresh fails, mark nothing"; see Open Question 1 |
| S4 | `PositionRow` is a small separate component in `src/components/PositionRow.tsx`, a `memo` `tr` with `data-testid={testIds.positionRow(ticker)}`, no hover and no click (04-UI-SPEC, 04-PATTERNS) | Phase 5 adds `useAiChange` + `data-ai-changed` + the highlight class to that `tr` | Edit wherever the row lives; the store and hook are independent of the file |
| S5 | `useWatchlist` stays inside `Watchlist` in Phase 4 (04-RESEARCH Pattern 3: "Phase 5's UI-SPEC refreshes the watchlist through `useWatchlist.load`; that lift belongs to Phase 5") | Phase 5 lifts it: `Dashboard` calls `useWatchlist()`, returns `load`, passes the result to `Watchlist` | If Phase 4 already lifted it, skip the lift and only add `load` to the return if missing |
| S6 | `Watchlist` signature after Phase 4: `selectedTicker`, `onSelect`, default/fallback selection effect inside `Watchlist` using `tickers` (04-RESEARCH Pattern 3) | The effect keeps working unchanged after the lift because `tickers` still arrives (now via the prop). It also handles "AI removed the selected ticker" with no extra chat rule (spec) | Adjust the prop shape in the lift task |
| S7 | `WatchlistRow` props `selected`, `onSelect`; selected fill `bg-surface`; `hover:bg-surface/60`; `aria-current` (04-UI-SPEC "Watchlist Selection Contract") | Highlight class must replace, not stack with, the selected fill (Pattern 7/8) | Follow Phase 4's final class composition |
| S8 | `Watchlist.test.tsx` gets a `renderWatchlist()` harness holding `selectedTicker` (04-RESEARCH impact table) | The lift changes that harness to also call `useWatchlist()` and pass it in | Contained in one helper if Phase 4 built it as a helper |
| S9 | `errorMessage` shared between `useWatchlist` and `TradeBar` (04-PATTERNS: "Export or share `errorMessage` rather than duplicating it") | `useChat` uses the same helper | If it is not exported, export it from `api.ts` in a Phase 5 task |
| S10 | `Dashboard.test.tsx` and `Header.test.tsx` are edited by Phase 4 (main-chart always mounted, header takes props); `src/test/fixtures.ts` gains `makePortfolio`, `makePosition`, `makeTradeResponse`, `makeSnapshot` (04-RESEARCH Wave 0) | Phase 5's Dashboard integration test reuses those builders; Phase 5 edits `Dashboard.test.tsx` again (aside) | Phase 5 executes after Phase 4, so edits are sequential; rebase on Phase 4's version |
| S11 | `chat.spec.ts` requires `position-row-AAPL` visible after a mocked buy with no reload (04-UI-SPEC Test Hooks) | Satisfied by Phase 4's table plus Phase 5's `refresh()` call | Blocking: if the table does not read the lifted portfolio, CHAT-05 cannot pass |
| S12 | WR-03 may be fixed in Phase 4 (04-RESEARCH Open Question 2: defer, or `clearTicker` skips held tickers) | Phase 5 calls `clearTicker` for AI removals exactly as the manual path does | If Phase 4 centralizes removal cleanup, call that function instead of `clearTicker` directly |

## Common Pitfalls

### Pitfall 1: Duplicate or missing assistant bubble breaks `chat.spec`
**What goes wrong:** The spec asserts `assistantMessages` count is exactly `messagesBefore + 1` and `chat-action` count is exactly `actionsBefore + 1`.
**Why it happens:** Rendering the reply both in the attempt slot and the committed list for a frame, rendering the loading line or error inside a `chat-message`, or giving action chips the `chat-message` testid.
**How to avoid:** Success replaces the attempt with the committed pair in one state transition. Only bubbles carry `chat-message`; chips carry `chat-action`. A component test renders a deferred reply and asserts there is never a frame with two bubbles for the same text.
**Warning signs:** A count of +2 in Playwright; flaky `toHaveCount`.

### Pitfall 2: Composer text lost or doubled on error
**What goes wrong:** Clearing the draft on send makes the follow-up copy `Your message was kept` false; committing the failed bubble duplicates it on retry.
**How to avoid:** The draft clears only after a 200; the failed attempt is not in `messages`; a resend replaces the attempt. Test: reject, assert textarea value unchanged, one user bubble, `chat-error` present; resend succeeds, assert exactly one user bubble.

### Pitfall 3: Collapse loses state
**What goes wrong:** State inside `ChatPanel` resets on collapse/expand.
**How to avoid:** `useChat` in `ChatDock`; test sends a message, collapses (one `chat-toggle` with `aria-expanded="false"`), expands, and asserts the bubbles and the draft remain, and that a reply arriving while collapsed is present after expand and still triggers the refresh callback.

### Pitfall 4: Highlight vs background-class conflicts and Tailwind detection
**What goes wrong:** The selected watchlist row has `bg-surface`; adding `bg-primary/20` or `bg-transparent` on top leaves the winner to stylesheet order, so the fade can end on the wrong fill and then jump. Dynamic class strings are not generated at all.
**How to avoid:** One background utility at a time through `aiHighlightClass(phase, resting)`; full literal strings; assert on `data-ai-changed`, with a UAT backstop for "no flicker".

### Pitfall 5: Timers leak across tests and fire after unmount
**What goes wrong:** `markAiChanged` schedules real `setTimeout`s in a module store. Left alone, they outlive the test, and listeners from unmounted components stay registered.
**How to avoid:** `resetAiChanges()` in `vitest.setup.ts` `afterEach` beside `resetPriceStore()` [VERIFIED: `vitest.setup.ts:52` `resetPriceStore();`]. In component tests call `vi.useFakeTimers()` **before** `markAiChanged`, advance with `act(() => vi.advanceTimersByTime(...))`, and restore real timers in `afterEach`. With fake timers use `fireEvent` or `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, otherwise `userEvent` hangs.

### Pitfall 6: Watchlist reload races
**What goes wrong:** `useWatchlist.load` has no ordering guard (open advisory WR-02 from Phase 3: "unordered loads"). A chat reload racing a user add/remove can apply an older list.
**How to avoid:** Accept for Phase 5 (single user, rare overlap, the next `load` corrects it). Do not add a guard unless Phase 4 does.

### Pitfall 7: `getByText` and the hidden sender name
**What goes wrong:** Each bubble begins with `<span className="sr-only">You </span>`; `toHaveTextContent` on the bubble includes the sender name, so exact-match assertions fail.
**How to avoid:** Assert with `toContainText` (the Playwright spec does) or `within(bubble).getByText(text)`; `getByText` matches an element's own text nodes, so it finds the message text.

### Pitfall 8: Idempotent add and removal highlight semantics
An `add` of an already-watched ticker returns `ok` (no-op success, [VERIFIED: `backend/app/services/watchlist.py` `add_to_watchlist` docstring "Already watched is a no-op success."]) and the spec highlights the existing row. A `remove` that closes nothing highlights nothing. A `sell` that closes a position removes the row, so no highlight shows; the store entry simply expires.

### Pitfall 9: Static export / prerender
`ChatDock` initial render must not read browser-only APIs. `autoFocus={false}` on load, no `window`/`localStorage`, collapsed state initial `false` on server and client. Run `npm --prefix frontend run build` as a gate.

### Pitfall 10: E2E fixture state
`chat.spec.ts` buys 1 AAPL and expects `position-row-AAPL`; it runs first in the `features` project alphabetically. Run the gate against a fresh container (tmpfs DB). Running `--project=features` also runs the `fresh-start` dependency first [VERIFIED: `test/playwright.config.ts:24` `{ name: "features", testIgnore: /fresh-start\.spec\.ts/, dependencies: ["fresh-start"] }`], which needs the default 10-ticker, $10k state, so do not reuse a container that already ran a spec.

## Code Examples

### Chat action list (CHAT-03)
```tsx
// Renders under the assistant bubble that produced the actions; absent when there are none.
export function ChatActionList({ actions }: { actions: ChatAction[] }) {
  if (actions.length === 0) return null;
  return (
    <ul aria-label="Actions" className="mt-1 flex max-w-[85%] flex-col gap-1">
      {actions.map((action, index) => (
        <li
          key={index}
          data-testid={testIds.chatAction}
          data-status={action.status}
          className={`figures break-words border bg-surface px-2 py-1 text-[11px] ${
            action.status === "ok" ? "border-line text-text" : "border-down/50 text-down"
          }`}
        >
          {describeAction(action)}
        </li>
      ))}
    </ul>
  );
}
```
Index keys are correct here: lists are append-only and never reordered.

### Dashboard wiring (after the lift)
```tsx
const watchlist = useWatchlist();                 // lifted from Watchlist
// ...Phase 4's usePortfolio() / usePortfolioHistory() calls...
<Watchlist watchlist={watchlist} selectedTicker={selectedTicker} onSelect={setSelectedTicker} />
...
<ChatDock onActionsApplied={applyChatActions} />  // replaces <aside className="w-[320px] shrink-0">...</aside>
```

### Row highlight (WatchlistRow sketch)
```tsx
const aiPhase = useAiChange("watchlist", ticker);
<li
  data-testid={testIds.watchlistRow(ticker)}
  data-ai-changed={aiPhase ? "true" : undefined}
  className={`flex h-7 items-center gap-1 px-2 ${aiPhase ? aiHighlightClass(aiPhase, selected ? "surface" : "transparent") : selected ? "bg-surface" : ""}`}
>
```

### Test: highlight timing with fake timers
```typescript
vi.useFakeTimers();
act(() => markAiChanged("position", "AAPL"));
expect(row).toHaveAttribute("data-ai-changed", "true");
act(() => vi.advanceTimersByTime(AI_HIGHLIGHT_HOLD_MS - 1));
expect(row).toHaveAttribute("data-ai-changed", "true");        // still holding
act(() => vi.advanceTimersByTime(1));                           // fade starts
expect(row).toHaveAttribute("data-ai-changed", "true");
act(() => vi.advanceTimersByTime(AI_HIGHLIGHT_FADE_MS));        // gone
expect(row).not.toHaveAttribute("data-ai-changed");
```
A restart test marks again at t=2000 (during fade) and expects the attribute to persist another 2500ms from that point.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Old frontend (`5681c3a`) `useChat` appended the user message immediately and kept it on error, coloring success actions green | Attempt slot (uncommitted until 200), neutral success chips, red only on failure | Phase 5 UI-SPEC | No duplicate bubbles on retry; green stays reserved for price direction / P&L |
| Old frontend described actions in prose (`Bought 1 AAPL at 190.12`) | Terminal-style `BUY 1 AAPL @ 190.12` in `.figures` | Phase 1 reserved copy | Reference only; do not copy the old files |
| Spinner / disabled textarea while loading | `readOnly` textarea, `Thinking...` status line | UI-SPEC D-07 | Keeps focus and typed text across the request |

**Deprecated/outdated:** the old `describeAction` wording, the green success border, and appending the user message before the response (kept only as a reference, `git show 5681c3a:frontend/src/...`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React 19 batches the `setMessages` / `setAttempt` / `setDraft` calls made after `await` into one render | Pattern 2 | A single frame could show both the attempt bubble and the committed pair. Cheap hedge: a single `useReducer` / one state object, plus the Pitfall 1 test |
| A2 | `scrollIntoView({ block: "end" })` on a sentinel inside the transcript does not scroll the page or other ancestors in a real browser | Pattern 6 | Page jump on reply. Covered by the UI-SPEC backstop; fallback is `transcript.scrollTop = transcript.scrollHeight` |
| A3 | Playwright `--project=features` runs the `fresh-start` dependency first on a fresh container and passes | Pitfall 10 / Validation | Gate command needs `--no-deps` or a different ordering |
| A4 | Tailwind 4 detects the full literal class strings (`bg-primary/20`, `duration-1000`, `motion-reduce:transition-none`) inside a TypeScript lookup object | Pattern 7 | Highlight renders unstyled. Same technique already works in `FlashingPrice.tsx:12-16`; confirm in the browser at UAT |
| A5 | A hovered row shows the hover fill rather than the highlight (variant specificity) | Pattern 8 | Cosmetic only; UAT backstop |
| A6 | Phase 4's final `refresh` / `refreshHistory` return promises (S1, S2) | Phase 4 seams | `await` would not wait; fall back to marking after `watchlist.load()` |
| A7 | The 30s backend LLM timeout (`TIMEOUT_SECONDS = 30`, `llm.py:18`) is shorter than any proxy timeout in the Docker path, so the UI never needs its own timeout | Contract | A hung request would leave `Thinking...` forever. Not reachable in the shipped single-origin container; dev proxy limits not checked |

## Open Questions (RESOLVED)

1. **"If the refresh fails, mark nothing" is not implementable as written.**
   - What we know: the lifted hooks catch their own request errors and resolve normally (Phase 4 Pattern 2; `useWatchlist.load` [VERIFIED: `useWatchlist.ts:25-27`] `} catch { setLoadFailed(true); }`), so `await Promise.all([...])` cannot tell success from failure.
   - What's unclear: whether the user cares. A failed refresh followed by a mark would highlight a stale or missing row, which is harmless (a missing row renders nothing).
   - Recommendation: mark after the refresh settles regardless, and record this as a deliberate relaxation of the spec sentence. If strictness is wanted, make `load` / `refresh` / `refreshHistory` return `Promise<boolean>` (touches Phase 4 hooks).
   - **RESOLVED (strict):** Phase 4 already makes `refresh()` / `refreshHistory()` return `Promise<boolean>`; 05-03 makes `useWatchlist.load` return `Promise<boolean>` too, and 05-04 marks rows only when all three resolve `true`, so the spec sentence holds as written.

2. **Lift vs registry for the watchlist reload.**
   - What we know: the lift is explicit and awaitable but changes the `Watchlist` signature and the Phase 4 test harness.
   - What's unclear: how much of `Watchlist.test.tsx` Phase 4 routes through one helper.
   - Recommendation: lift (decided above). Only if the harness turns out to be 26 inline renders, use a module-level `reloadWatchlist()` registry instead.
   - **RESOLVED:** lift. Phase 4 routes every `Watchlist.test.tsx` render through `renderWatchlist()`, so 05-03 lifts `useWatchlist` into `Dashboard`.

3. **Highlight on a hovered or selected row.** Resolved by Pattern 7/8 (single background utility, selected resting fill preserved); the hover edge case is a UAT backstop.
   - **RESOLVED:** 05-04 uses `aiHighlightClass` alone while highlighted (one `bg-*` utility); hover stays a UAT backstop.

4. **`WR-03` (removing a held ticker clears its live price).** AI removal of a held ticker will briefly fall back to the API price, the same as a manual removal. Not a chat concern; follow whatever Phase 4 decides (S12).
   - **RESOLVED:** accepted as Phase 4 behaviour (WR-03 deferred in 04-02); 05-03 calls `clearTicker` like the manual path.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Vitest, Next build, Playwright | yes | v26.9.0 (Dockerfile build stage uses Node 22) | — |
| npm + `frontend/node_modules` | all frontend work | yes | 13 test files, 138 tests passed in 1.28s; `tsc --noEmit` clean (run this session) | — |
| uv + backend deps | `cd backend && uv run pytest` | yes (Phase 4 research: uv 0.12.3; not re-run, backend untouched) | — | — |
| Docker | rebuilt container for the E2E gate | yes | `docker ps` works; images `finally-phase3`, `finally-phase1`, `finally:latest` present | — |
| Playwright + Chromium | `chat.spec.ts` | yes | `~/Library/Caches/ms-playwright` has chromium-1243/1248 | — |
| Running container `finally-p1` | must not be touched | yes (0.0.0.0:8000) | — | Build `finally-phase5`, run as `finally-p5` on `127.0.0.1:8010` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. No `finally-p3` container is running.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` (read this session), so this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1 + user-event 14.6.8 (jsdom 30.1.3); Playwright 1.64.1 in `test/` for the phase gate |
| Config file | `frontend/vitest.config.mts` (`environment: "jsdom"`, `globals: true`, `setupFiles: ["./vitest.setup.ts"]`, `css: false`); `vitest.setup.ts` stubs `ResizeObserver`, `EventSource`, `scrollIntoView` and calls `resetPriceStore()` after each test |
| Quick run command | `npm --prefix frontend test -- <touched test file>` |
| Full suite command | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` (baseline measured today: 13 files, 138 tests; Phase 4 will raise it) |
| Backend check | `cd backend && uv run pytest` (145 tests; unchanged, run once at the phase gate) |
| E2E gate | `docker build -t finally-phase5 .` then `docker run -d --name finally-p5 -p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true finally-phase5`, then `cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test chat.spec.ts --project=features --reporter=list` (runs `fresh-start` first on the fresh container), then `docker rm -f finally-p5` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Panel open on load (heading `AI Chat`, `chat-panel`, `chat-toggle` `aria-expanded="true"`); send a message and see both bubbles; collapse then expand keeps messages, draft and pending request; exactly one `chat-toggle` at a time; Enter sends, Shift+Enter newline; transcript is `role="log"` | component | `npm --prefix frontend test -- src/components/ChatDock.test.tsx` | Wave 0 |
| CHAT-01 | Layout: aside is `w-[320px]` open and `w-10` collapsed; `Panel` renders `actions` and existing callers are unaffected; page keeps `min-w-[1280px]` | component | `npm --prefix frontend test -- src/components/Dashboard.test.tsx src/components/ChatDock.test.tsx` | Dashboard exists (must change) |
| CHAT-02 | `Thinking...` (`chat-loading`, `role="status"`) only while in flight; absent after success and after error; Send disabled and textarea `readOnly` while pending; second Enter / chip ignored | component (deferred fetch promise) | `npm --prefix frontend test -- src/components/ChatDock.test.tsx` | Wave 0 |
| CHAT-03 | `describeAction` table (all 8 rows above, fractional quantity, long reason); one `chat-action` per action in order with correct `data-status`; zero actions renders no list; mixed outcomes; empty `message` still renders the assistant bubble; `<img onerror>` payload in message and error renders as text | unit + component | `npm --prefix frontend test -- src/lib/chat.test.ts src/components/ChatDock.test.tsx` | Wave 0 |
| CHAT-04 | 502 `{error}` shows verbatim in `chat-error` (`role="alert"`) plus the follow-up line; textarea value kept; Send re-enabled; resend replaces the attempt (one user bubble); network failure shows `Request failed. Try again.`; failed attempt is not in the committed list | component | same | Wave 0 |
| CHAT-05 | `aiChangeTargets` / `removedTickers` unit; store hold 1500 / fade 1000 / gone, restart, reset (fake timers); `WatchlistRow` and `PositionRow` render `data-ai-changed` only during the window; Dashboard integration: an ok trade reply triggers GET `/api/watchlist`, `/api/portfolio` and `/api/portfolio/history` and then marks the row; an all-failed reply and a zero-action reply trigger no refetch and no mark; ok remove calls `clearTicker` and marks nothing | unit + component + integration | `npm --prefix frontend test -- src/lib/chat.test.ts src/lib/aiChangeStore.test.ts src/components/Dashboard.test.tsx src/components/Watchlist.test.tsx src/components/PositionsTable.test.tsx` | Wave 0 / existing (extend) |
| CHAT-06 | Exactly three chips with the reserved labels in order; none matches `/buy\|sell\|add/i`; click sends immediately (fetch called with `{message: label}`); chips disappear after the first send and a failed first attempt; chips absent once any message exists | unit + component | `npm --prefix frontend test -- src/lib/chat.test.ts src/components/ChatDock.test.tsx` | Wave 0 |
| CHAT-01..06 | Real browser: mocked buy shows the user bubble, +1 assistant bubble, +1 `chat-action` with `data-status="ok"` containing `AAPL`, no `chat-loading`, and `position-row-AAPL` visible | e2e | the E2E gate above (`chat.spec.ts`, do not edit) | exists |
| All | Static build and prerender safe; typecheck | build | `npm --prefix frontend run build && npm --prefix frontend run typecheck` | — |

### Sampling Rate
- **Per task commit:** the quick command on the touched file(s).
- **Per wave merge:** `npm --prefix frontend test && npm --prefix frontend run typecheck`.
- **Phase gate:** full suite + typecheck + build, `cd backend && uv run pytest`, the E2E gate, then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `frontend/src/lib/chat.test.ts` - `describeAction`, `aiChangeTargets`, `removedTickers`, `QUICK_PROMPTS` keyword check (CHAT-03, 05, 06)
- [ ] `frontend/src/lib/aiChangeStore.test.ts` - hold / fade / gone, restart, reset, subscribe (CHAT-05)
- [ ] `frontend/src/components/ChatDock.test.tsx` - transcript, composer, chips, loading, error, collapse persistence, focus, XSS (CHAT-01..04, 06)
- [ ] Row tests: `data-ai-changed` on `WatchlistRow` (in `Watchlist.test.tsx`) and `PositionRow` (in Phase 4's positions test file) (CHAT-05)
- [ ] `Dashboard.test.tsx` integration: chat reply to refetch to highlight, with a fetch stub that routes by path and method (CHAT-05); update the aside class assertion
- [ ] `vitest.setup.ts`: `resetAiChanges()` in `afterEach`
- [ ] `testIds.test.ts`: assert `chatToggle` / `chatChip` values (optional)
- [ ] No framework install needed.

### Existing tests that must change
| File | Why | Change |
|------|-----|--------|
| `src/components/Dashboard.test.tsx` | Aside is now rendered by `ChatDock` | The assertion `expect(screen.getByRole("complementary")).toHaveClass("w-[320px]")` [VERIFIED: `Dashboard.test.tsx:48`] still holds in the open state; add collapsed `w-10`. Phase 4 also edits this file; rebase on its version |
| `src/components/Watchlist.test.tsx` | `Watchlist` now receives the `useWatchlist()` result as a prop | Update Phase 4's `renderWatchlist()` helper to call `useWatchlist()`; no per-test change if the helper is used everywhere |
| `vitest.setup.ts` | New module store | Add `resetAiChanges()` |

### E2E selector map (`test/tests/chat.spec.ts` read in full this session; no spec edit is needed)

| Spec line (verbatim) | Requires | Status |
|----------------------|----------|--------|
| `page.locator('[data-testid="chat-message"][data-role="assistant"]')` | assistant bubble carries `chat-message` + `data-role="assistant"` | match (UI-SPEC) |
| `page.getByTestId("chat-action")` ; `toHaveAttribute("data-status", "ok")` ; `toContainText("AAPL")` | `li` per action with `data-status` and the ticker in the text | match |
| `page.getByTestId("chat-panel")` `toBeVisible()` | `chat-panel` on the panel and on the rail | match (testids.ts:22 `chatPanel: "chat-panel"`) |
| `page.getByTestId("chat-input").fill("Please buy some Apple")` | textarea `chat-input`, `fill()` works, not `readOnly` when idle | match |
| `page.getByTestId("chat-send").click()` | enabled after fill (draft non-empty) | match |
| `page.locator('[data-testid="chat-message"][data-role="user"]').last()` `toContainText("Please buy some Apple")` | user bubble contains the text (sr-only sender name is fine with `toContainText`) | match |
| `expect(assistantMessages).toHaveCount(messagesBefore + 1)` | exactly one new assistant bubble | match (Pitfall 1) |
| `page.getByTestId("chat-loading")).toHaveCount(0)` | loading element absent when idle | match |
| `expect(actions).toHaveCount(actionsBefore + 1)` | mock buy returns one trade action | match (mock.py:9-14) |
| `page.getByTestId("position-row-AAPL")).toBeVisible()` | positions table refreshed from the lifted portfolio | depends on Phase 4 (S11) |

The mock message `"Please buy some Apple"` contains `buy`, so `mock_reply` returns buy 1 AAPL [VERIFIED: `mock.py:9-14`]. No spec uses `chat-toggle`, `chat-chip`, `chat-error` or `data-ai-changed`. The parity test passes with the two new ids added. **No mismatch found** between the spec, `testIds.ts`, and 05-UI-SPEC.

## Security Domain

`security_enforcement` is enabled (absent = enabled; `security_asvs_level: 1`, `security_block_on: high`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No login by design (PLAN.md) |
| V3 Session Management | no | No sessions; history is client memory only |
| V4 Access Control | no | Single user |
| V5 Input Validation / Output Encoding | yes | Assistant text, tickers and failure reasons are untrusted (LLM-echoed); render as React text children only. Client trimming and non-empty gate are UX only; the backend validates every trade and watchlist change |
| V6 Cryptography | no | None |
| V12 / V13 API & output | yes | Same-origin `fetch` only; response bodies treated as data, never as HTML; no new network behavior beyond `POST /api/chat` and the three refresh GETs |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS through assistant `message`, an action `ticker` or `error` (LLM-controlled, echoed into `Invalid ticker: 'x'`) | Tampering | React text nodes only; no `dangerouslySetInnerHTML`, no markdown, no link detection; unit test with an `<img src=x onerror=...>` payload in message, ticker and error asserting no `img` element exists |
| Prompt-injected or malicious trade request from the model | Tampering | Out of the frontend's control and deliberate (PLAN.md section 9 auto-execution; backend validates cash / shares / ticker and caps 5 per kind). Frontend adds no auto-send loop; one request in flight at a time |
| Double submission of a chat message (and therefore of its auto-executed trades) | Tampering | `pending` guard in `send`, Send disabled and textarea `readOnly` while pending, Enter / chip ignored in flight; test the second Enter / chip click while pending sends exactly one request |
| Information disclosure in error text | Information disclosure | Backend 502 bodies are fixed public sentences (HARD-02, [VERIFIED: `llm.py:19-21`]); the upstream detail is logged server-side only. Render verbatim |
| DOM id / selector injection through a model-supplied ticker used in `data-testid` or Map keys | Tampering | The ticker is only used as a text value, a `data-testid` attribute value (React escapes), and a `Map` key; it is never interpolated into a CSS selector or HTML string in this phase |
| Timer or listener leak from the highlight store | Denial of service (local) | `resetAiChanges()` in tests; timers are bounded (two per marked key, cleared on restart) |

## Sources

### Primary (HIGH confidence)
- Repo source read this session: `backend/app/chat/router.py`, `service.py`, `schemas.py`, `mock.py`, `llm.py`, `prompt.py` (line 5), `backend/app/services/portfolio.py`, `watchlist.py`; `frontend/src/components/{Dashboard,Panel,Watchlist,WatchlistRow,Header,FlashingPrice,Sparkline}.tsx`, `Dashboard.test.tsx`, `Watchlist.test.tsx` (head); `frontend/src/lib/{api,useWatchlist,usePortfolio,priceStore,usePrice,format,testIds,testIds.test}.ts`; `frontend/src/test/fixtures.ts`, `vitest.setup.ts`, `vitest.config.mts`, `package.json`, `src/app/globals.css`; `test/tests/chat.spec.ts`, `helpers.ts`, `test/playwright.config.ts`, `test/docker-compose.test.yml`; `.env.example` (names only)
- Planning artifacts: `05-UI-SPEC.md`, `04-UI-SPEC.md`, `04-RESEARCH.md`, `04-PATTERNS.md`, `04-VALIDATION.md` (head), `REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md` (Phases 4, 5), `.planning/config.json`
- Runtime spike this session (node + jsdom 30.1.3 + react 19.3.1 + user-event 14.6.8, script in the session scratchpad `spike5/spike.cjs`, nothing written under `frontend/`): conditional `autoFocus` on late mount and Enter / Shift+Enter behavior in a `<textarea>`
- Baseline run this session: `npm --prefix frontend test` (13 files, 138 tests passed) and `npm --prefix frontend run typecheck` (clean); `docker ps` / `docker images`
- Old frontend reference only: `git show 5681c3a:frontend/src/hooks/useChat.ts`, `ChatActionItem.tsx`

### Secondary (MEDIUM confidence)
- None used (no web search needed; every question was answerable from repo source and the installed toolchain).

### Tertiary (LOW confidence)
- Training knowledge for React 18+ post-`await` batching (A1), browser `scrollIntoView` ancestor behavior (A2), Playwright dependency behavior (A3), Tailwind class detection and CSS variant specificity (A4, A5), tagged `[ASSUMED]` above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new package; all versions read from `package.json`.
- Architecture: HIGH for the chat state machine, mapping, store and E2E mapping (read from source, behaviors spiked); MEDIUM for the Phase 4 seams (Phase 4 plans intentionally not read).
- Pitfalls: HIGH for count / state / test-hygiene items derived from `chat.spec.ts` and existing tests; MEDIUM for browser-only CSS behavior.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable: pinned versions, finished backend). Re-check the Phase 4 seams table as soon as Phase 4's plans are written.
