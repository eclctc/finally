---
status: testing
phase: 05-ai-chat
source: [05-VERIFICATION.md]
started: 2026-10-17T00:22:50Z
updated: 2026-10-17T00:22:50Z
---

## Current Test

number: 1
name: Chat panel open on load, empty state and 1280x720 layout
expected: |
  Open http://127.0.0.1:8010 (container finally-p5, LLM_MOCK=true). A 320px AI Chat column is on the right with the empty-state line and three quick-prompt chips; no horizontal scroll at 1280x720; composer and Send aligned at the bottom; nothing focused on load.
awaiting: user response

## Tests

### 1. Chat panel open on load, empty state and 1280x720 layout
expected: A 320px AI Chat column is on the right with the empty-state line and three quick-prompt chips; no horizontal scroll at 1280x720; composer and Send aligned at the bottom; nothing focused on load.
result: [pending]

### 2. AI buy and add, chips and row highlight
expected: Send "Please buy some Apple", then "add something". A BUY chip appears under the reply; the AAPL position row and the new PYPL watchlist row turn blue for about 1.5 s, then fade over about 1 s; the highlight is visible but not louder than the price flash; hovering a highlighted watchlist row keeps the blue; no flicker at the end of the fade.
result: [pending]

### 3. Collapse, expand, keys and chips
expected: Collapse the panel and expand it again: conversation, draft and any pending request survive; focus lands on the rail button after collapse and on the composer after expand; scroll stays at the newest message. Enter sends, Shift+Enter inserts a newline; a quick-prompt chip sends its question once.
result: [pending]

### 4. Reduced motion and the no-key 502
expected: With prefers-reduced-motion, an AI buy changes the highlight without a transition. With LLM_MOCK=false and no API key, sending a message shows an inline error block with "OPENROUTER_API_KEY is not set" and "Your message was kept", and the typed text remains.
result: [pending]

### 5. Real LLM quality (optional, needs a key)
expected: With LLM_MOCK=false and a key, asking for a portfolio analysis and a trade gives a concise, relevant reply; trades and watchlist changes execute and show chips with status.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
