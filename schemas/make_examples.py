"""Regenerate schemas/examples/*. Every hash is real; the values are fake but mutually consistent.

Run from the repo root:  python schemas/make_examples.py
The evaluator signature uses Anvil's public test key #1, NOT our real evaluator key.
"""
import difflib
import json
from pathlib import Path

from eth_abi import encode
from eth_account import Account
from eth_account.messages import encode_defunct

from common.hashing import (
    P, canonical_bytes, code_hash, keccak, keccak_hex, prompt_hash, snapshot_hash_of_file, test_suite_hash_of_file,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "schemas" / "examples"
WEIGHTS = [50, 20, 15, 15]
CHAIN_ID = 11155111
REGISTRY = "0x1000000000000000000000000000000000000001"  # fake
EXAMPLE_EVAL_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"  # Anvil #1, public
AGENT = json.loads((ROOT / "schemas" / "addresses.json").read_text())["agent_A"]
CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"  # fake
TX = "0x" + "ab" * 32  # fake

CODES = [
    'def parse_log_line(line):\n    parts = line.split(" ", 3)\n    return {"level": parts[2], "message": parts[3]}\n',
    'def parse_log_line(line):\n    parts = line.strip().split(None, 3)\n    if len(parts) < 4:\n        return None\n'
    '    return {"level": parts[2].upper(), "message": parts[3]}\n',
    'import re\n\n\ndef parse_log_line(line):\n    m = re.match(r"^(\\S+)\\s+(\\S+)\\s+([A-Za-z]+)\\s+(.*)$", line.strip())\n'
    '    return {"level": m[3].upper(), "message": m[4]} if m else None\n',
]
METRICS = [[62, 25, 90, 100], [87, 50, 90, 100], [100, 100, 90, 90]]
FAILED = [["edge_2", "edge_5"], ["edge_7"], []]
CRITIQUES = [
    "Splitting on a single space breaks on tabs and extra spaces; lines with too few fields crash instead of returning None.",
    "Level is upper-cased but timestamps with a 'T' separator are not handled; consider one anchored regex.",
    "",
]


def score(m):
    return sum(w * x for w, x in zip(WEIGHTS, m))


def build_run():
    versions, prev = [], None
    for i, code in enumerate(CODES):
        diff = "" if i == 0 else "".join(difflib.unified_diff(
            CODES[i - 1].splitlines(True), code.splitlines(True), f"v{i}.py", f"v{i + 1}.py"))
        versions.append({
            "v": i + 1, "code": code, "code_hash": code_hash(code), "prev_code_hash": prev, "diff": diff,
            "metrics": METRICS[i], "score": score(METRICS[i]), "failed_cases": FAILED[i],
            "critique": CRITIQUES[i], "attempts": 1,
            "request_hash": keccak_hex(f"request-{i + 1}".encode()), "response_hash": keccak_hex(f"response-{i + 1}".encode()),
            "tokens": {"prompt": 512 + 100 * i, "completion": 300 + 50 * i},
        })
        prev = versions[-1]["code_hash"]
    s = [v["score"] for v in versions]
    return {
        "schema_version": "1.0", "run_id": "t1-20261031-021500-A", "task_id": 1, "task_family": "log_parsing",
        "agent": "A", "agent_wallet": AGENT,
        "models": {"generator": "Qwen/Qwen2.5-Coder-32B-Instruct", "critic": "deepseek-ai/DeepSeek-R1-0528",
                   "temperature": 0.0, "seed": 42},
        "metric_names": ["tests_passed", "edge_cases", "lint", "simplicity"], "weights": WEIGHTS,
        "test_suite_hash": test_suite_hash_of_file(ROOT / "tasks" / "t1" / "tests.json"),
        "versions": versions,
        "changelog": [f"V2: fixed edge_2, edge_5; score {s[0]} -> {s[1]} (+{s[1] - s[0]})",
                      f"V3: fixed edge_7; score {s[1]} -> {s[2]} (+{s[2] - s[1]})"],
        "lessons": [{"text": "Strip whitespace and normalise case before parsing.", "embedding": None}],
        "memory_used": [], "status": "improved",
    }


def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    run = build_run()
    run_path = OUT / "run.example.json"
    run_path.write_bytes(canonical_bytes(run))  # written ONCE as canonical bytes, exactly like the agent does
    snap = snapshot_hash_of_file(run_path)

    secret = {"prompt_hash": str(prompt_hash("example system prompt")), "salt": "1234567890123456789012345678901234567890"}
    dump("secret.example.json", secret)

    flat = [x for m in METRICS for x in m]
    suite = bytes.fromhex(run["test_suite_hash"][2:])
    digest = keccak(encode(
        ["uint256", "address", "uint256", "address", "uint256[12]", "uint256", "bytes32"],
        [CHAIN_ID, REGISTRY, 1, AGENT, flat, snap, suite]))
    acct = Account.from_key(EXAMPLE_EVAL_KEY)
    sig = acct.sign_message(encode_defunct(primitive=digest)).signature.hex()
    dump("evaluator.example.json", {
        "task_id": 1, "agent_wallet": AGENT, "metrics": METRICS, "snapshot_hash": str(snap),
        "test_suite_hash": run["test_suite_hash"], "chain_id": CHAIN_ID, "registry": REGISTRY,
        "evaluator_address": acct.address, "signature": sig if sig.startswith("0x") else "0x" + sig})

    commitment = "9876543210987654321098765432109876543210987654321098765432109876"
    assert int(commitment) < P
    pub = [str(x) for x in flat] + [commitment, str(snap), str(int(AGENT, 16)), "1"]
    assert len(pub) == 16
    dump("proof.example.json", {
        "pA": ["11", "12"], "pB": [["21", "22"], ["23", "24"]], "pC": ["31", "32"],
        "pubSignals": pub, "prompt_commitment": commitment, "verified_locally": True})

    dump("receipt.example.json", {
        "cid": CID, "tx_hash": TX, "block": 7654321, "record_id": 0, "reward_wei": "1000000000000000",
        "chain_id": CHAIN_ID, "explorer_tx_url": f"https://sepolia.etherscan.io/tx/{TX}",
        "ipfs_url": f"https://ipfs.io/ipfs/{CID}"})

    events = [
        {"ts": "2026-10-31T02:15:03Z", "actor": "agent", "step": "generate", "v": 1, "score": None, "msg": "V1 generated"},
        {"ts": "2026-10-31T02:15:09Z", "actor": "evaluator", "step": "evaluate", "v": 1, "score": run["versions"][0]["score"], "msg": "2 failed cases"},
        {"ts": "2026-10-31T02:15:20Z", "actor": "agent", "step": "critique", "v": 1, "score": None, "msg": "critique written"},
        {"ts": "2026-10-31T02:16:40Z", "actor": "agent", "step": "run_done", "v": 3, "score": run["versions"][2]["score"], "msg": "status improved"},
        {"ts": "2026-10-31T02:17:10Z", "actor": "pipeline", "step": "verified", "v": None, "score": None, "msg": "record 0, reward paid"},
    ]
    (OUT / "events.example.jsonl").write_text("".join(json.dumps(e) + "\n" for e in events), encoding="utf-8", newline="\n")

    print("scores:", [v["score"] for v in run["versions"]], "| snapshot_hash:", snap)
    print("signer:", acct.address)


if __name__ == "__main__":
    main()
