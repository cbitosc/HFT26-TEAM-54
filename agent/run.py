"""The self-improvement loop: generate V1 -> (critique -> revise -> evaluate) x2 -> V3.

    python -m agent.run --task 1 --agent A [--mock-llm]

Writes runs/<run_id>/run.json (public), secret.json (private), events.jsonl (live log).
The LAST stdout line is always the run folder path. Exit code 0 only when status == "improved".
"""
import argparse
import difflib
import json
import secrets
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from agent import config, llm
from agent import prompt_builder as pb
from common.hashing import P, canonical_bytes, code_hash, prompt_hash, test_suite_hash_of_file
from evaluator import METRIC_NAMES, WEIGHTS, evaluate, load_task, tests_path

MAX_SCORE = 100 * sum(WEIGHTS)
MAX_REVISION_ATTEMPTS = 3
ZERO_ADDRESS = "0x" + "0" * 40


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EventLog:
    """Appends one JSON object per line to events.jsonl, flushed immediately (dashboard reads it live)."""

    def __init__(self, path: Path):
        self.path = path

    def __call__(self, step, msg, v=None, score=None, actor="agent"):
        event = {"ts": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"), "actor": actor, "step": step,
                 "v": v, "score": score, "msg": msg}
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
        one_line = " ".join(msg.split())
        print(f"[{step}] " + (f"V{v} " if v else "") + (f"score={score} " if score is not None else "") + one_line)


def agent_wallet(agent: str, override: str = "") -> str:
    """Public address from schemas/addresses.json (keys agent_A / agent_B, PLAN.md 3.1)."""
    if override:
        return override
    try:
        from common.config import addresses
        return addresses()[f"agent_{agent}"]
    except (FileNotFoundError, KeyError):
        print(f"WARNING: no agent_{agent} in schemas/addresses.json; using the zero address. "
              "The on-chain submit will fail with NOT_AGENT until P3 adds it (or pass --wallet).")
        return ZERO_ADDRESS


def changelog_line(n: int, prev: dict, cur: dict) -> str:
    prev_failed, cur_failed = set(prev["failed_cases"]), set(cur["failed_cases"])
    fixed = sorted(prev_failed - cur_failed)
    broke = sorted(cur_failed - prev_failed)
    parts = [f"fixed {', '.join(fixed)}"] if fixed else []
    for i in (2, 3):  # lint, simplicity
        if prev["metrics"][i] != cur["metrics"][i]:
            parts.append(f"{METRIC_NAMES[i]} {prev['metrics'][i]} -> {cur['metrics'][i]}")
    if broke:
        parts.append(f"REGRESSED {', '.join(broke)}")
    delta = cur["score"] - prev["score"]
    parts.append(f"score {prev['score']} -> {cur['score']} ({delta:+d})")
    return f"V{n}: " + "; ".join(parts)


def unified_diff(old: str, new: str, n: int) -> str:
    return "".join(difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True),
                                        fromfile=f"v{n - 1}.py", tofile=f"v{n}.py"))


def make_version(n, code, prev, ev, call, attempts) -> dict:
    return {
        "v": n,
        "code": code,
        "code_hash": code_hash(code),
        "prev_code_hash": prev["code_hash"] if prev else None,
        "diff": unified_diff(prev["code"], code, n) if prev else "",
        "metrics": ev["metrics"],
        "score": ev["score"],
        "failed_cases": ev["failed_cases"],
        "critique": "",
        "attempts": attempts,
        "request_hash": call["request_hash"],
        "response_hash": call["response_hash"],
        "tokens": call["tokens"],
    }


def fallback_critique(ev: dict) -> str:
    """Used only if the critic returns nothing usable (e.g. R1 spent all tokens thinking)."""
    lines = [f"Failing hidden tests: {', '.join(ev['failed_cases']) or 'none'}."]
    if ev["lint_issues"]:
        lines.append("Fix lint: " + "; ".join(ev["lint_issues"]) + ".")
    if (ev["max_complexity"] or 0) > 5:
        lines.append(f"Reduce cyclomatic complexity from {ev['max_complexity']} to 5 or less with helpers.")
    return " ".join(lines)


