---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Dashboard test \"selects the first watchlist ticker on a fresh load\" races an effect-synced render (reproduced flake)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Store-driven Watchlist and Dashboard tests assert synchronously after `act` on timing they do not control"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`TradeBar` selection sync reads and writes a mutable ref inside a state updater"
  - id: WR-04
    severity: warning
    disposition: open
    title: "A failed trade request tells the user to \"Try again\" without checking whether it filled"
  - id: WR-05
    severity: warning
    disposition: open
    title: "One failed watchlist reload replaces an already loaded list with \"Reload the page\"; reloads are unordered"
  - id: IN-01
    severity: info
    disposition: open
    title: "Quantity parsing accepts hex, binary and octal literals"
  - id: IN-02
    severity: info
    disposition: open
    title: "`formatQuantity` rounds small fractional positions to \"0\""
  - id: IN-03
    severity: info
    disposition: open
    title: "Hardcoded \"Start $10,000\" label duplicates `STARTING_CASH`"
  - id: IN-04
    severity: info
    disposition: open
    title: "\"Last 10 min\" and \"Since page load\" captions assume 500 ms ticks"
  - id: IN-05
    severity: info
    disposition: open
    title: "Heatmap \"no click or hover handlers\" test cannot fail"
  - id: IN-06
    severity: info
    disposition: open
    title: "Dashboard test claims the P&L chart redraws after a trade but never checks it"
  - id: IN-07
    severity: info
    disposition: open
    title: "`usePortfolioHistory` imports `POLL_MS` from `usePortfolio`; the generation-guard logic is duplicated"
  - id: IN-08
    severity: info
    disposition: open
    title: "Trade result live regions are mounted together with their text"
open: 13
total: 13
recorded: 2026-10-16T23:17:37.504Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
