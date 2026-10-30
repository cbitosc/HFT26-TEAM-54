"""The evaluator: hidden tests in a sandbox + code-computed metrics. An LLM never sets the score.

    from evaluator import evaluate
    evaluate(1, code) -> {"metrics": [4 ints], "score": int, "failed_cases": [ids], "results": [...],
                          "lint_issues": [...], "max_complexity": int | None}

P2's attest/sign.py imports this to RE-RUN the tests before signing.
"""
import json
from pathlib import Path

from evaluator import metrics as _m
from evaluator.sandbox import grade

REPO_ROOT = Path(__file__).resolve().parent.parent
METRIC_NAMES = _m.METRIC_NAMES
WEIGHTS = _m.WEIGHTS


def load_task(task_id: int) -> dict:
    tasks = json.loads((REPO_ROOT / "tasks" / "tasks.json").read_text(encoding="utf-8"))
    info = tasks[str(task_id)]
    return {**info, "path": REPO_ROOT / info["dir"]}


def tests_path(task_id: int) -> Path:
    return load_task(task_id)["path"] / "tests.json"


def evaluate(task_id: int, code: str) -> dict:
    suite = json.loads(tests_path(task_id).read_text(encoding="utf-8"))
    results = grade(code, suite)
    issues = _m.lint_issues(code)
    complexity = _m.max_complexity(code)
    metrics = [
        _m.pass_rate(results, "core"),
        _m.pass_rate(results, "edge"),
        _m.lint_score(issues),
        _m.simplicity_score(complexity),
    ]
    return {
        "metrics": metrics,
        "score": _m.score(metrics),
        "failed_cases": [r["id"] for r in results if not r["passed"]],
        "results": results,
        "lint_issues": issues,
        "max_complexity": complexity,
    }


__all__ = ["METRIC_NAMES", "WEIGHTS", "evaluate", "load_task", "tests_path"]
