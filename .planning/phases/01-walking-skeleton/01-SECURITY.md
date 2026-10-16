---
phase: "1"
slug: "walking-skeleton"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> frontend/node_modules | Third-party code enters the build and runs during `next build` in Docker | Package code (supply chain) |
| browser -> container :8000 | Static export and `/api/*` share one origin | Portfolio JSON (non-sensitive, simulated) |
| developer browser -> next dev :3100 -> backend :8000 | Dev-only rewrite proxy | API JSON and SSE (local only) |
| backend JSON -> browser DOM | Error text and portfolio numbers rendered in the header | Strings and numbers |
| verify command -> repo working tree | Runtime files (SQLite, logs) could land in the repo | Local runtime files |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information disclosure | Docker image / frontend build | medium | mitigate | `.dockerignore` lists `.env`; the only env read in frontend is `NODE_ENV` in `frontend/next.config.ts:3`; no `NEXT_PUBLIC_*` vars | closed |
| T-01-02 | Information disclosure | next dev rewrite proxy | low | accept | Rewrite gated on `NODE_ENV === "development"` (`frontend/next.config.ts:3`); see AR-01 | closed |
| T-01-03 | Tampering | Third-party font/script origins | low | mitigate | No `next/font/google`, Google Fonts or absolute URLs in `frontend/src` (grep empty); system font stack | closed |
| T-01-04 | Tampering | `ApiError.message` from backend text | low | mitigate | No `dangerouslySetInnerHTML` in `frontend/src` (grep empty); rendered as JSX text | closed |
| T-01-05 | Spoofing | `request()` target URL | low | mitigate | `frontend/src/lib/api.ts:9` fetches the relative `path`; no absolute URL in the file | closed |
| T-01-06 | Information disclosure | Parity test file reads | low | accept | Test-only; see AR-02 | closed |
| T-01-07 | Tampering | Header/Panel rendering of backend data | low | mitigate | No raw-HTML prop in `frontend/src`; values pass through `formatCurrency` as JSX text | closed |
| T-01-08 | Denial of service | Header fetch on mount | low | accept | One request per load, no retry; see AR-03 | closed |
| T-01-09 | Information disclosure | Container on host :8000, all interfaces | low | accept | Existing behavior; loopback binding is a Phase 6 start-script item; see AR-04 | closed |
| T-01-10 | Information disclosure | next dev on :3100 during check | low | accept | Short-lived local dev server, killed by port at end of check; see AR-05 | closed |
| T-01-11 | Tampering | Repo working tree during check | low | mitigate | 01-04 verify uses `mktemp -d` for DB and logs and asserts `git status --porcelain db/ frontend/AGENTS.md` is empty; currently empty | closed |
| T-01-SC | Tampering | npm installs | high | mitigate | All `frontend/package.json` versions exact (no `^`/`~`); `frontend/package-lock.json` tracked; `Dockerfile:5` uses `npm ci`; package set approved at the 01-01 blocking-human checkpoint | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-02 | Rewrite exists only under `next dev`; the static export never contains it | plan 01-01 threat model | 2026-10-16 |
| AR-02 | T-01-06 | Parity test reads the local checkout and is never imported by app code | plan 01-02 threat model | 2026-10-16 |
| AR-03 | T-01-08 | One fetch per page load with no retry cannot amplify load | plan 01-03 threat model | 2026-10-16 |
| AR-04 | T-01-09 | Unchanged existing container behavior; loopback binding deferred to Phase 6 start scripts | plan 01-03 threat model | 2026-10-16 |
| AR-05 | T-01-10 | Local developer tool open for about two minutes during verification | plan 01-04 threat model | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 12 | 12 | 0 | secure-phase orchestrator (ASVS L1 grep evidence) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
