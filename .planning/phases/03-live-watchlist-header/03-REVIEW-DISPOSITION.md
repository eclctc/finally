---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A failed list reload after a successful add or remove replaces the whole list with the \"unavailable\" alert"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Overlapping add and remove calls race on a single `removing` slot and on unordered `load()` responses"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Removing a held ticker from the watchlist wipes its live price, so the header total reverts to the stale API price"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The daily-change cell colors a value that rounds to 0.00% as a gain or loss"
  - id: IN-01
    severity: info
    disposition: open
    title: "The store keeps `flash` on the entry indefinitely, so a remounted price cell re-flashes a stale tick"
  - id: IN-02
    severity: info
    disposition: open
    title: "`usePortfolio().refresh` cannot be reached from other components"
  - id: IN-03
    severity: info
    disposition: open
    title: "`scrollTarget` can stay set when the added row never renders"
  - id: IN-04
    severity: info
    disposition: open
    title: "The sparkline color compares the first and last points of a sliding 300-point window"
open: 8
total: 8
recorded: 2026-10-16T21:00:59.139Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
