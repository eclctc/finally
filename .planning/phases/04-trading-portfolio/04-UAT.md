---
status: complete
phase: 04-trading-portfolio
source: [04-VERIFICATION.md]
started: 2026-10-16T23:45:00Z
updated: 2026-10-16T23:46:47.184Z
---

## Current Test

[testing complete]

## Tests

### 1. Selection and main chart
expected: On load AAPL is selected (dark fill, yellow ticker); the chart caption shows AAPL, price, change and "Since page load"; the line fills in with a dashed "Open" line; the trade ticker reads AAPL. Clicking NVDA, then Tab to MSFT and Enter, swaps the chart and the trade ticker each time; hovering the chart shows HH:MM:SS plus price; MSFT shows a blue focus ring.
result: pass

### 2. Trades, positions and heatmap
expected: Buy 2 NVDA, then 1 JPM and 0.5 AAPL. Cash drops and a muted "Filled BUY ..." line appears; position rows, heatmap tiles (labels stay inside small tiles, native tooltip on hover, green/red tint) and a P&L line with a dot at its right end appear. Sell 5 TSLA (not held) shows a red inline "Insufficient shares" error.
result: pass

### 3. P&L tooltip and 1280x720 layout
expected: Hovering the P&L chart shows "Mon D, HH:MM:SS", "Total value" and a colored "vs start"; the dashed "Start $10,000" line is visible. At 1280x720 with five or more positions the trade bar fits with no horizontal scroll (including a long error), axis labels do not collide, and the positions table head stays pinned while rows scroll.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
