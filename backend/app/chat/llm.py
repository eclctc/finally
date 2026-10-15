"""LLM call via LiteLLM -> OpenRouter with Cerebras as the inference provider."""

import os

from litellm import acompletion
from pydantic import ValidationError

from .mock import mock_reply
from .schemas import ChatReply

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"], "allow_fallbacks": False}}
MAX_TOKENS = 4096  # an uncapped request reserves 40k tokens of credit, which can make OpenRouter skip Cerebras


class LLMError(Exception):
    """The LLM call failed or returned output that does not match ChatReply."""


def is_mock_enabled() -> bool:
    return os.getenv("LLM_MOCK", "false").lower() == "true"


async def request_reply(messages: list[dict]) -> ChatReply:
    """Call the model with structured output and parse its reply."""
    if not os.getenv("OPENROUTER_API_KEY"):
        raise LLMError("OPENROUTER_API_KEY is not set")
    try:
        response = await acompletion(
            model=MODEL,
            messages=messages,
            response_format=ChatReply,
            reasoning_effort="low",
            max_tokens=MAX_TOKENS,
            extra_body=EXTRA_BODY,
        )
    except Exception as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc
    return parse_reply(response.choices[0].message.content)


def parse_reply(content: str | None) -> ChatReply:
    """Validate raw model output against the ChatReply schema."""
    if not content:
        raise LLMError("LLM returned an empty response")
    try:
        return ChatReply.model_validate_json(content)
    except ValidationError as exc:
        raise LLMError(f"LLM response did not match schema: {exc}") from exc


async def generate_reply(messages: list[dict], user_message: str) -> ChatReply:
    """Return the mock reply in mock mode, otherwise call the real model."""
    if is_mock_enabled():
        return mock_reply(user_message)
    return await request_reply(messages)
