"""Deploy with web3 + the NODE's gas estimates (used for testnets).

Why not `forge script`: forge simulates gas with its built-in EVM, which (Foundry 1.8.7) does not model
Sepolia's current gas schedule (a plain transfer costs ~207k gas there), so every forge tx ran out of gas.
eth_estimateGas from the real node is always right for the real chain.

Run from the repo root after `forge build` (pipeline/deploy.sh does both):
    python -m pipeline.deploy_web3
Writes schemas/deployments.<CHAIN>.json and schemas/abi/AutoEvolveRegistry.json.
"""
import json
import os

from common.config import CHAIN, ROOT, SCHEMAS, addresses, get_web3
from pipeline.post_deploy import CHAIN_IDS, EXPLORERS

OUT = ROOT / "contracts" / "out"
REWARD_WEI = int(os.getenv("REWARD_WEI", str(10**15)))
FUND_WEI = int(os.getenv("FUND_WEI", str(10**16)))
HEADROOM = 1.25  # on top of the node's own estimate


def artifact(sol, name):
    a = json.loads((OUT / sol / f"{name}.json").read_text())
    return a["abi"], a["bytecode"]["object"]


def send(w3, acct, tx, label):
    tx = {**tx, "from": acct.address, "nonce": w3.eth.get_transaction_count(acct.address), "chainId": w3.eth.chain_id}
    tx["gas"] = int(w3.eth.estimate_gas(tx) * HEADROOM)
    receipt = w3.eth.wait_for_transaction_receipt(
        w3.eth.send_raw_transaction(acct.sign_transaction(tx).raw_transaction), timeout=300)
    if receipt.status != 1:
        raise SystemExit(f"{label} FAILED (tx 0x{receipt.transactionHash.hex()}, gasUsed {receipt.gasUsed}/{tx['gas']})")
    print(f"{label}: ok  gasUsed={receipt.gasUsed:,}  tx=0x{receipt.transactionHash.hex()}")
    return receipt


def main():
    w3 = get_web3()
    assert w3.eth.chain_id == CHAIN_IDS[CHAIN], f"RPC chain {w3.eth.chain_id} != CHAIN={CHAIN}"
    acct = w3.eth.account.from_key(os.environ["DEPLOYER_PRIVATE_KEY"])
    evaluator = "0x" + "0" * 40 if os.getenv("NO_EVALUATOR") == "1" else addresses()["evaluator"]
    print(f"deployer {acct.address}  balance {w3.from_wei(w3.eth.get_balance(acct.address), 'ether')} ETH")

    v_abi, v_bin = artifact("Verifier.sol", "Groth16Verifier")
    r_abi, r_bin = artifact("AutoEvolveRegistry.sol", "AutoEvolveRegistry")

    v_rcpt = send(w3, acct, w3.eth.contract(abi=v_abi, bytecode=v_bin).constructor().build_transaction(
        {"from": acct.address}), "deploy Groth16Verifier")
    r_rcpt = send(w3, acct, w3.eth.contract(abi=r_abi, bytecode=r_bin).constructor(
        v_rcpt.contractAddress, evaluator, REWARD_WEI).build_transaction({"from": acct.address}), "deploy AutoEvolveRegistry")
    registry = w3.eth.contract(address=r_rcpt.contractAddress, abi=r_abi)
    send(w3, acct, registry.functions.fund().build_transaction({"from": acct.address, "value": FUND_WEI}),
         f"fund escrow {w3.from_wei(FUND_WEI, 'ether')} ETH")

    deployment = {
        "chain": CHAIN,
        "chain_id": w3.eth.chain_id,
        "registry": r_rcpt.contractAddress,
        "verifier": v_rcpt.contractAddress,
        "evaluator": w3.to_checksum_address(evaluator),
        "deploy_block": r_rcpt.blockNumber,
        "reward_wei": str(REWARD_WEI),
        "explorer": EXPLORERS[CHAIN],
    }
    (SCHEMAS / f"deployments.{CHAIN}.json").write_text(json.dumps(deployment, indent=2) + "\n")
    (SCHEMAS / "abi" / "AutoEvolveRegistry.json").write_text(json.dumps(r_abi, indent=2) + "\n")
    print(json.dumps(deployment, indent=2))


if __name__ == "__main__":
    main()
