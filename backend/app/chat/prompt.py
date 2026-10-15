"""Builds the message list sent to the LLM: system prompt, live context, history, new message."""

import json

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant inside a simulated trading workstation.
The user trades a virtual portfolio with fake money. Market orders fill instantly at the current price.

Your job:
- Analyze portfolio composition, risk concentration, and unrealized P&L.
- Suggest trades with brief reasoning.
- Execute trades when the user asks or agrees, by listing them in "trades".
- Manage the watchlist proactively, by listing changes in "watchlist_changes".
- Be concise and data-driven. Use the numbers in the context below.

Rules:
- Only trade what the user has cash or shares for. Quantities must be positive; fractional shares are allowed.
- Tickers are uppercase symbols of 1 to 5 letters.
- Earlier assistant turns list the actions that ran and whether they failed; take failures into account.
- Always respond with JSON matching the schema: "message" (string), "trades" (array), "watchlist_changes" (array).
  Use empty arrays when there is nothing to do."""


def format_portfolio_context(portfolio: dict, watchlist: list[dict]) -> str:
    """Render cash, positions, watchlist prices, and total value as plain text."""
    lines = [
        f"Cash: ${portfolio['cash_balance']:.2f}",
        f"Total portfolio value: ${portfolio['total_value']:.2f}",
        f"Unrealized P&L: ${portfolio['unrealized_pnl']:.2f}",
        "Positions:",
    ]
    for position in portfolio["positions"]:
        lines.append(
            f"- {position['ticker']}: {position['quantity']} shares, avg cost ${position['avg_cost']:.2f}, "
            f"price ${position['current_price']:.2f}, P&L ${position['unrealized_pnl']:.2f} "
            f"({position['pnl_percent']:.2f}%)"
        )
    if not portfolio["positions"]:
        lines.append("- none")
    lines.append("Watchlist:")
    for entry in watchlist:
        price = f"${entry['price']:.2f}" if entry["price"] is not None else "no price yet"
        lines.append(f"- {entry['ticker']}: {price}")
    return "\n".join(lines)


def format_history_message(role: str, content: str, actions: list[dict] | None) -> dict:
    """Turn a stored chat row into an LLM message, appending any recorded actions."""
    if actions:
        content = f"{content}\n\nActions executed: {json.dumps(actions)}"
    return {"role": role, "content": content}


def build_messages(portfolio: dict, watchlist: list[dict], history: list, user_message: str) -> list[dict]:
    """Assemble the full prompt. `history` is ChatMessage rows, oldest first."""
    context = format_portfolio_context(portfolio, watchlist)
    messages = [{"role": "system", "content": f"{SYSTEM_PROMPT}\n\nCurrent portfolio:\n{context}"}]
    messages += [format_history_message(row.role, row.content, row.actions) for row in history]
    messages.append({"role": "user", "content": user_message})
    return messages
