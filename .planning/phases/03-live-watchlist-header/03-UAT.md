---
status: testing
phase: 03-live-watchlist-header
source: [03-VERIFICATION.md]
started: 2026-10-16T21:03:20Z
updated: 2026-10-16T21:03:20Z
---

## Current Test

number: 1
name: Price flash paint
expected: |
  At http://127.0.0.1:8010, a changed price tints green (up) or red (down) and fades over about 500ms; only changed rows flash. With the OS Reduce Motion setting on, no flash paints.
awaiting: user response

## Tests

### 1. Price flash paint
expected: A changed price tints green (up) or red (down) and fades over about 500ms; only changed rows flash. With Reduce Motion on, no flash paints.
result: [pending]

### 2. Sparklines and connection dot
expected: Sparklines fill in, colored by net move since load. After `docker stop finally-p3` the header dot turns yellow; after `docker start finally-p3` it returns to green and prices resume.
result: [pending]

### 3. Layout at 1280x720
expected: The 10 rows and the add form fit the watchlist panel without scrolling; Chart and Heatmap cells are about 200px wide or more; header figures do not wrap.
result: [pending]

### 4. Add and remove in the browser
expected: Typing `dis` and pressing Add shows a DIS row. `toolongx` shows "Invalid ticker: 'TOOLONGX'" inline in red. Removing DIS drops the row and returns focus to the input.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
