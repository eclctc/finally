---
status: testing
phase: 01-walking-skeleton
source: [01-VERIFICATION.md]
started: 2026-10-16T15:30:00Z
updated: 2026-10-16T15:30:00Z
---

## Current Test

number: 1
name: Browser check of the running container at http://localhost:8000
expected: |
  The `finally-p1` container (still running) serves a dark shell: backgrounds #0d1117 / #1a1a2e, wordmark "Fin" plus yellow "Ally",
  "Portfolio value" and "Cash" both showing $10,000.00, a red connection dot, seven titled panels
  (Watchlist, Chart, Trade, Heatmap, P&L, Positions, AI Chat), and the layout fits at about 1024px wide.
awaiting: user response

## Tests

### 1. Browser check of the running container at http://localhost:8000
expected: Dark #0d1117 / #1a1a2e shell; "Fin" + yellow "Ally"; Portfolio value and Cash both $10,000.00; red connection dot; seven titled panels; layout fits at ~1024px. Stop the container afterwards with `docker stop finally-p1`.
result: [pending]

### 2. Same-origin network check (no third-party origins)
expected: In browser devtools Network tab, every request from http://localhost:8000 goes to localhost:8000 only (no external fonts, CDNs or hosts).
result: [pending]

### 3. No pure black anywhere in the shell
expected: Visually, no surface or text renders pure black (#000); the darkest background is #0d1117.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
