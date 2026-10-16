---
status: complete
phase: 03-live-watchlist-header
source: [03-VERIFICATION.md]
started: 2026-10-16T21:03:20Z
updated: 2026-10-16T21:14:24.610Z
---

## Current Test

[testing complete]

## Tests

### 1. Price flash paint
expected: A changed price tints green (up) or red (down) and fades over about 500ms; only changed rows flash. With Reduce Motion on, no flash paints.
result: pass

### 2. Sparklines and connection dot
expected: Sparklines fill in, colored by net move since load. After `docker stop finally-p3` the header dot turns yellow; after `docker start finally-p3` it returns to green and prices resume.
result: pass

### 3. Layout at 1280x720
expected: The 10 rows and the add form fit the watchlist panel without scrolling; Chart and Heatmap cells are about 200px wide or more; header figures do not wrap.
result: pass

### 4. Add and remove in the browser
expected: Typing `dis` and pressing Add shows a DIS row. `toolongx` shows "Invalid ticker: 'TOOLONGX'" inline in red. Removing DIS drops the row and returns focus to the input.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
