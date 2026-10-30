"""Self-test for the evaluator. Run: python -m evaluator.selftest"""
import os
import sys

from evaluator import REPO_ROOT, evaluate

SLOPPY_T1 = '''import re, os
def parse_log_line(line):
    parts = line.split(" ")
    if len(parts) < 4:
        return None
    level = parts[2].strip("[]").upper()
    if level not in ("DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"):
        return None
    return {"date": parts[0], "time": parts[1], "level": level, "message": " ".join(parts[3:])}
'''

# Returns the names of all env vars it can see, so we can check no secret leaked in.
ENV_PROBE = '''import os
def parse_log_line(line):
    return sorted(os.environ)
'''

FOREVER = '''def parse_log_line(line):
    while True:
        pass
'''

# Tries to forge a perfect results file and hard-exit before the runner writes the real one.
FORGER = '''import json, os
json.dump({"nonce": "guess", "results": []}, open("results.json", "w"))
os._exit(0)
def parse_log_line(line):
    return None
'''


def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    return ok


def main():
    ok = True
    for t in (1, 2, 3, 4):
        code = (REPO_ROOT / "tasks" / f"t{t}" / "reference.py").read_text(encoding="utf-8")
        r = evaluate(t, code)
        ok &= check(f"t{t} reference scores 10000 (got {r['score']}, metrics {r['metrics']})",
                    r["score"] == 10000)

    a, b = evaluate(1, SLOPPY_T1), evaluate(1, SLOPPY_T1)
    print(f"     sloppy t1: metrics {a['metrics']} score {a['score']} failed {a['failed_cases']}")
    print(f"     sloppy t1 lint: {a['lint_issues']}")
    ok &= check("sloppy t1 scores clearly lower", a["score"] < 9000)
    ok &= check("same code -> identical metrics/score/failed_cases",
                (a["metrics"], a["score"], a["failed_cases"]) == (b["metrics"], b["score"], b["failed_cases"]))

    os.environ["FEATHERLESS_API_KEY"] = os.environ.get("FEATHERLESS_API_KEY", "selftest-fake-key")
    seen = evaluate(1, ENV_PROBE)["results"][0]["returned"] or []
    print(f"     env vars visible inside sandbox: {seen}")
    ok &= check("sandbox env has no API/private keys",
                not any(k.endswith("_KEY") or "PRIVATE" in k or "JWT" in k for k in seen))

    r = evaluate(1, FOREVER)
    ok &= check(f"infinite loop times out, all tests fail ({r['results'][0]['error']})",
                r["metrics"][:2] == [0, 0])

    r = evaluate(1, FORGER)
    ok &= check(f"forged results.json rejected ({r['results'][0]['error']})", r["metrics"][:2] == [0, 0])

    r = evaluate(1, "def parse_log_line(:\n")
    ok &= check(f"syntax error -> tests 0, simplicity 0 (metrics {r['metrics']})",
                r["metrics"][0] == 0 and r["metrics"][3] == 0)

    print("ALL PASS" if ok else "SOME CHECKS FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
