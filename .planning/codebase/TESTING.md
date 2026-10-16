---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
<!-- refreshed: 2026-10-16 -->

# Testing Patterns

**Analysis Date:** 2026-10-16

**Scope note:** `frontend/` was deleted in commit `065e016`; no Vitest/React Testing Library tests exist on disk. This document covers the backend pytest suite (`backend/tests/`) and the Playwright E2E suite (`test/`).

## Test Framework

**Backend unit/integration runner:**
- pytest `>=9.1.1` with `pytest-asyncio >=1.4.0` and `httpx >=0.28.1` (dev group in `backend/pyproject.toml`).
- Config: `[tool.pytest.ini_options]` in `backend/pyproject.toml`:
  - `asyncio_mode = "auto"`: `async def test_...` functions run without `@pytest.mark.asyncio`.
  - `testpaths = ["tests"]`
  - `pythonpath = ["."]`: tests import `app.*` and `tests.*` directly.
- Assertion library: pytest built-in `assert` with `pytest.approx`, `pytest.raises(..., match=...)`.
- HTTP client: `fastapi.testclient.TestClient` (wraps httpx).

**E2E runner:**
- Playwright Test `1.64.1` (`test/package.json`), TypeScript.
- Config: `test/playwright.config.ts`.
- Browser: Desktop Chrome device profile, viewport 1600x1000.

**Run Commands:**

```bash
uv run --project backend pytest                 # Run all backend tests
uv run --project backend pytest tests/services  # Run one package
uv run --project backend pytest -k sell         # Filter by name
uv run --project backend pytest -x -q           # Stop on first failure

# Watch mode: not configured

# Coverage: not configured (no pytest-cov in dev group)

cd test && npm test                              # Run E2E against BASE_URL (default http://localhost:8010)
cd test && npm run test:docker                   # Full E2E in docker-compose.test.yml, then tear down
```

## Test File Organization

**Location:**
- Backend tests live in a separate tree, `backend/tests/`, mirroring `backend/app/`, not co-located with source.
- E2E tests live in `test/tests/`, separate from the app, per PLAN.md section 4.

**Naming:**
- Python: `test_<unit>.py`; test functions `test_<behavior_in_words>` (e.g. `test_selling_everything_deletes_position`, `test_watchlist_errors`).
- E2E: `<feature>.spec.ts` (`trading.spec.ts`, `watchlist.spec.ts`, `chat.spec.ts`, `fresh-start.spec.ts`, `sse-reconnect.spec.ts`, `portfolio-charts.spec.ts`).

**Structure:**

```
backend/tests/
├── __init__.py
├── conftest.py                  # (none at root; fixtures are per package)
├── chat/        conftest.py, test_llm.py, test_prompt.py, test_router.py, test_service.py
├── db/          conftest.py, test_connection.py, test_repository.py
├── market/      test_cache.py, test_conformance.py, test_factory.py, test_massive_source.py, test_simulator.py, test_stream.py
├── routes/      conftest.py, test_api.py
└── services/    conftest.py, test_portfolio.py, test_watchlist.py

test/tests/
├── helpers.ts                   # Shared API/UI helpers (not a spec)
├── fresh-start.spec.ts          # Runs first (project "fresh-start")
├── trading.spec.ts
├── watchlist.spec.ts
├── chat.spec.ts
├── portfolio-charts.spec.ts
└── sse-reconnect.spec.ts
```

- Packages under `backend/tests/` have an `__init__.py` (`chat`, `market`, `routes`, `services`, `tests`). `db/` does not.

## Test Structure

**Suite Organization:**
Flat test functions grouped by module, with `@pytest.mark.parametrize` for input tables:

```python

# backend/tests/services/test_portfolio.py

@pytest.mark.parametrize(
    ("ticker", "side", "quantity", "reason"),
    [
        ("AAPL", "hold", 1, "Side"),
        ("AAPL", "buy", 0, "Quantity"),
        ("ZZZZ", "buy", 1, "Unknown ticker"),
        ("AAPL", "buy", 101, "Insufficient cash"),
        ("AAPL", "sell", 1, "Insufficient shares"),
    ],
)
def test_invalid_trades_rejected_without_writes(conn, cache, ticker, side, quantity, reason):
    with pytest.raises(ValidationError, match=reason):
        execute_trade(conn, cache, ticker, side, quantity)
    assert repository.get_cash(conn) == 10000.0
    assert repository.list_positions(conn) == []
```

