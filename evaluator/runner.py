"""Runs INSIDE the sandbox. Copied next to solution.py and cases.json in a temp dir.

It only reports what the candidate function returned. It never sees the expected outputs:
the comparison happens outside the sandbox in evaluator/sandbox.py.
"""
import json
import sys


def _short(exc):
    return (type(exc).__name__ + ": " + str(exc))[:300]


def main():
    # Read the nonce BEFORE importing candidate code, so a fake results.json written by the
    # candidate (followed by a hard exit) is rejected by the parent.
    nonce = sys.stdin.readline().strip()
    with open("cases.json", encoding="utf-8") as f:
        payload = json.load(f)
    results = []
    try:
        import solution
        fn = getattr(solution, payload["function_name"])
    except BaseException as exc:
        err = "import failed: " + _short(exc)
        results = [{"id": c["id"], "ok": False, "value": None, "error": err} for c in payload["cases"]]
    else:
        for case in payload["cases"]:
            try:
                value = json.loads(json.dumps(fn(*case["args"]), default=str))
                results.append({"id": case["id"], "ok": True, "value": value, "error": None})
            except BaseException as exc:
                results.append({"id": case["id"], "ok": False, "value": None, "error": _short(exc)})
    with open("results.json", "w", encoding="utf-8") as f:
        json.dump({"nonce": nonce, "results": results}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