class Loop:
    def __init__(self, task_id, agent, mock, lessons=None, generator=None, critic=None):
        self.task_id, self.agent, self.mock = task_id, agent, mock
        self.lessons = lessons or []
        self.generator = generator or config.GENERATOR_MODEL
        self.critic = critic or config.CRITIC_MODEL
        self.task = load_task(task_id)
        self.spec = (self.task["path"] / "spec.md").read_text(encoding="utf-8")
        self.system_prompt = pb.load_system_prompt(mock)
        self.mem = "_mem" if self.lessons else ""

    def gen_call(self, user_msg, keys):
        messages = [{"role": "system", "content": self.system_prompt}, {"role": "user", "content": user_msg}]
        return llm.chat(self.generator, messages, config.GENERATOR_MAX_TOKENS, self.mock, keys)

    def generate_v1(self, log):
        """V1 needs a parseable code block; re-ask (with a nudge) up to 3 times."""
        user_msg = pb.generate(self.spec, self.lessons)
        t = self.task_id
        for attempt in range(1, MAX_REVISION_ATTEMPTS + 1):
            call = self.gen_call(user_msg, [f"t{t}_generate{self.mem}", f"t{t}_generate"])
            try:
                return llm.extract_code(call["text"]), call, attempt
            except llm.LLMError:
                log("generate", f"attempt {attempt}: no code block in response, asking again", v=1)
                user_msg += "\n\nYour last reply had no ```python code block. Reply with ONLY one code block."
        raise llm.LLMError("generator never returned a code block for V1")

    def critique(self, n, code, ev):
        msgs = [{"role": "system", "content": pb.CRITIC_SYSTEM},
                {"role": "user", "content": pb.critique(self.spec, code, ev)}]
        t = self.task_id
        call = llm.chat(self.critic, msgs, config.CRITIC_MAX_TOKENS, self.mock,
                        [f"t{t}_critique_v{n}", f"critique_v{n}", "critique"])
        text = llm.strip_think(call["text"])[:2000]
        return text or fallback_critique(ev), not text

    def revise(self, n, current, critique_text, log):
        """Ask for V(n+1) until it scores STRICTLY higher than V(n), max 3 attempts."""
        base_msg = pb.revise(self.spec, current["code"], critique_text, self.lessons)
        user_msg = base_msg
        t, nxt = self.task_id, n + 1
        keys_base = [f"t{t}_revise_v{nxt}{self.mem}", f"t{t}_revise_v{nxt}"]
        for attempt in range(1, MAX_REVISION_ATTEMPTS + 1):
            keys = [f"{k}_a{attempt}" for k in keys_base] + keys_base
            call = self.gen_call(user_msg, keys)
            try:
                code = llm.extract_code(call["text"])
            except llm.LLMError:
                log("revise", f"attempt {attempt}: no code block", v=nxt)
                user_msg = base_msg + "\n\nYour last reply had no ```python code block."
                continue
            ev = evaluate(self.task_id, code)
            log("evaluate", f"attempt {attempt}: metrics {ev['metrics']} failed {ev['failed_cases']}",
                v=nxt, score=ev["score"], actor="evaluator")
            if ev["score"] > current["score"]:
                return code, ev, call, attempt
            user_msg = base_msg + pb.retry_note(attempt, ev, current["score"])
        return None


def new_run_dir(task_id: int, agent: str) -> tuple:
    """run_id = t<task>-<YYYYMMDD-HHMMSS>-<A|B> (UTC). If that second is taken, wait for the next one."""
    for _ in range(5):
        run_id = f"t{task_id}-{utc_now():%Y%m%d-%H%M%S}-{agent}"
        run_dir = config.RUNS_DIR / run_id
        try:
            run_dir.mkdir(parents=True, exist_ok=False)
            return run_id, run_dir
        except FileExistsError:
            time.sleep(1)
    raise RuntimeError("could not create a unique run folder")


def run_loop(task_id: int, agent: str, mock: bool, lessons=None, memory_used=None,
             generator=None, critic=None, wallet="") -> tuple:
    loop = Loop(task_id, agent, mock, lessons, generator, critic)
    run_id, run_dir = new_run_dir(task_id, agent)
    log = EventLog(run_dir / "events.jsonl")

    # Private: lets the prover show it knows the prompt behind the public commitment.
    salt = secrets.randbelow(P - 1) + 1
    secret = {"prompt_hash": str(prompt_hash(loop.system_prompt)), "salt": str(salt)}
    (run_dir / "secret.json").write_text(json.dumps(secret),
                                        encoding="utf-8")

    run = {
        "schema_version": "1.0",
        "run_id": run_id,
        "task_id": task_id,
        "task_family": loop.task["family"],
        "agent": agent,
        "agent_wallet": agent_wallet(agent, wallet),
        # A mock run says so, so it can never be mistaken for real model output.
        "models": {"generator": ("mock/" if mock else "") + loop.generator,
                   "critic": ("mock/" if mock else "") + loop.critic,
                   "temperature": config.TEMPERATURE, "seed": config.SEED},
        "metric_names": METRIC_NAMES,
        "weights": WEIGHTS,
        "test_suite_hash": test_suite_hash_of_file(tests_path(task_id)),
        "versions": [],
        "changelog": [],
        "lessons": [],
        "memory_used": memory_used or [],
        "status": "failed_no_improvement",
    }
    log("generate", f"run {run_id} started: task {task_id}, agent {agent}, "
        f"{'MOCK LLM' if mock else loop.generator}, {len(loop.lessons)} memory lessons")

    try:
        _iterate(loop, run, log)
    except llm.LLMError as exc:
        log("error", str(exc))
        run["status"] = "failed_no_improvement"

    # Written ONCE, in canonical form. Nobody re-saves or reformats this file.
    (run_dir / "run.json").write_bytes(canonical_bytes(run))
    scores = " -> ".join(str(v["score"]) for v in run["versions"])
    log("run_done", f"status {run['status']}; scores {scores}",
        score=run["versions"][-1]["score"] if run["versions"] else None)
    return run_dir, run["status"]


