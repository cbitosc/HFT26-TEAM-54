"""Where am I deploying, and what are the addresses? Never hardcode either (PLAN.md 3.1)."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = ROOT / "schemas"
load_dotenv(ROOT / ".env")

CHAIN = os.getenv("CHAIN", "local")  # sepolia | basesepolia | local
DEFAULT_RPC = {"local": "http://127.0.0.1:8545"}


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"{path.relative_to(ROOT)} not found (ask P3)")
    return json.loads(path.read_text(encoding="utf-8"))


def load_deployment(chain: str = None) -> dict:
    """schemas/deployments.<CHAIN>.json: registry, verifier, evaluator, chain_id, explorer..."""
    return _read_json(SCHEMAS / f"deployments.{chain or CHAIN}.json")


def addresses() -> dict:
    """schemas/addresses.json: public wallet addresses only."""
    return _read_json(SCHEMAS / "addresses.json")


def rpc_url() -> str:
    url = os.getenv("RPC_URL") or DEFAULT_RPC.get(CHAIN)
    if not url:
        raise RuntimeError(f"RPC_URL is not set in .env for CHAIN={CHAIN}")
    return url


def get_web3():
    from web3 import Web3  # imported lazily so hashing-only users don't need web3

    w3 = Web3(Web3.HTTPProvider(rpc_url(), request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        raise RuntimeError(f"cannot reach RPC for CHAIN={CHAIN}")
    return w3


def get_registry(w3=None):
    w3 = w3 or get_web3()
    abi = _read_json(SCHEMAS / "abi" / "AutoEvolveRegistry.json")
    return w3.eth.contract(address=w3.to_checksum_address(load_deployment()["registry"]), abi=abi)
