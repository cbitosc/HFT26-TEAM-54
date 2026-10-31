"""Featherless (OpenAI-compatible) client with request/response hashing, a disk cache and a mock mode.

Every call returns:
    {"text", "request_hash", "response_hash", "tokens": {"prompt", "completion"}, "cached", "model"}

- request_hash  = keccak(canonical_bytes(request dict))
- response_hash = keccak(raw response text bytes)
- A real response is cached in agent/.cache/<request_hash>.json. A cache hit never calls the API,
  which makes a run reproducible from its record even though temperature 0 is not fully deterministic.
"""
import json
import re
import time

from agent import config
from common.hashing import canonical_bytes, keccak_hex

_client = None
_seed_supported = True


class LLMError(RuntimeError):
    pass


def strip_think(text: str) -> str:
    """R1 reasons inside <think>...</think>. Keep only what comes after it."""
    if "</think>" in text:
        text = text.split("</think>", 1)[1]
    return text.strip()


def extract_code(text: str) -> str:
    """Return the first ```python block (or any ``` block), normalised to end with one newline."""
    match = re.search(r"```(?:python|py)[^\n]*\n(.*?)```", text, re.DOTALL)
    if match is None:
        match = re.search(r"```[^\n]*\n(.*?)```", text, re.DOTALL)
    if match is None:
        raise LLMError("no code block in model response")
    return match.group(1).strip("\n") + "\n"


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI
        config.load_env()
        key = config.env("FEATHERLESS_API_KEY")
        if not key:
            raise LLMError("FEATHERLESS_API_KEY missing from .env (or use --mock-llm)")
        _client = OpenAI(base_url=config.FEATHERLESS_BASE_URL, api_key=key,
                         timeout=config.REQUEST_TIMEOUT_SECONDS, max_retries=0)
    return _client


def _send(request: dict):
    global _seed_supported
    kwargs = dict(request)
    if not _seed_supported:
        kwargs.pop("seed", None)
    try:
        return _get_client().chat.completions.create(**kwargs)
    except Exception as exc:
        if "seed" in kwargs and "seed" in str(exc).lower():
            _seed_supported = False  # API rejected seed: drop it for this and later calls
            kwargs.pop("seed")
            return _get_client().chat.completions.create(**kwargs)
        raise


def _call_api(request: dict) -> dict:
    last = None
    for attempt in range(3):  # 1 try + 2 retries with backoff
        try:
            resp = _send(request)
            usage = resp.usage
            return {
                # Only the final answer. A reasoning model's hidden thinking (a separate
                # "reasoning" field on Featherless) is deliberately ignored.
                "text": resp.choices[0].message.content or "",
                "finish_reason": resp.choices[0].finish_reason,
                "tokens": {"prompt": getattr(usage, "prompt_tokens", 0) or 0,
                           "completion": getattr(usage, "completion_tokens", 0) or 0},
                "seed_sent": _seed_supported,
            }
        except LLMError:
            raise
        except Exception as exc:
            last = exc
            if getattr(exc, "status_code", None) in (400, 401, 403, 404):
                break  # bad key / unknown model: retrying will not help
            if "timeout" in type(exc).__name__.lower():
                break  # a 15-minute timeout will not get faster on retry
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
    raise LLMError(f"Featherless call failed after 3 attempts: {type(last).__name__}: {str(last)[:300]}")


def _mock(mock_keys: list) -> dict:
    for key in mock_keys:
        path = config.MOCK_DIR / f"{key}.txt"
        if path.exists():
            return {"text": path.read_text(encoding="utf-8"), "tokens": {"prompt": 0, "completion": 0},
                    "mock_file": path.name}
    raise LLMError(f"no mock response for any of {mock_keys} in {config.MOCK_DIR}")


def chat(model: str, messages: list, max_tokens: int, mock: bool = False, mock_keys=None) -> dict:
    """One chat completion. Sequential only; never call this in parallel."""
    request = {"model": model, "messages": messages, "temperature": config.TEMPERATURE,
               "max_tokens": max_tokens, "seed": config.SEED}
    request_hash = keccak_hex(canonical_bytes(request))

    if mock:
        out, cached = _mock(mock_keys or []), False
    else:
        cache_file = config.CACHE_DIR / f"{request_hash}.json"
        if cache_file.exists():
            out, cached = json.loads(cache_file.read_text(encoding="utf-8")), True
        else:
            out, cached = _call_api(request), False
            if out["text"].strip():  # never cache an empty answer, or a re-run would replay it
                config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
                cache_file.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    return {
        "text": out["text"],
        "request_hash": request_hash,
        "response_hash": keccak_hex(out["text"].encode("utf-8")),
        "tokens": out["tokens"],
        "cached": cached,
        "model": model,
    }
