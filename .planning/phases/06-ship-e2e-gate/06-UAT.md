---
status: testing
phase: 06-ship-e2e-gate
source: [06-VERIFICATION.md]
started: 2026-10-17T01:40:28Z
updated: 2026-10-17T01:40:28Z
---

## Current Test

number: 1
name: Start script opens the browser to a working app
expected: |
  From the main checkout run `FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui FINALLY_VOLUME=finally-ui-data ./scripts/start_mac.sh --build`. The script prints "Waiting for FinAlly to be ready...", then opens the browser on a working app: green connection dot, 10 watchlist rows streaming, $10,000 cash. Re-running without `--build` prints "already running" and opens the browser again. Buying 1 share and sending "hello" in chat both work. `./scripts/stop_mac.sh` with the same FINALLY_CONTAINER stops it (volume kept); a second run says it is not running. Clean up with `docker volume rm finally-ui-data`.
awaiting: user response

## Tests

### 1. Start script opens the browser to a working app
expected: From the main checkout run `FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui FINALLY_VOLUME=finally-ui-data ./scripts/start_mac.sh --build`. The script prints "Waiting for FinAlly to be ready...", then opens the browser on a working app: green connection dot, 10 watchlist rows streaming, $10,000 cash. Re-running without `--build` prints "already running" and opens the browser again. Buying 1 share and sending "hello" in chat both work. `./scripts/stop_mac.sh` with the same FINALLY_CONTAINER stops it (volume kept); a second run says it is not running. Clean up with `docker volume rm finally-ui-data`.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