def _iterate(loop: Loop, run: dict, log) -> None:
    code, call, attempts = loop.generate_v1(log)
    log("generate", f"code written ({call['tokens']['completion']} tokens, cached={call['cached']})", v=1)
    ev = evaluate(loop.task_id, code)
    log("evaluate", f"metrics {ev['metrics']} failed {ev['failed_cases']}", v=1, score=ev["score"],
        actor="evaluator")
    run["versions"].append(make_version(1, code, None, ev, call, attempts))
    evals = [ev]

    if ev["score"] >= MAX_SCORE:
        run["status"] = "too_easy"
        log("error", "V1 already scores the maximum: the task needs harder edge rules", v=1)
        return

    for n in (1, 2):
        current = run["versions"][-1]
        if current["score"] >= MAX_SCORE:
            log("error", f"V{n} already scores the maximum, so no strictly better V{n + 1} is possible", v=n)
            return
        if not loop.mock:
            log("critique", f"{loop.critic} is reviewing V{n} (a reasoning model: this can take several minutes)",
                v=n)
        critique_text, fell_back = loop.critique(n, current["code"], evals[-1])
        current["critique"] = critique_text
        log("critique", ("(fallback, critic returned nothing) " if fell_back else "") + critique_text[:160],
            v=n, actor="agent")
        result = loop.revise(n, current, critique_text, log)
        if result is None:
            log("error", f"no revision beat V{n} after {MAX_REVISION_ATTEMPTS} attempts", v=n + 1)
            return
        code, ev, call, attempts = result
        run["versions"].append(make_version(n + 1, code, current, ev, call, attempts))
        evals.append(ev)
        line = changelog_line(n + 1, current, run["versions"][-1])
        run["changelog"].append(line)
        log("revise", line, v=n + 1, score=ev["score"])

    run["status"] = "improved"
    run["lessons"] = _lessons(loop, run, log)


def _lessons(loop: Loop, run: dict, log) -> list:
    msgs = [{"role": "system", "content": pb.LESSONS_SYSTEM},
            {"role": "user", "content": pb.lessons(loop.spec, run["changelog"],
                                                   [v["critique"] for v in run["versions"]])}]
    call = llm.chat(loop.generator, msgs, config.GENERATOR_MAX_TOKENS, loop.mock,
                    [f"t{loop.task_id}_lessons", "lessons"])
    lines = [ln.strip()[2:].strip() for ln in call["text"].splitlines() if ln.strip().startswith("- ")]
    lessons = [{"text": text, "embedding": None} for text in lines[:3] if text]
    for item in lessons:
        log("lessons", item["text"])
    return lessons


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="AutoEvolve agent loop")
    ap.add_argument("--task", type=int, required=True)
    ap.add_argument("--agent", choices=["A", "B"], default="A")
    ap.add_argument("--mock-llm", action="store_true", help="canned responses, no API cost")
    ap.add_argument("--generator", default=None, help=f"default {config.GENERATOR_MODEL}")
    ap.add_argument("--critic", default=None, help=f"default {config.CRITIC_MODEL}")
    ap.add_argument("--wallet", default="", help="override agent wallet address")
    args = ap.parse_args()
    config.load_env()

    run_dir, status = run_loop(args.task, args.agent, args.mock_llm, generator=args.generator,
                               critic=args.critic, wallet=args.wallet)
    print(run_dir.relative_to(config.REPO_ROOT).as_posix())
    sys.exit(0 if status == "improved" else 1)


if __name__ == "__main__":
    main()
