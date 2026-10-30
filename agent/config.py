"""Paths, model IDs and .env loading for agent/. (P3's common/config.py covers chain settings.)"""
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = REPO_ROOT / "agent"
RUNS_DIR = REPO_ROOT / "runs"
CACHE_DIR = AGENT_DIR / ".cache"
MOCK_DIR = AGENT_DIR / "mock_responses"
PROMPTS_DIR = AGENT_DIR / "prompts"

FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
# Checked against the live Featherless catalog (GET /v1/models) on 2026-10-30.
# "deepseek-ai/DeepSeek-R1" is NOT in the catalog; DeepSeek-R1-0528 is the full R1 that is.
GENERATOR_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct"
CRITIC_MODEL = "deepseek-ai/DeepSeek-R1-0528"
CRITIC_FALLBACK_MODEL = "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B"  # PLAN.md fallback if R1 is too slow
TEMPERATURE = 0.0
SEED = 42
GENERATOR_MAX_TOKENS = 1500
CRITIC_MAX_TOKENS = 3000


def load_env() -> None:
    """Load .env from the repo root into os.environ (never prints values)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(REPO_ROOT / ".env", override=False)


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)
