"""Run untrusted candidate code against a task's test inputs, isolated from this process.

- USE_DOCKER=1 and docker installed: a throwaway python:3.11-slim container, no network, 256 MB RAM.
- Otherwise: a child Python process with a 10 s timeout, a temp working dir and a MINIMAL
  environment (no API keys, no private keys).

Only the test INPUTS go into the sandbox. Expected outputs stay here, and the comparison is done
here, so candidate code cannot read the answers.
"""
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TIMEOUT_SECONDS = 10
DOCKER_IMAGE = "python:3.11-slim"
RUNNER = Path(__file__).with_name("runner.py")


def _minimal_env() -> dict:
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONHASHSEED": "0"}
    if os.name == "nt":
        # Windows Python cannot start without SYSTEMROOT. It is a folder path, not a secret.
        env["SYSTEMROOT"] = os.environ.get("SYSTEMROOT", r"C:\Windows")
    return env


def _use_docker() -> bool:
    return os.environ.get("USE_DOCKER") == "1" and shutil.which("docker") is not None


def _command(workdir: str) -> list:
    if _use_docker():
        return ["docker", "run", "--rm", "-i", "--network", "none", "--memory", "256m",
                "-v", f"{workdir}:/w", "-w", "/w", DOCKER_IMAGE, "python", "runner.py"]
    return [sys.executable, "-s", "-B", "runner.py"]


def _docker_client_env() -> dict:
    env = _minimal_env()
    for key in ("HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA",
                "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG"):
        if key in os.environ:
            env[key] = os.environ[key]
    return env


def _all_failed(cases, error):
    return [{"id": c["id"], "ok": False, "value": None, "error": error} for c in cases]


def run_cases(code: str, function_name: str, cases: list) -> list:
    """Return raw per-case results: [{"id", "ok", "value", "error"}] in case order."""
    nonce = secrets.token_hex(16)
    public_cases = [{"id": c["id"], "args": c["args"]} for c in cases]
    with tempfile.TemporaryDirectory(prefix="ae_sbx_", ignore_cleanup_errors=True) as tmp:
        Path(tmp, "solution.py").write_text(code, encoding="utf-8", newline="\n")
        shutil.copyfile(RUNNER, Path(tmp, "runner.py"))
        Path(tmp, "cases.json").write_text(
            json.dumps({"function_name": function_name, "cases": public_cases}, ensure_ascii=False),
            encoding="utf-8")
        env = _docker_client_env() if _use_docker() else _minimal_env()
        try:
            subprocess.run(_command(tmp), cwd=tmp, env=env, input=nonce + "\n", text=True,
                           capture_output=True, timeout=TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            return _all_failed(cases, f"timeout after {TIMEOUT_SECONDS}s")
        try:
            data = json.loads(Path(tmp, "results.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return _all_failed(cases, "sandbox crashed before writing results")
    by_id = {r.get("id"): r for r in data.get("results", [])} if data.get("nonce") == nonce else {}
    if not by_id:
        return _all_failed(cases, "sandbox results missing or tampered")
    return [by_id.get(c["id"]) or _all_failed([c], "no result")[0] for c in cases]


def _same(a, b) -> bool:
    # Compare as canonical JSON so True != 1 and key order does not matter.
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def grade(code: str, suite: dict) -> list:
    """Run the suite and return [{"id", "category", "args", "passed", "error", "returned"}]."""
    raw = run_cases(code, suite["function_name"], suite["cases"])
    graded = []
    for case, res in zip(suite["cases"], raw, strict=True):
        passed = bool(res["ok"]) and _same(res["value"], case["expected"])
        graded.append({
            "id": case["id"],
            "category": case["category"],
            "args": case["args"],
            "passed": passed,
            "error": res["error"],
            "returned": res["value"] if res["ok"] else None,
        })
    return graded
