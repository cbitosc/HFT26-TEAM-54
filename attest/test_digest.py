"""Checks attest/digest.py against P3's example. Run from the repo root:
    python -m attest.test_digest        (pytest also works)
"""
import json
import sys
from pathlib import Path

from eth_account import Account

from attest.digest import build_digest, recover_signer, sign_digest

EXAMPLE = Path(__file__).resolve().parent.parent / "schemas" / "examples" / "evaluator.example.json"

# PUBLIC Anvil/Foundry default test keys (accounts #0 and #1). Everyone knows them, so they are
# worthless: never use them on a real chain.
ANVIL_KEYS = {
    0: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    1: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
}


def load_example() -> dict:
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


def digest_args(ev: dict) -> list:
    flat = [m for row in ev["metrics"] for m in row]
    return [ev["chain_id"], ev["registry"], ev["task_id"], ev["agent_wallet"], flat,
            int(ev["snapshot_hash"]), ev["test_suite_hash"]]


def anvil_key_for(address: str):
    for key in ANVIL_KEYS.values():
        if Account.from_key(key).address.lower() == address.lower():
            return key
    return None


def test_example_signature_recovers_to_evaluator_address():
    ev = load_example()
    signer = recover_signer(build_digest(*digest_args(ev)), ev["signature"])
    assert signer.lower() == ev["evaluator_address"].lower(), f"recovered {signer}"


def test_signing_reproduces_example_signature():
    ev = load_example()
    key = anvil_key_for(ev["evaluator_address"])
    assert key is not None, "no known Anvil key owns the example evaluator_address"
    assert sign_digest(build_digest(*digest_args(ev)), key) == ev["signature"]


def test_every_input_changes_the_digest():
    ev = load_example()
    base = digest_args(ev)
    reference = build_digest(*base)
    changes = [
        ("chain_id", 1), ("registry", "0x" + "22" * 20), ("task_id", 2), ("agent", "0x" + "33" * 20),
        ("metrics", [m + 1 for m in base[4]]), ("snapshot_hash", base[5] + 1), ("test_suite_hash", "0x" + "44" * 32),
    ]
    for i, (name, value) in enumerate(changes):
        args = list(base)
        args[i] = value
        assert build_digest(*args) != reference, f"changing {name} did not change the digest"


def main() -> int:
    ev = load_example()
    digest = build_digest(*digest_args(ev))
    print(f"digest: 0x{digest.hex()}")
    failed = 0
    for fn in (test_example_signature_recovers_to_evaluator_address,
               test_signing_reproduces_example_signature,
               test_every_input_changes_the_digest):
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL  {fn.__name__}: {exc}")

    # Informational: the account #0 key from the task description.
    key0 = ANVIL_KEYS[0]
    sig0 = sign_digest(digest, key0)
    print(f"INFO  account #0 key ({Account.from_key(key0).address}) signature equals the example: "
          f"{sig0 == ev['signature']} (the example was signed by {ev['evaluator_address']})")
    print("ALL PASS" if failed == 0 else f"{failed} FAILED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