**Patterns:**
- **Arrange with fixtures, act with one call, assert on state.** Assert both the return value and the persisted state (e.g. cash unchanged after a rejected trade).
- **Reject-without-write:** invalid input tests assert that cash and positions are unchanged.
- **Parametrize** over (input, expected-error-substring) tuples rather than one test per case.
- **Async tests** are plain `async def test_...` (auto mode); no marker needed.
- **Route assertions** check status code and response shape: `assert set(response.json()) == {"error"}`.
- No explicit setup/teardown methods; fixtures with `yield` handle cleanup (`with get_connection() as connection: yield connection`).

## Fixtures

**Database fixtures (per package conftest):**

```python

# backend/tests/db/conftest.py

@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """Point FINALLY_DB_PATH at a fresh temp file and initialize it."""
    path = tmp_path / "data" / "finally.db"
    monkeypatch.setenv("FINALLY_DB_PATH", str(path))
    init_db()
    return path

@pytest.fixture
def conn(db_path):
    with get_connection() as connection:
        yield connection
```

- Every DB test uses `tmp_path` + `FINALLY_DB_PATH` via `monkeypatch`. Tests never touch `db/finally.db`.
- `backend/tests/services/conftest.py` and `backend/tests/chat/conftest.py` redefine `conn` with the same pattern.

**Price cache fixture:**
- `cache` (in `services/conftest.py`) is a `PriceCache` seeded with fixed prices: `AAPL=100.0`, `MSFT=400.0`. Tests then call `cache.update("AAPL", 130.0)` to move prices deterministically.

**Market source fixture:**
- `source` builds a `SimulatorDataSource` around `GBMSimulator(random.Random(0))` and is **never started**, so prices stay fixed. Seeded tickers are added with `source.simulator.add(ticker)`.

**App client fixture:**

```python

# backend/tests/routes/conftest.py

@pytest.fixture
def client(tmp_path, monkeypatch):
    """The full app (simulator, mock LLM) against a fresh database."""
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("LLM_MOCK", "true")
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
    with TestClient(app) as test_client:
        yield test_client
```

- `TestClient(app)` as a context manager runs the FastAPI lifespan (DB init, simulator start, snapshot task).
- `backend/tests/chat/test_router.py` defines its own equivalent `client` fixture.

**Test data:**
- Default ticker list is duplicated as `DEFAULT_TICKERS` in `backend/tests/routes/test_api.py`. Prefer importing `DEFAULT_TICKERS` from `app.db.connection` if it is needed again.
- No factory library. Build fixtures inline or with `types.SimpleNamespace` for SDK-shaped objects (see `snap(...)` in `backend/tests/market/test_massive_source.py`).

## Mocking

**Framework:** `pytest`'s `monkeypatch` fixture. No `unittest.mock`, `pytest-mock`, or `respx` usage in the backend tests.

**Patterns:**

Environment variables (most common):

```python
monkeypatch.setenv("LLM_MOCK", "true")
monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
```

Replace a module-level function or client with a fake:

```python

# backend/tests/chat/test_llm.py

monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
monkeypatch.setattr(llm, "acompletion", fake_completion)
```

Fake a third-party SDK client by class, not by patching internals:

```python

# backend/tests/market/test_massive_source.py

class FakeClient:
    """Stands in for massive.RESTClient. No network."""
    def __init__(self, snapshot_error=None, known=None):
        ...
```

Inject the fake through the constructor: `MassiveDataSource(cache, FakeClient(), poll_interval=60)`.

Replace the LLM service function for chat-orchestration tests:

```python

# backend/tests/chat/test_service.py

@pytest.fixture
def fake_reply(monkeypatch): ...
```

