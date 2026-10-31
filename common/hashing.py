"""Shared hashing rules (PLAN.md 3.2). Everyone imports this; nobody re-implements it."""
import json
from pathlib import Path

from eth_utils import keccak as _keccak

# BN254 scalar field: every number that goes into the circuit must be < P.
P = 21888242871839275222246405745257275088548364400416034343698204186575808495617


def canonical_bytes(obj) -> bytes:
    """The one true JSON encoding: sorted keys, no spaces, UTF-8."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def keccak(b: bytes) -> bytes:
    """Ethereum Keccak-256 (NOT hashlib.sha3_256, which pads differently)."""
    return _keccak(b)


def keccak_hex(b: bytes) -> str:
    return "0x" + keccak(b).hex()


def to_field(h: bytes) -> int:
    """Squash a 32-byte hash into the BN254 field so the circuit can use it."""
    return int.from_bytes(h, "big") % P


def snapshot_hash_of_file(path) -> int:
    """snapshot_hash: hash the RAW file bytes (never re-parse and re-dump the JSON)."""
    return to_field(keccak(Path(path).read_bytes()))


def prompt_hash(text: str) -> int:
    return to_field(keccak(text.encode("utf-8")))


def code_hash(code: str) -> str:
    return keccak_hex(code.encode("utf-8"))


def test_suite_hash_of_file(path) -> str:
    """bytes32 hex of the raw tests.json bytes; registered on-chain per task."""
    return keccak_hex(Path(path).read_bytes())
