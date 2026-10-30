"""The evaluator-signature digest (PLAN.md 3.6). Python and Solidity must match EXACTLY.

digest = keccak256(abi.encode(uint256 chainId, address registry, uint256 taskId, address agent,
                              uint256[12] metrics, uint256 snapshotHash, bytes32 testSuiteHash))
signature = sign of the Ethereum "signed message" form of the digest; the contract recovers it with
ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), sig).
"""
from eth_abi import encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import to_checksum_address

from common.hashing import keccak

TYPES = ["uint256", "address", "uint256", "address", "uint256[12]", "uint256", "bytes32"]


def _bytes32(value) -> bytes:
    if isinstance(value, str):
        value = bytes.fromhex(value[2:] if value.startswith("0x") else value)
    raw = bytes(value)
    if len(raw) != 32:
        raise ValueError("test_suite_hash must be 32 bytes")
    return raw


def build_digest(chain_id, registry, task_id, agent, metrics12, snapshot_hash, test_suite_hash) -> bytes:
    """metrics12 = V1, V2, V3 flattened (same as circuit public signals 0-11)."""
    metrics12 = [int(m) for m in metrics12]
    if len(metrics12) != 12:
        raise ValueError(f"metrics12 must have 12 values, got {len(metrics12)}")
    return keccak(encode(TYPES, [
        int(chain_id),
        to_checksum_address(registry),
        int(task_id),
        to_checksum_address(agent),
        metrics12,
        int(snapshot_hash),
        _bytes32(test_suite_hash),
    ]))


def sign_digest(digest: bytes, key) -> str:
    """Returns the 65-byte signature as 0x-hex (r, s, v with v = 27 or 28)."""
    signed = Account.sign_message(encode_defunct(primitive=digest), key)
    return "0x" + bytes(signed.signature).hex()


def recover_signer(digest: bytes, signature: str) -> str:
    """Address that produced `signature` over `digest` (what the contract checks)."""
    return Account.recover_message(encode_defunct(primitive=digest), signature=signature)
