"""Does verified memory help? V1 WITHOUT memory vs V1 WITH memory on the benchmark tasks.

    python -m agent.benchmark --tasks 2 3 4 [--mock-llm] [--mock-chain]

Only 2 generator calls per task. Writes runs/benchmark.json. Reported honestly, even when a task
does not improve.
"""
import argparse
import json
import sys

from agent import config
from agent.agent_b import load_memory
from common.hashing import code_hash
from agent.run import Loop
from evaluator import evaluate


def _quiet_log(step, msg, v=None, score=None, actor="agent"):
    print(f"  [{step}] {msg}")


def _v1(task_id: int, lessons: list, mock: bool, generator) -> dict:
    loop = Loop(task_id, "B", mock, lessons, generator=generator)
    code, call, _ = loop.generate_v1(_quiet_log)
    ev = evaluate(task_id, code)
    return {"metrics": ev["metrics"], "score": ev["score"], "failed_cases": ev["failed_cases"],
            "tokens": call["tokens"], "code_hash": code_hash(code),
            "request_hash": call["request_hash"], "response_hash": call["response_hash"]}


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--tasks", type=int, nargs="+", default=[2, 3, 4])
    ap.add_argument("--mock-llm", action="store_true")
    ap.add_argument("--mock-chain", action="store_true")
    ap.add_argument("--generator", default=None)
    args = ap.parse_args()
    config.load_env()

    lessons, used = load_memory(args.tasks[0], args.mock_chain)
    rows = []
    for task_id in args.tasks:
        print(f"task {task_id}: without memory")
        without = _v1(task_id, [], args.mock_llm, args.generator)
        print(f"task {task_id}: with memory")
        with_mem = _v1(task_id, lessons, args.mock_llm, args.generator)
        print(f"task {task_id}: score {without['score']} without -> {with_mem['score']} with memory "
              f"({with_mem['score'] - without['score']:+d})")
        rows.append({"task_id": task_id, "without": without, "with": with_mem, "lessons_used": lessons})

    n = len(rows)
    summary = {
        "avg_score_without": sum(r["without"]["score"] for r in rows) // n,
        "avg_score_with": sum(r["with"]["score"] for r in rows) // n,
        "tasks_improved": sum(r["with"]["score"] > r["without"]["score"] for r in rows),
        "tasks_total": n,
        "mock_llm": args.mock_llm,
        "mock_chain": args.mock_chain,
        "memory_sources": used,
    }
    out = {"tasks": rows, "summary": summary}
    config.RUNS_DIR.mkdir(exist_ok=True)
    path = config.RUNS_DIR / "benchmark.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"average score: {summary['avg_score_without']} without -> {summary['avg_score_with']} with memory; "
          f"{summary['tasks_improved']}/{n} tasks improved")
    print(path.relative_to(config.REPO_ROOT).as_posix())


if __name__ == "__main__":
    main()
