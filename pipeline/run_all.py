"""The whole flow in one command, stopping at the first failure.

    python -m pipeline.run_all --task 1 --agent A         # agent -> sign -> prove -> submit
    python -m pipeline.run_all --task 2 --agent B         # Agent B (uses on-chain memory)
    python -m pipeline.run_all --run runs/<id>            # skip the agent: sign -> prove -> submit an existing run
"""
import argparse
import json
import subprocess
import sys

from common.config import ROOT


def step(name, cmd):
    """Run one stage, stream its output, return its last non-empty line."""
    print(f"\n=== {name}: {' '.join(cmd)}", flush=True)
    p = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    last = ""
    for line in p.stdout:
        print(line, end="", flush=True)
        if line.strip():
            last = line.strip()
    if p.wait() != 0:
        sys.exit(f"\nSTOPPED at '{name}' (exit code {p.returncode}). Fix the message above, then re-run with --run if the run folder exists.")
    return last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", type=int)
    ap.add_argument("--agent", choices=["A", "B"], default="A")
    ap.add_argument("--run", help="existing run folder; skips the agent step")
    a = ap.parse_args()
    py = sys.executable

    if a.run:
        run_dir = a.run
    else:
        if a.task is None:
            ap.error("--task is required unless --run is given")
        cmd = [py, "-m", "agent.run", "--task", str(a.task), "--agent", "A"] if a.agent == "A" \
            else [py, "-m", "agent.agent_b", "--task", str(a.task)]
        run_dir = step("1/4 agent", cmd)  # agent prints the run folder as its last line
        if not (ROOT / run_dir / "run.json").exists():
            sys.exit(f"agent did not print a run folder as its last line (got: {run_dir!r})")

    step("2/4 evaluator signs", [py, "-m", "attest.sign", "--run", run_dir])
    step("3/4 ZK proof", ["node", "zk/prove.js", run_dir])
    step("4/4 IPFS + on-chain submit", [py, "-m", "pipeline.submit", "--run", run_dir])

    run = json.loads((ROOT / run_dir / "run.json").read_text())
    rc = json.loads((ROOT / run_dir / "receipt.json").read_text())
    s = [v["score"] for v in run["versions"]]
    lines = [
        f"run      {run['run_id']}",
        f"scores   V1 {s[0]}  ->  V2 {s[1]}  ->  V3 {s[2]}",
        f"record   #{rc['record_id']}   reward {int(rc['reward_wei']) / 1e18} ETH",
        f"CID      {rc['cid']}",
        f"tx       {rc['explorer_tx_url'] or rc['tx_hash']}",
        f"ipfs     {rc['ipfs_url']}",
    ]
    w = max(map(len, lines)) + 2
    print("\n+" + "-" * w + "+\n" + "\n".join(f"| {l:<{w - 1}}|" for l in lines) + "\n+" + "-" * w + "+")


if __name__ == "__main__":
    main()
