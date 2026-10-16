---
phase: "01"
slug: walking-skeleton
overall_score: 20
audited: "2026-10-16"
baseline: 01-UI-SPEC.md
screenshots: .planning/ui-reviews/01-20261016-113212/ (desktop 1440x900, tablet 768x1024, mobile 375x812, min1024 1024x768; gitignored)
---

# Phase 1 — UI Review

Audited against `01-UI-SPEC.md` from the running container at http://localhost:8000.

## Pillar Summary

| Pillar | Score | Key finding |
|--------|-------|-------------|
| Copywriting | 4/4 | Panel titles and failed-state alert match UI-SPEC verbatim; no generic CTA or error copy |
| Visuals | 3/4 | Chart and Heatmap cells collapse to ~68px at the 1024px minimum; connection dot `aria-label` on a generic span |
| Color | 3/4 | Tokens only, accent used exactly twice; `color-scheme: dark` missing from `globals.css` |
| Typography | 4/4 | Four sizes (11/13/18/20px), two weights (400/600); nothing outside contract |
| Spacing | 3/4 | All classes on the declared scale; fixed columns (340 + 360 + 260) overrun the 1024px minimum |
| Experience Design | 3/4 | `--` loading and failed states implemented and tested; no page `h1`, unnamed panel landmarks, unannounced dot |

**Overall: 20/24**

## Top 3 Priority Fixes

1. **Chart and Heatmap collapse at the 1024px minimum** (WARNING, layout). Cells measure ~68px wide at 1024 (`min1024.png`). Decide in UI-SPEC whether to raise `min-w-[1024px]` to ~1280px or narrow the chat (`w-[360px]`) and watchlist columns below 1280px so `grid-cols-[1fr_1fr_260px]` keeps at least ~200px per cell. Resolve before Phase 3 builds the chart.
2. **`color-scheme: dark` missing** (WARNING, contract miss). Add `color-scheme: dark;` to the `html` rule in `frontend/src/app/globals.css`; panel bodies use `overflow-y-auto`, so native scrollbars stay light on Windows. Same as review IN-04.
3. **Connection dot not announced** (WARNING, a11y; same as review WR-02). In `frontend/src/components/Header.tsx`, give the dot `role="img"` with its `aria-label`, or use an `sr-only` text node. Also add a page `h1` (e.g. the wordmark) so panel `h2`s have a parent heading.

## Detailed Findings

### Copywriting (4/4)
- Failed-state copy `Portfolio unavailable. Reload the page to try again.` matches UI-SPEC.
- Panel titles Watchlist, Chart, Trade, Heatmap, P&L, Positions, AI Chat match.
- No `Submit`, `Click here`, `went wrong`, `No data`, `Retry` in components or app.

### Visuals (3/4)
- Focal point correct: `total-value` is the only 20px element and the only accent figure in the header.
- Layout collapse at 1024px: Chart and Heatmap ~68px each (`Dashboard.tsx` `grid-cols-[1fr_1fr_260px]` inside `minmax(300px,340px)_1fr`).
- At 768px the header right group sits off-screen with horizontal scroll; UI-SPEC accepts this below 1024 (noted, not scored).
- Connection dot is permanently red in Phase 1, per spec; reads as an error until Phase 3 wires SSE (informational).

### Color (3/4)
- No raw hex or `rgb(` outside `globals.css` `@theme static`; no `#000` or `bg-black`.
- `text-accent` used twice (wordmark "Ally", `total-value`), matching the reserved list.
- `bg-down` on the dot and `text-down` on the alert only.
- Missing `color-scheme` anywhere in `frontend/src`.

### Typography (4/4)
- Sizes: `text-[11px]` (3), `text-lg` (1), `text-xl` (1), 13px body.
- Weights: `font-semibold` (2) only.
- `.figures` mono with `tabular-nums`; `leading-tight` on wordmark and `total-value`.

### Spacing (3/4)
- Scale-conformant: `gap-1`, `px-2`, `h-8`, `px-4`, `gap-8`, `h-14`, `size-2.5` (documented exception), `gap-px` hairlines.
- Arbitrary values are all contract-declared.
- Deduction: fixed-width columns overrun the minimum width (see Visuals).

### Experience Design (3/4)
- Loading: both figures render `--` until `/api/portfolio` answers.
- Error: `role="alert"` line on fetch failure; covered by `Header.test.tsx`.
- Missing: no page `h1`; `Panel.tsx` sections have no `aria-labelledby`; dot `aria-label` ignored on a generic span.
- No retry by design; no Phase 1 controls for disabled or confirmation states.

## Files Audited

`frontend/src/app/{globals.css,layout.tsx,page.tsx}`, `frontend/src/components/{Header,Panel,Dashboard}.tsx`, `frontend/src/lib/{format,testIds,api}.ts`, plan summaries 01-01 to 01-04, `01-UI-SPEC.md`.
