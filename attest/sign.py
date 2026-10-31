"""Evaluator attestation: re-run the tests, then sign the metrics (PLAN.md 3.3 and 3.6).

    python -m attest.sign --run runs/<id> [--chain-id N --registry 0x...]

Refuses to sign (exit 1, no evaluator.json written) unless EVERY check passes:
  - run.json status is "improved" with exactly 3 versions
  - the evaluator, run by us now, reproduces the metrics in run.json for V1, V2 and V3
  - run.json test_suite_hash equals keccak of the real tasks/t<id>/tests.json
There is no flag to skip the re-run. --chain-id / --registry exist for testing only.
The key comes from EVALUATOR_PRIVATE_KEY (.env, loaded by common.config). It is never printed.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from eth_account import Account
from eth_utils import is_address, to_checksum_address

from attest.digest import build_digest, recover_signer, sign_digest
from common.config import addresses, load_deployment  # also loads .env
from common.hashing import snapshot_hash_of_file, test_suite_hash_of_file
from evaluator import evaluate, tests_path

ZERO_ADDRESS = "0x" + "0" * 40


class Refuse(Exception):
    """A check failed: do not sign."""


def loud(msg: str) -> None:
    bar = "!" * 78
    print(f"{bar}\nWARNING: {msg}\n{bar}", file=sys.stderr)


def load_run(run_dir: Path) -> tuple:
    run_path = run_dir / "run.json"
    if not run_path.exists():
        raise Refuse(f"missing {run_path}")
    run = json.loads(run_path.read_bytes().decode("utf-8"))
    if run.get("status") != "improved" or len(run.get("versions", [])) != 3:
        raise Refuse(f"run.json status is {run.get('status')!r} with {len(run.get('versions', []))} versions; "
                     "only an 'improved' run with exactly 3 versions can be signed")
    return run_path, run


def rerun_metrics(run: dict) -> list:
    """Run the hidden tests ourselves for each version; every metric must match run.json."""
    task_id = run["task_id"]
    mismatches = []
    for version in run["versions"]:
        ours = evaluate(task_id, version["code"])["metrics"]
        claimed = version["metrics"]
        same = ours == claimed
        print(f"  V{version['v']}: re-run {ours} vs run.json {claimed} -> {'match' if same else 'MISMATCH'}")
        if not same:
            mismatches.append(f"V{version['v']}: re-run gives {ours}, run.json says {claimed}")
    if mismatches:
        raise Refuse("the evaluator does not reproduce run.json's metrics: " + "; ".join(mismatches))
    return [version["metrics"] for version in run["versions"]]


def chain_and_registry(chain_override, registry_override) -> tuple:
    try:
        dep = load_deployment()
    except FileNotFoundError as exc:
        dep = None
        missing = str(exc)
    chain_id = chain_override if chain_override is not None else (dep or {}).get("chain_id")
    registry = registry_override or (dep or {}).get("registry")
    if chain_id is None or not registry:
        raise Refuse(f"no usable deployment ({missing if dep is None else 'chain_id/registry missing in it'}). "
                     "Ask P3 for schemas/deployments.<CHAIN>.json, or for LOCAL TESTING ONLY pass BOTH "
                     "--chain-id and --registry")
    if chain_override is not None or registry_override:
        loud("--chain-id/--registry override in use. This signature is for TESTING ONLY and will NOT "
             "verify against the real deployment.")
    if not is_address(registry):
        raise Refuse(f"registry is not a valid address: {registry}")
    return int(chain_id), to_checksum_address(registry), dep


def evaluator_account():
    key = os.environ.get("EVALUATOR_PRIVATE_KEY")
    if not key:
        raise Refuse("EVALUATOR_PRIVATE_KEY is not set (put it in .env on the machine that signs)")
    try:
        return key, Account.from_key(key)
    except ValueError:
        raise Refuse("EVALUATOR_PRIVATE_KEY is not a valid private key") from None


def check_evaluator_address(address: str, dep) -> None:
    """The contract only accepts the evaluator it was deployed with: warn if ours differs."""
    expected = {}
    if dep and dep.get("evaluator"):
        expected["deployment file"] = dep["evaluator"]
    try:
        expected["addresses.json"] = addresses()["evaluator"]
    except (FileNotFoundError, KeyError):
        pass
    for source, value in expected.items():
        if value.lower() != address.lower():
            loud(f"your key's address {address} differs from the evaluator in {source} ({value}); "
                 "the contract will reject this signature with BAD_EVALUATOR_SIG")


def attest(run_dir: Path, chain_override=None, registry_override=None) -> dict:
    run_path, run = load_run(run_dir)
    task_id = run["task_id"]

    suite_hash = test_suite_hash_of_file(tests_path(task_id))
    if str(run.get("test_suite_hash", "")).lower() != suite_hash.lower():
        raise Refuse(f"run.json test_suite_hash {run.get('test_suite_hash')} is not keccak of "
                     f"tasks/t{task_id}/tests.json ({suite_hash})")
    print(f"test_suite_hash: {suite_hash} (matches tasks/t{task_id}/tests.json)")

    print("re-running the evaluator on every version:")
    metrics = rerun_metrics(run)

    agent = run.get("agent_wallet", "")
    if not is_address(agent) or agent.lower() == ZERO_ADDRESS:
        raise Refuse(f"agent_wallet {agent!r} is not a usable address (zero address means no agent address was "
                     "configured when the run was made)")

    chain_id, registry, dep = chain_and_registry(chain_override, registry_override)
    key, account = evaluator_account()
    check_evaluator_address(account.address, dep)

    snapshot = snapshot_hash_of_file(run_path)  # raw run.json bytes (PLAN 3.2)
    digest = build_digest(chain_id, registry, task_id, agent, [m for row in metrics for m in row],
                          snapshot, suite_hash)
    signature = sign_digest(digest, key)
    if recover_signer(digest, signature).lower() != account.address.lower():
        raise Refuse("internal error: signature does not recover to the evaluator address")

    return {
        "task_id": task_id,
        "agent_wallet": agent,
        "metrics": metrics,
        "snapshot_hash": str(snapshot),
        "test_suite_hash": suite_hash,
        "chain_id": chain_id,
        "registry": registry,
        "evaluator_address": account.address,
        "signature": signature,
    }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Re-run the tests and sign the metrics")
    ap.add_argument("--run", required=True, help="run folder, e.g. runs/t1-20261031-021500-A")
    ap.add_argument("--chain-id", type=int, default=None, help="TESTING ONLY: override the deployment chain id")
    ap.add_argument("--registry", default=None, help="TESTING ONLY: override the deployment registry address")
    args = ap.parse_args()
    run_dir = Path(args.run)

    try:
        result = attest(run_dir, args.chain_id, args.registry)
    except Refuse as exc:
        print(f"REFUSED TO SIGN: {exc}", file=sys.stderr)
        return 1

    (run_dir / "evaluator.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    event = {"ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "actor": "evaluator",
             "step": "sign", "v": None, "score": None,
             "msg": f"re-ran tests for V1-V3, metrics match run.json; signed by {result['evaluator_address']}"}
    with (run_dir / "events.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")

    print(f"snapshot_hash: {result['snapshot_hash']}")
    print(f"chain_id: {result['chain_id']}  registry: {result['registry']}")
    print(f"evaluator: {result['evaluator_address']}")
    print(f"signature: {result['signature'][:18]}...")
    print(f"wrote {run_dir / 'evaluator.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
