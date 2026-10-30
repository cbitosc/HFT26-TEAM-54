"""IPFS via Pinata. Upload the EXACT file bytes; fetch them back by CID.

NEVER use pinJSONToIPFS: it re-serialises the JSON, so the bytes (and the on-chain snapshotHash) would change.
Agent B (P1) imports fetch() read-only.
"""
import os

import requests

from common import config  # noqa: F401  (loads .env)

PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PUBLIC_GATEWAYS = ["https://ipfs.io/ipfs/", "https://dweb.link/ipfs/"]


def _jwt() -> str:
    jwt = os.getenv("PINATA_JWT", "").strip()
    if not jwt:
        raise RuntimeError("PINATA_JWT is not set in .env")
    return jwt


def gateway_url(cid: str) -> str:
    gw = os.getenv("PINATA_GATEWAY", "").strip()
    return f"https://{gw}/ipfs/{cid}" if gw else PUBLIC_GATEWAYS[0] + cid


def upload_file(path, name: str = None) -> str:
    """Pin the raw bytes of `path`; returns the CID (CIDv1, bafy...)."""
    with open(path, "rb") as fh:
        data = fh.read()
    r = requests.post(
        PIN_FILE_URL,
        headers={"Authorization": f"Bearer {_jwt()}"},
        files={"file": (name or os.path.basename(path), data, "application/octet-stream")},
        data={"pinataOptions": '{"cidVersion": 1}'},
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Pinata upload failed: HTTP {r.status_code} {r.text[:200]}")
    return r.json()["IpfsHash"]


def fetch(cid: str, timeout: int = 60) -> bytes:
    """Download a CID: our Pinata gateway first, then public gateways."""
    urls = [gateway_url(cid)] if os.getenv("PINATA_GATEWAY", "").strip() else []
    urls += [g + cid for g in PUBLIC_GATEWAYS]
    errors = []
    for url in urls:
        try:
            r = requests.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.content
            errors.append(f"{url.split('/ipfs/')[0]}: HTTP {r.status_code}")
        except requests.RequestException as e:
            errors.append(f"{url.split('/ipfs/')[0]}: {type(e).__name__}")
    raise RuntimeError(f"could not fetch {cid}: " + "; ".join(errors))
