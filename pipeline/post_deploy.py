"""After `forge script ... --broadcast`: read the broadcast file and write what everyone else needs.

Writes schemas/deployments.<CHAIN>.json and schemas/abi/AutoEvolveRegistry.json.
Run from the repo root:  python -m pipeline.post_deploy
"""
import json

from eth_utils import to_checksum_address as cs

from common.config import CHAIN, ROOT, SCHEMAS

CHAIN_IDS = {"local": 31337, "sepolia": 11155111, "basesepolia": 84532}
EXPLORERS = {"local": "", "sepolia": "https://sepolia.etherscan.io", "basesepolia": "https://sepolia.basescan.org"}


def main():
    chain_id = CHAIN_IDS[CHAIN]
    broadcast = ROOT / "contracts" / "broadcast" / "Deploy.s.sol" / str(chain_id) / "run-latest.json"
    data = json.loads(broadcast.read_text())

    created = {t["contractName"]: t for t in data["transactions"] if t.get("transactionType") == "CREATE"}
    verifier, registry = created["Groth16Verifier"], created["AutoEvolveRegistry"]
    receipt = next(r for r in data["receipts"] if r["transactionHash"] == registry["hash"])
    ctor_args = registry["arguments"]  # [verifier, evaluator, rewardWei]

    deployment = {
        "chain": CHAIN,
        "chain_id": chain_id,
        "registry": cs(registry["contractAddress"]),
        "verifier": cs(verifier["contractAddress"]),
        "evaluator": cs(ctor_args[1]),
        "deploy_block": int(receipt["blockNumber"], 16),
        "reward_wei": str(int(ctor_args[2])),
        "explorer": EXPLORERS[CHAIN],
    }
    (SCHEMAS / f"deployments.{CHAIN}.json").write_text(json.dumps(deployment, indent=2) + "\n")

    artifact = json.loads((ROOT / "contracts" / "out" / "AutoEvolveRegistry.sol" / "AutoEvolveRegistry.json").read_text())
    (SCHEMAS / "abi" / "AutoEvolveRegistry.json").write_text(json.dumps(artifact["abi"], indent=2) + "\n")

    print(json.dumps(deployment, indent=2))


if __name__ == "__main__":
    main()
