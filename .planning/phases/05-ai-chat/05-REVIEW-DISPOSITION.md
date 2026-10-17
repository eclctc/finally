---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A lost chat response leaves the UI stale, and Send then replays the message (possible duplicate trades)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "A superseded watchlist load is reported as failure, which silently drops the AI highlight"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The chip `disabled` guard is unreachable, and its test greps the source file instead of testing behavior"
  - id: IN-01
    severity: info
    disposition: open
    title: "A chip click overwrites an unsent draft and the success path then clears it"
  - id: IN-02
    severity: info
    disposition: open
    title: "The `onActionsApplied` promise is dropped, and its type hides that"
  - id: IN-03
    severity: info
    disposition: open
    title: "Low-value and duplicated test and style constants"
  - id: IN-04
    severity: info
    disposition: open
    title: "Retry sends the live draft, not the failed attempt"
open: 7
total: 7
recorded: 2026-10-17T00:20:43.988Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
