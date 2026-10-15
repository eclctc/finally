# E2E Issues

Logged by `integration-tester`. Owners prove the root cause, fix, and reply; the tester re-runs and marks fixed.

| ID | Owner | Status | Summary |
|---|---|---|---|

## Details

None. Both failures in the first run were test bugs, fixed in test/ (service host "app" forced HTTPS via HSTS preload; setOffline does not cut an open SSE stream).
