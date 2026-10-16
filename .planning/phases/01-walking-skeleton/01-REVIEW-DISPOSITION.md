---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "`cents()` pre-rounding disagrees with Intl rounding and rounds ties asymmetrically"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Connection status dot uses `aria-label` on a generic `span`"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Testid parity test can pass vacuously for template ids"
  - id: IN-01
    severity: info
    disposition: open
    title: "`request` throws a raw `SyntaxError` on a 2xx response with a non-JSON or empty body"
  - id: IN-02
    severity: info
    disposition: open
    title: "Tests assert Phase 1 placeholder state that the next phase must delete"
  - id: IN-03
    severity: info
    disposition: open
    title: "`frontend/.gitignore` ignores every `.env*` file"
  - id: IN-04
    severity: info
    disposition: open
    title: "No `color-scheme: dark`, so native scrollbars and form controls render light"
  - id: IN-05
    severity: info
    disposition: open
    title: "`\"use client\"` on `Dashboard` is unnecessary"
open: 8
total: 8
recorded: 2026-10-16T15:22:35.127Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