**What to Mock:**
- Network clients (Massive REST, LiteLLM `acompletion`).
- Environment configuration (`LLM_MOCK`, `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `FINALLY_DB_PATH`).
- Time-dependent or randomness-dependent market data: use `random.Random(0)` to seed the simulator.

**What NOT to Mock:**
- SQLite. Tests use real temp-file databases through `get_connection` / `init_db`.
- The `PriceCache`. It is a plain in-memory object; use the real class with `update(...)`.
- FastAPI routing and error handlers. Route tests run through `TestClient` against the real `app`.

## Mock LLM Mode

`LLM_MOCK=true` routes chat through `backend/app/chat/mock.py`, which returns keyword-driven replies (`buy`, `sell`, `add`, default). Use it for all route and E2E chat tests; it is deterministic and free. Test the real-model path only by patching `acompletion` as in `test_request_reply_parses_model_output`.

## Fixtures and Factories

See the Fixtures section above. Fixture locations:
- `backend/tests/db/conftest.py`: `db_path`, `conn` (DB only)
- `backend/tests/services/conftest.py`: `conn`, `cache`, `source`
- `backend/tests/chat/conftest.py`: `conn`, `cache`, `source` (single-ticker variant)
- `backend/tests/routes/conftest.py`: `client` (full app)
- `test/tests/helpers.ts`: API helpers (`getPortfolio`, `heldQuantity`, `tradeViaApi`, `closePosition`) and `parseNumber`/`readNumber` for DOM text

## Coverage

**Requirements:** None enforced. No `--cov` flags, no `fail_under`, no coverage tool in the dev group.

**View Coverage:**

```bash
uv run --project backend --with pytest-cov pytest --cov=app --cov-report=term-missing
```

(Not a committed command; `pytest-cov` is not a dependency. Add with `uv add --dev pytest-cov` if coverage reporting is wanted.)

## Test Types

**Unit Tests (backend):**
- Pure logic with fixtures: `GBMSimulator`, `PriceCache`, `execute_trade`, `get_portfolio`, `normalize_ticker`, `parse_reply`, `build_messages`.
- Location: `backend/tests/{market,services,chat,db}/`.

**Integration Tests (backend):**
- Service + real SQLite: `backend/tests/db/test_repository.py`, `backend/tests/services/test_portfolio.py`.
- Full app through HTTP: `backend/tests/routes/test_api.py`, `backend/tests/chat/test_router.py`.
- Contract tests that run the same assertions against every `MarketDataSource` implementation: `backend/tests/market/test_conformance.py` (parametrized over `make_simulator` and `make_massive`). Add new sources to this parametrization.

**E2E Tests (`test/`):**
- Playwright against the running container (`BASE_URL`, default `http://localhost:8010`) with `LLM_MOCK=true`.
- Serial execution: `workers: 1`, `fullyParallel: false`, because tests share one database. The `fresh-start` project runs first; `features` depends on it.
- Setup through the API (`tradeViaApi`, `closePosition`) rather than the UI, then assert through the UI.
- Selectors use `data-testid` (`getByTestId("trade-ticker")`, `position-row-${ticker}`). Keep these IDs stable.
- Use `expect.poll(() => readNumber(locator))` for values that change over time (streaming prices, cash after a trade) instead of fixed waits.
- Retries: `0`. Timeouts: test 30s, expect 10s. Traces and screenshots retained on failure.
- Reporters: `list` and `html` (`test/playwright-report/`).
- Docker: `test/docker-compose.test.yml` runs the app plus a Playwright container; `npm run test:docker` tears down volumes afterwards.

**Frontend unit tests:** Not present (frontend deleted). PLAN.md specifies Vitest + React Testing Library.

## Common Patterns

**Async Testing (backend):**

```python

# backend/tests/services/test_portfolio.py

async def test_trade_and_sync_records_snapshot(conn, cache, source):
    await execute_trade_and_sync(conn, cache, source, "AAPL", "buy", 1)
    assert [s.total_value for s in repository.list_snapshots(conn)] == [10000.0]
```

**Streaming / SSE testing:**

```python

# backend/tests/market/test_stream.py

disconnect_after = iter([False, False, False, True])
async def is_disconnected():
    return next(disconnect_after)
frames = [frame async for frame in price_events(cache, is_disconnected, interval=0)]
```

Drive the generator with a scripted disconnect sequence and `interval=0` rather than sleeping.

**Error Testing:**

```python
with pytest.raises(ValidationError, match="Insufficient cash"):
    execute_trade(conn, cache, "AAPL", "buy", 101)
```

Route-level error testing asserts the status code and `{"error": ...}` body:

```python
response = client.delete("/api/watchlist/ZZZZ")
assert response.status_code == 404 and "error" in response.json()
```

**Float comparisons:** use `pytest.approx` for weighted-average cost (`assert ...avg_cost == pytest.approx(110.0)`). Exact equality is acceptable for values produced by rounding to cents.

**Parametrized conformance:**

```python
@pytest.mark.parametrize("factory", [make_simulator, make_massive])
async def test_source_contract(factory): ...
```

## Gaps

- No coverage measurement.
- No frontend tests on disk.
- No CI workflow running pytest or Playwright in `.github/workflows/` (only the Claude Code review workflows exist).
- `backend/tests/db/` has no `__init__.py` while sibling packages do; keep consistent if adding files.

---

*Testing analysis: 2026-10-16*
