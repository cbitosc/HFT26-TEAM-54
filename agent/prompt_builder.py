"""Every prompt the agent sends, in one place.

Who sees what:
- Generator (Qwen): SECRET system prompt + spec (+ critique, + lessons for Agent B).
- Critic (R1): spec + code + failing INPUTS and what the code returned/raised + lint/complexity.
  It never sees the expected outputs or the secret system prompt.
"""
import json

from agent import config

CRITIC_SYSTEM = (
    "You are a strict senior Python reviewer. You did not write this code. "
    "Find why it fails the specification and say precisely how to fix it. "
    "Keep your private reasoning brief and focused; the answer itself must be short."
)
STYLE_RULES = (
    "Code style (checked by ruff): blank lines must be completely empty (no spaces), no trailing "
    "whitespace, no unused imports or variables, one import per line."
)
LESSONS_SYSTEM = "You write short, general engineering lessons. Never include code."


def load_system_prompt(mock: bool) -> str:
    secret = config.PROMPTS_DIR / "system_prompt.txt"
    if secret.exists():
        return secret.read_text(encoding="utf-8")
    if mock:
        return (config.PROMPTS_DIR / "system_prompt.example.txt").read_text(encoding="utf-8")
    raise FileNotFoundError(
        "agent/prompts/system_prompt.txt is missing. Copy system_prompt.example.txt to it and edit it. "
        "It is SECRET and gitignored.")


def memory_block(lessons: list) -> str:
    if not lessons:
        return ""
    body = "\n".join(f"- {text}" for text in lessons)
    return f"\n\n<CRITICAL_ADVICE_FROM_PAST_RUNS>\n{body}\n</CRITICAL_ADVICE_FROM_PAST_RUNS>"


def generate(spec: str, lessons: list) -> str:
    return (
        f"Implement this task.\n\n<SPEC>\n{spec}\n</SPEC>{memory_block(lessons)}\n\n{STYLE_RULES}\n\n"
        "Reply with exactly one ```python code block containing the complete module. No explanation."
    )


def _case_line(r: dict) -> str:
    args = ", ".join(json.dumps(a, ensure_ascii=False) for a in r["args"])
    if r["error"]:
        outcome = f"raised {r['error']}"
    else:
        outcome = f"returned {json.dumps(r['returned'], ensure_ascii=False)} (wrong)"
    return f"- {r['id']}: input ({args}) -> {outcome}"


def critique(spec: str, code: str, ev: dict) -> str:
    failing = [r for r in ev["results"] if not r["passed"]]
    cases = "\n".join(_case_line(r) for r in failing) or "- none (all hidden tests pass)"
    lint = "\n".join(f"- {i}" for i in ev["lint_issues"]) or "- none"
    return (
        f"<SPEC>\n{spec}\n</SPEC>\n\n<CODE>\n{code}</CODE>\n\n"
        f"Hidden tests that FAIL (input, then what the code did):\n{cases}\n\n"
        f"Lint issues (ruff):\n{lint}\n\n"
        f"Highest cyclomatic complexity of any function: {ev['max_complexity']} "
        "(above 5 loses points; split big functions into small helpers).\n\n"
        "Explain which spec rules the code breaks and exactly how to fix each one. "
        "Plain text only, at most 200 words. No JSON. Do not rewrite the whole program."
    )


def revise(spec: str, code: str, critique_text: str, lessons: list) -> str:
    return (
        f"<SPEC>\n{spec}\n</SPEC>\n\n<CURRENT_CODE>\n{code}</CURRENT_CODE>\n\n"
        f"<REVIEW>\n{critique_text}\n</REVIEW>{memory_block(lessons)}\n\n"
        "Fix every problem in the review while keeping everything that already works. "
        f"Keep functions small. {STYLE_RULES} "
        "Reply with exactly one ```python code block containing the complete corrected module."
    )


def retry_note(attempt: int, cand: dict, current_score: int) -> str:
    failed = ", ".join(cand["failed_cases"]) or "none"
    return (
        f"\n\nAttempt {attempt}: your previous revision scored {cand['score']} "
        f"(metrics {cand['metrics']}, failing: {failed}), which is NOT higher than the current "
        f"score {current_score}. Produce a better revision."
    )


def lessons(spec: str, changelog: list, critiques: list) -> str:
    history = "\n".join(changelog)
    reviews = "\n\n".join(c for c in critiques if c)
    return (
        f"A coding agent solved this task in several versions.\n\n<SPEC>\n{spec}\n</SPEC>\n\n"
        f"<CHANGELOG>\n{history}\n</CHANGELOG>\n\n<REVIEWS>\n{reviews}\n</REVIEWS>\n\n"
        "Write exactly 3 lines starting with '- '. Each is a general, reusable lesson for similar "
        "log-parsing tasks, so a different agent avoids the same mistakes. No code."
    )
