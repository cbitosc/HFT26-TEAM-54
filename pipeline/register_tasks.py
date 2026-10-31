"""Pin each task's hidden test suite on-chain: registerTask(id, keccak(raw tests.json bytes)).

Run from the repo root:  python -m pipeline.register_tasks --tasks 1 [2 3 4]
Only the deployer (contract owner) can do this. May be repeated; it overwrites.
"""
import argparse
import os

from common.config import ROOT, get_registry, get_web3
from common.hashing import test_suite_hash_of_file


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tasks", nargs="+", type=int, required=True)
    args = ap.parse_args()

    w3 = get_web3()
    registry = get_registry(w3)
    acct = w3.eth.account.from_key(os.environ["DEPLOYER_PRIVATE_KEY"])

    for task in args.tasks:
        suite = test_suite_hash_of_file(ROOT / "tasks" / f"t{task}" / "tests.json")
        tx = registry.functions.registerTask(task, bytes.fromhex(suite[2:])).build_transaction(
            {"from": acct.address, "nonce": w3.eth.get_transaction_count(acct.address), "chainId": w3.eth.chain_id}
        )
        signed = acct.sign_transaction(tx)
        receipt = w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(signed.raw_transaction))
        assert receipt.status == 1, f"registerTask({task}) reverted"
        on_chain = "0x" + registry.functions.testSuiteHash(task).call().hex()
        assert on_chain == suite, f"task {task}: on-chain {on_chain} != local {suite}"
        print(f"task {task} registered: {suite}  (tx {receipt.transactionHash.hex()})")


if __name__ == "__main__":
    main()
