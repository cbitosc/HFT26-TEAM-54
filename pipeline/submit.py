"""Upload run.json to IPFS and submit the proof on-chain; the contract pays the agent.

    python -m pipeline.submit --run runs/<run_id>

Reads run.json (raw bytes), evaluator.json, proof.json from the run folder; writes receipt.json and
appends upload/submit/verified events. Every check runs BEFORE spending gas or uploading.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from web3.logs import DISCARD

from common.config import addresses, get_registry, get_web3, load_deployment
from common.hashing import keccak, snapshot_hash_of_file, to_field
from pipeline.ipfs import fetch, gateway_url, upload_file

ZERO = "0x" + "0" * 40
KEYS = {"A": "AGENT_A_PRIVATE_KEY", "B": "AGENT_B_PRIVATE_KEY"}


def event(run_dir: Path, step: str, msg: str):
    line = {"ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "actor": "pipeline",
            "step": step, "v": None, "score": None, "msg": msg}
    with open(run_dir / "events.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(line) + "\n")


def fail(run_dir: Path, msg: str):
    event(run_dir, "error", msg)
    sys.exit(f"SUBMIT REFUSED: {msg}")


def checks(run_dir, run, ev, proof, dep, agent_addr, w3):
    pub = [int(x) for x in proof["pubSignals"]]
    snap = snapshot_hash_of_file(run_dir / "run.json")
    must = [
        # PLAN.md 3.1: task 1 is Agent A's, tasks 2-4 are Agent B's. The cheat demo also needs tasks 2-3 unclaimed by A.
        (run["agent"] != "A" or int(run["task_id"]) == 1, f"Agent A may only claim task 1 (this run is task {run['task_id']})"),
        (run["status"] == "improved" and len(run["versions"]) == 3, f"run status is {run['status']!r}, not an improved 3-version run"),
        (not any(str(m).startswith("mock/") for m in run["models"].values() if isinstance(m, str)), "this is a --mock-llm run; mock runs are never submitted"),
        (run["agent_wallet"].lower() != ZERO, "run.json agent_wallet is the zero address (run made before addresses.json existed?)"),
        (run["agent_wallet"].lower() == agent_addr.lower(), f"run.json agent_wallet {run['agent_wallet']} != key for agent {run['agent']} ({agent_addr})"),
        (len(pub) == 16, f"proof has {len(pub)} public signals, expected 16"),
        (proof.get("verified_locally") is True, "proof.json says it was not verified locally"),
        (str(snap) == str(ev["snapshot_hash"]) == str(pub[13]), "snapshot_hash mismatch between run.json bytes, evaluator.json and pubSignals[13]"),
        (pub[14] == int(agent_addr, 16), "pubSignals[14] is not the agent wallet"),
        (pub[15] == int(run["task_id"]) == int(ev["task_id"]), "task id mismatch between run.json, evaluator.json and pubSignals[15]"),
        ([x for v in ev["metrics"] for x in v] == pub[:12], "evaluator-signed metrics != proof's public metrics"),
        ([v["metrics"] for v in run["versions"]] == ev["metrics"], "run.json metrics != evaluator-signed metrics"),
        (int(ev["chain_id"]) == int(dep["chain_id"]) == w3.eth.chain_id, f"evaluator signed for chain {ev['chain_id']}, deployment/RPC is {dep['chain_id']}/{w3.eth.chain_id}"),
        (ev["registry"].lower() == dep["registry"].lower(), f"evaluator signed for registry {ev['registry']}, deployment is {dep['registry']}"),
    ]
    for ok, msg in must:
        if not ok:
            fail(run_dir, msg)
    return pub, snap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    run_dir = Path(ap.parse_args().run)

    raw = (run_dir / "run.json").read_bytes()
    run = json.loads(raw)
    ev = json.loads((run_dir / "evaluator.json").read_text())
    proof = json.loads((run_dir / "proof.json").read_text())
    dep = load_deployment()
    w3 = get_web3()
    registry = get_registry(w3)
    key_var = KEYS[run["agent"]]
    agent = w3.eth.account.from_key(os.environ[key_var])
    if agent.address != addresses()[f"agent_{run['agent']}"]:
        fail(run_dir, f"{key_var} does not match schemas/addresses.json agent_{run['agent']}")

    pub, snap = checks(run_dir, run, ev, proof, dep, agent.address, w3)
    task = int(run["task_id"])
    if registry.functions.claimed(task, agent.address).call():
        fail(run_dir, f"agent {run['agent']} already claimed task {task} on this registry (ALREADY_CLAIMED)")
    print(f"checks passed: task {task}, agent {run['agent']} {agent.address}, scores {[v['score'] for v in run['versions']]}")

    cid = upload_file(run_dir / "run.json", f"{run['run_id']}.json")
    event(run_dir, "upload", f"run.json pinned to IPFS: {cid}")
    print(f"uploaded run.json -> {cid}")

    args = (task, cid, [int(x) for x in proof["pA"]], [[int(x) for x in r] for r in proof["pB"]],
            [int(x) for x in proof["pC"]], pub, bytes.fromhex(ev["signature"].removeprefix("0x")))
    fn = registry.functions.submit(*args)
    try:
        fn.call({"from": agent.address})  # free dry run: surfaces the revert reason without spending gas
    except Exception as e:
        fail(run_dir, f"dry run reverted: {e}")

    tx = fn.build_transaction({"from": agent.address, "nonce": w3.eth.get_transaction_count(agent.address),
                               "chainId": w3.eth.chain_id})
    tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.25)  # node estimate (forge-style local estimates are wrong on Sepolia)
    tx_hash = w3.eth.send_raw_transaction(agent.sign_transaction(tx).raw_transaction)
    event(run_dir, "submit", f"tx sent: 0x{tx_hash.hex()}")
    print(f"tx sent: 0x{tx_hash.hex()}  (waiting for it to be mined...)")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    if receipt.status != 1:
        fail(run_dir, f"transaction reverted on-chain: 0x{tx_hash.hex()}")

    # DISCARD: Sepolia also emits a system log for the ETH reward transfer; it is not our event.
    logs = registry.events.ImprovementVerified().process_receipt(receipt, errors=DISCARD)
    record_id = logs[0]["args"]["recordId"]
    reward = logs[0]["args"]["rewardWei"]

    # Prove the memory is retrievable and untampered: fetch by CID, re-hash, compare with the on-chain record.
    on_chain = registry.functions.getRecord(record_id).call()
    fetched_ok = to_field(keccak(fetch(cid))) == on_chain[3] == snap

    explorer = dep.get("explorer") or ""
    tx_url = f"{explorer}/tx/0x{tx_hash.hex()}" if explorer else ""
    out = {"cid": cid, "tx_hash": "0x" + tx_hash.hex(), "block": receipt.blockNumber, "record_id": record_id,
           "reward_wei": str(reward), "chain_id": w3.eth.chain_id, "explorer_tx_url": tx_url, "ipfs_url": gateway_url(cid)}
    (run_dir / "receipt.json").write_text(json.dumps(out, indent=2) + "\n")
    event(run_dir, "verified", f"record {record_id} on-chain, reward {w3.from_wei(reward, 'ether')} ETH paid; IPFS re-hash ok={fetched_ok}")

    print(f"VERIFIED on-chain: record {record_id}, block {receipt.blockNumber}, gas {receipt.gasUsed:,}")
    print(f"reward: {w3.from_wei(reward, 'ether')} ETH paid to {agent.address}")
    print(f"IPFS bytes re-hash to the on-chain snapshotHash: {fetched_ok}")
    print(f"tx:   {tx_url or '0x' + tx_hash.hex()}")
    print(f"ipfs: {gateway_url(cid)}")


if __name__ == "__main__":
    main()
