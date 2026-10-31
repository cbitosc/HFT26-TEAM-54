"""Verify a run folder against PLAN.md 3.2/3.3. Read-only.

    python -m agent.check_run runs/<run_id> [--no-reeval]

Checks: canonical bytes, schema fields, metric ranges, score = sum(w*m), V1 < V2 < V3, code-hash
chain, test_suite_hash, no secrets inside run.json, events.jsonl format, and (by default) that the
evaluator re-run reproduces every version's metrics. Prints snapshot_hash for P2/P3.
"""
import argparse
import json
import sys
from pathlib import Path

from agent import config
from common.hashing import canonical_bytes, code_hash, snapshot_hash_of_file, test_suite_hash_of_file
from evaluator import WEIGHTS, evaluate, tests_path

STEPS = {"generate", "evaluate", "critique", "revise", "lessons", "run_done", "sign", "prove", "upload",
         "submit", "verified", "error"}


def check(run_dir: Path, reeval: bool) -> bool:
    ok = True

    def expect(label, cond):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + label)
        ok &= bool(cond)

    raw = (run_dir / "run.json").read_bytes()
    run = json.loads(raw)
    expect("run.json bytes are canonical (written once, never reformatted)", canonical_bytes(run) == raw)
    for key in ("schema_version", "run_id", "task_id", "task_family", "agent", "agent_wallet", "models",
                "metric_names", "weights", "test_suite_hash", "versions", "changelog", "lessons",
                "memory_used", "status"):
        if key not in run:
            expect(f"field {key} present", False)
    expect("weights match PLAN.md", run["weights"] == WEIGHTS)
    expect("test_suite_hash matches tasks/t<id>/tests.json bytes",
           run["test_suite_hash"] == test_suite_hash_of_file(tests_path(run["task_id"])))

    versions = run["versions"]
    prev = None
    for v in versions:
        n = v["v"]
        expect(f"V{n} metrics are 4 ints in 0..100",
               len(v["metrics"]) == 4 and all(isinstance(m, int) and 0 <= m <= 100 for m in v["metrics"]))
        expect(f"V{n} score == sum(w*m) == {v['score']}", v["score"] == sum(w * m for w, m in zip(WEIGHTS, v["metrics"], strict=True)))
        expect(f"V{n} code_hash matches code", v["code_hash"] == code_hash(v["code"]))
        expect(f"V{n} prev_code_hash links to V{n - 1}",
               v["prev_code_hash"] == (prev["code_hash"] if prev else None))
        if prev:
            expect(f"V{n} score {v['score']} > V{n - 1} score {prev['score']}", v["score"] > prev["score"])
        if reeval:
            ev = evaluate(run["task_id"], v["code"])
            expect(f"V{n} evaluator re-run reproduces metrics {ev['metrics']}", ev["metrics"] == v["metrics"])
        prev = v
    if run["status"] == "improved":
        expect("status improved => exactly 3 versions", len(versions) == 3)
        expect("V3 critique is empty", versions[-1]["critique"] == "")
        expect("changelog has 2 lines", len(run["changelog"]) == 2)

    text = raw.decode("utf-8")
    leaks = []
    secret_file = run_dir / "secret.json"
    if secret_file.exists():
        secret = json.loads(secret_file.read_text(encoding="utf-8"))
        leaks += [name for name in ("prompt_hash", "salt") if secret[name] in text]
    sp = config.PROMPTS_DIR / "system_prompt.txt"
    if sp.exists():
        prompt = sp.read_text(encoding="utf-8").strip()
        leaks += ["system prompt" for chunk in prompt.splitlines() if len(chunk) > 20 and chunk in text][:1]
    config.load_env()
    import os
    for name in ("FEATHERLESS_API_KEY", "PINATA_JWT", "DEPLOYER_PRIVATE_KEY", "AGENT_A_PRIVATE_KEY",
                 "AGENT_B_PRIVATE_KEY", "EVALUATOR_PRIVATE_KEY"):
        value = os.environ.get(name, "")
        if len(value) > 8 and value in text:
            leaks.append(name)
    expect(f"no secrets inside run.json {leaks or ''}", not leaks)

    events_ok = True
    for line in (run_dir / "events.jsonl").read_text(encoding="utf-8").splitlines():
        e = json.loads(line)
        events_ok &= set(e) == {"ts", "actor", "step", "v", "score", "msg"} and e["step"] in STEPS
    expect("events.jsonl lines match the PLAN.md format", events_ok)

    print(f"status        {run['status']}")
    print(f"scores        {' -> '.join(str(v['score']) for v in versions)}")
    print(f"snapshot_hash {snapshot_hash_of_file(run_dir / 'run.json')}")
    return ok


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("run_dir")
    ap.add_argument("--no-reeval", action="store_true")
    args = ap.parse_args()
    ok = check(Path(args.run_dir), not args.no_reeval)
    print("ALL PASS" if ok else "SOME CHECKS FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
