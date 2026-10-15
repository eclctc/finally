# FinAlly E2E Tests

Playwright tests for the PLAN §12 scenarios, using the `data-testid`s in `planning/TEAM.md` §5.

Full run in Docker (fresh database, `LLM_MOCK=true`, app on host port 8010):

```bash
cd test
npm run test:docker
```

Against an already running app (the `fresh-start` test needs a fresh database):

```bash
cd test
npm install && npx playwright install chromium
BASE_URL=http://localhost:8010 npx playwright test
```
