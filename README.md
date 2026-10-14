# FinAlly - AI Trading Workstation

A Bloomberg-style trading terminal with live streaming prices, a simulated $10k portfolio, and an LLM assistant that can analyze positions and execute trades from chat.

Built by coding agents as the capstone for an agentic AI coding course.

## Stack

- **Frontend**: Next.js + TypeScript + Tailwind, static export
- **Backend**: FastAPI (Python, managed with `uv`), SSE price streaming
- **Database**: SQLite, lazily initialized
- **AI**: LiteLLM via OpenRouter (Cerebras), structured outputs
- **Market data**: built-in GBM simulator, or Massive API if a key is set

One Docker container serves everything on port 8000.

## Status

| Component | State |
|---|---|
| Market data (simulator, Massive client, price cache, SSE) | Done - see `planning/MARKET_DATA_SUMMARY.md` |
| Portfolio, watchlist, chat API and database | Planned |
| Frontend | Planned |
| Docker, start/stop scripts, E2E tests | Planned |

## Configuration

Copy `.env` values as needed:

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Required for AI chat unless `LLM_MOCK=true` |
| `MASSIVE_API_KEY` | Optional; real market data instead of the simulator |
| `LLM_MOCK` | `true` for deterministic mock LLM replies (testing) |

## Documentation

The full specification is in [`planning/PLAN.md`](planning/PLAN.md).

## License

See [LICENSE](LICENSE).
