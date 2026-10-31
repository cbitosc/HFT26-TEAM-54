"""Turn test results + static analysis into the 4 integer metrics (PLAN.md 3.1).

Integer math only, so the same code always gives the same numbers. Nothing here executes the
candidate code: ruff and radon only read it.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from radon.complexity import cc_visit

METRIC_NAMES = ["tests_passed", "edge_cases", "lint", "simplicity"]
WEIGHTS = [50, 20, 15, 15]


def pass_rate(results: list, category: str) -> int:
    cases = [r for r in results if r["category"] == category]
    if not cases:
        return 0
    return (100 * sum(1 for r in cases if r["passed"])) // len(cases)


def lint_issues(code: str) -> list:
    """ruff E,F,W (E501 ignored). Returns ["W291 line 3: Trailing whitespace", ...]."""
    with tempfile.TemporaryDirectory(prefix="ae_lint_", ignore_cleanup_errors=True) as tmp:
        Path(tmp, "solution.py").write_text(code, encoding="utf-8", newline="\n")
        proc = subprocess.run(
            [sys.executable, "-m", "ruff", "check", "--isolated", "--no-cache",
             "--output-format=json", "--select", "E,F,W", "--ignore", "E501", "solution.py"],
            cwd=tmp, capture_output=True, text=True, encoding="utf-8", timeout=60)
    if proc.returncode not in (0, 1):
        raise RuntimeError(f"ruff failed: {proc.stderr.strip()[:300]}")
    items = json.loads(proc.stdout or "[]")
    return [f"{i['code']} line {i['location']['row']}: {i['message']}" for i in items]


def lint_score(issues: list) -> int:
    return max(0, 100 - 10 * len(issues))


def _blocks(blocks):
    for b in blocks:
        yield b
        yield from _blocks(getattr(b, "methods", []) or [])
        yield from _blocks(getattr(b, "closures", []) or [])


def max_complexity(code: str):
    """Highest cyclomatic complexity of any function/method, or None if the code does not parse."""
    try:
        blocks = list(_blocks(cc_visit(code)))
    except Exception:
        return None
    return max((b.complexity for b in blocks), default=1)


def simplicity_score(complexity) -> int:
    if complexity is None:
        return 0
    return max(0, 100 - 10 * max(0, complexity - 5))


def score(metrics: list) -> int:
    return sum(w * m for w, m in zip(WEIGHTS, metrics, strict=True))
