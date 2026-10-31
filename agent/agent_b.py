"""Agent B: an independent agent (wallet B) that learns from Agent A through chain + IPFS memory.

    python -m agent.agent_b --task 2 [--mock-llm] [--mock-chain]

It never reads runs/ or any of Agent A's local files. Its only memory source is the registry
contract (record list) and IPFS (the run.json bytes, hash-checked against the chain).
"""
import argparse
import sys

from agent import config, memory
from agent.run import run_loop
from evaluator import load_task


def load_memory(task_id: int, mock_chain: bool) -> tuple:
    family = load_task(task_id)["family"]
    lessons, used = memory.collect_lessons(family, mock_chain)
    for text in lessons:
        print(f"INJECTING LESSON: {text}")
    if not lessons:
        print("No verified lessons found; Agent B runs without memory.")
    return lessons, used


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Agent B with verified on-chain memory")
    ap.add_argument("--task", type=int, default=2)
    ap.add_argument("--mock-llm", action="store_true")
    ap.add_argument("--mock-chain", action="store_true", help="simulated chain/IPFS (development only)")
    ap.add_argument("--generator", default=None)
    ap.add_argument("--critic", default=None)
    ap.add_argument("--wallet", default="")
    args = ap.parse_args()
    config.load_env()

    lessons, used = load_memory(args.task, args.mock_chain)
    run_dir, status = run_loop(args.task, "B", args.mock_llm, lessons=lessons, memory_used=used,
                               generator=args.generator, critic=args.critic, wallet=args.wallet)
    print(run_dir.relative_to(config.REPO_ROOT).as_posix())
    sys.exit(0 if status == "improved" else 1)


if __name__ == "__main__":
    main()
