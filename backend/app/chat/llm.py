"""LLM call via LiteLLM -> OpenRouter with Cerebras as the inference provider."""

import logging
import os

from litellm import acompletion
from litellm.exceptions import Timeout
from pydantic import ValidationError

from .mock import mock_reply
from .schemas import ChatReply

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"], "allow_fallbacks": False}}
MAX_TOKENS = 4096  # an uncapped request reserves 40k tokens of credit, which can make OpenRouter skip Cerebras
TIMEOUT_SECONDS = 30  # Cerebras replies in seconds; LiteLLM's default would hold a request for 600 s
UPSTREAM_ERROR = "The AI assistant is unavailable, please try again"
TIMEOUT_ERROR = "The AI assistant timed out, please try again"
BAD_REPLY_ERROR = "The AI assistant returned an unusable reply, please try again"


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
            timeout=TIMEOUT_SECONDS,
        )
        content = response.choices[0].message.content
    except Timeout as exc:
        logger.exception("LLM request timed out")
        raise LLMError(TIMEOUT_ERROR) from exc
    except Exception as exc:
        logger.exception("LLM request failed")
        raise LLMError(UPSTREAM_ERROR) from exc
    return parse_reply(content)


def parse_reply(content: str | None) -> ChatReply:
    """Validate raw model output against the ChatReply schema.

    Raises LLMError with a fixed message; the model output is only logged.
    """
    if not content:
        logger.warning("LLM returned an empty reply")
        raise LLMError(BAD_REPLY_ERROR)
    try:
        return ChatReply.model_validate_json(content)
    except ValidationError as exc:
        logger.warning("LLM reply did not match the schema: %s", exc)
        raise LLMError(BAD_REPLY_ERROR) from exc


async def generate_reply(messages: list[dict], user_message: str) -> ChatReply:
    """Return the mock reply in mock mode, otherwise call the real model."""
    if is_mock_enabled():
        return mock_reply(user_message)
    return await request_reply(messages)
