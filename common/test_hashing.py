import hashlib

from common.hashing import P, canonical_bytes, keccak, keccak_hex, prompt_hash, snapshot_hash_of_file, to_field


def test_keccak_is_ethereum_not_sha3():
    # Ethereum Keccak-256 of empty input. hashlib.sha3_256 gives a7ffc6f8... instead.
    assert keccak(b"").hex().startswith("c5d2460186f7233c")
    assert keccak(b"") != hashlib.sha3_256(b"").digest()


def test_canonical_bytes_is_order_independent_and_compact():
    a = canonical_bytes({"b": 1, "a": "é"})
    assert a == canonical_bytes({"a": "é", "b": 1})
    assert a == '{"a":"é","b":1}'.encode("utf-8")


def test_to_field_is_below_p():
    assert to_field(b"\xff" * 32) < P
    assert prompt_hash("secret prompt") < P


def test_snapshot_hash_uses_raw_file_bytes(tmp_path):
    f = tmp_path / "run.json"
    f.write_bytes(canonical_bytes({"x": 1}))
    assert snapshot_hash_of_file(f) == to_field(keccak(b'{"x":1}'))
    assert keccak_hex(b"").startswith("0x")
