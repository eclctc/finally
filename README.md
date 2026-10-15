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

## Quick Start

```bash
cp .env.example .env        # add OPENROUTER_API_KEY for AI chat
./scripts/start_mac.sh      # builds the image, runs on http://localhost:8000
./scripts/stop_mac.sh       # stops the container; data persists in the finally-data volume
```

Windows: `scripts/start_windows.ps1` and `scripts/stop_windows.ps1`. Pass `--build` / `-Build` to rebuild, `--no-open` / `-NoOpen` to skip opening the browser.

## Development

```bash
cd backend && uv run pytest                 # backend unit tests
cd frontend && npm test                     # frontend unit tests
cd test && npm run test:docker              # Playwright E2E in Docker (LLM_MOCK=true)
```

Run the backend locally: `cd backend && LLM_MOCK=true uv run uvicorn app.main:app --port 8000`.

## Configuration

Copy `.env` values as needed:

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Required for AI chat unless `LLM_MOCK=true` |
| `MASSIVE_API_KEY` | Optional; real market data instead of the simulator |
| `LLM_MOCK` | `true` for deterministic mock LLM replies (testing) |

## Documentation

The full specification is in [`planning/PLAN.md`](planning/PLAN.md). Team contract and module interfaces: [`planning/TEAM.md`](planning/TEAM.md). Market data design: [`planning/market_data_design.md`](planning/market_data_design.md).

## License

See [LICENSE](LICENSE).
