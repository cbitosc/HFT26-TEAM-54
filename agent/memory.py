"""Agent B's memory: read verified past runs from the CHAIN + IPFS only (never from runs/).

For every on-chain record of the same task family:
  1. getRecord(i) on AutoEvolveRegistry  -> cid, snapshotHash
  2. download the CID bytes from IPFS
  3. VERIFY to_field(keccak(bytes)) == snapshotHash   (skip + log any mismatch)
  4. collect the lessons, newest record first, top 5

Registry address and RPC come from common/config.py. It talks to the chain with plain JSON-RPC
(eth_call) + eth_abi decoding instead of common.config.get_registry(), because web3.py does not
install on every laptop (e.g. Python 3.15 on Windows).
--mock-chain simulates the chain with agent/samples/run.sample.json plus one TAMPERED record,
so the hash check can be shown rejecting it.
"""
import json
import urllib.request

from eth_abi import decode

from agent import config
from common.hashing import keccak, to_field

RECORD_TYPE = "(uint256,address,string,uint256,uint256,uint256[3],uint64)"
MAX_LESSONS = 5
IPFS_FALLBACK_GATEWAYS = ["https://gateway.pinata.cloud/ipfs", "https://w3s.link/ipfs",
                          "https://ipfs.io/ipfs", "https://dweb.link/ipfs"]


# ---------- chain ----------

def _http_json(url: str, payload: dict, timeout=30) -> dict:
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "autoevolve-agent-b"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _eth_call(rpc: str, to: str, data: bytes) -> bytes:
    out = _http_json(rpc, {"jsonrpc": "2.0", "id": 1, "method": "eth_call",
                           "params": [{"to": to, "data": "0x" + data.hex()}, "latest"]})
    if "error" in out:
        raise RuntimeError(f"eth_call failed: {out['error']}")
    return bytes.fromhex(out["result"][2:])


def read_records() -> list:
    """All records from the registry as dicts (record_id, task_id, agent, cid, snapshot_hash, ...)."""
    from common.config import load_deployment, rpc_url
    rpc = rpc_url()
    registry = load_deployment()["registry"]
    count = decode(["uint256"], _eth_call(rpc, registry, keccak(b"recordCount()")[:4]))[0]
    records = []
    for i in range(count):
        call = keccak(b"getRecord(uint256)")[:4] + i.to_bytes(32, "big")
        task_id, agent, cid, snap, commit, scores, ts = decode([RECORD_TYPE], _eth_call(rpc, registry, call))[0]
        records.append({"record_id": i, "task_id": task_id, "agent": agent, "cid": cid, "snapshot_hash": snap,
                        "prompt_commitment": commit, "scores": list(scores), "timestamp": ts})
    return records


# ---------- IPFS ----------

def _gateways() -> list:
    urls = []
    gw = config.env("PINATA_GATEWAY").strip().rstrip("/")
    if gw:
        gw = gw if gw.startswith("http") else "https://" + gw
        urls.append(gw if gw.endswith("/ipfs") else gw + "/ipfs")
    urls.extend(IPFS_FALLBACK_GATEWAYS)
    return urls


def fetch_cid(cid: str) -> bytes:
    try:  # P3's helper, used read-only, when it exists
        from pipeline.ipfs import fetch
        return fetch(cid)
    except ImportError:
        pass
    last = None
    for base in _gateways():
        try:
            req = urllib.request.Request(f"{base}/{cid}", headers={"User-Agent": "autoevolve-agent-b"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except Exception as exc:  # try the next gateway
            last = exc
    raise RuntimeError(f"could not fetch {cid}: {last}")


# ---------- mock chain (development only) ----------

def _mock_chain():
    sample = (config.AGENT_DIR / "samples" / "run.sample.json").read_bytes()
    tampered = sample.replace(b"Strip surrounding whitespace", b"Never strip whitespace", 1)
    store = {"bafy-mock-sample": sample, "bafy-mock-tampered": tampered}
    run = json.loads(sample)
    common = {"task_id": run["task_id"], "agent": run["agent_wallet"], "prompt_commitment": 0,
              "scores": [v["score"] for v in run["versions"]], "timestamp": 0}
    records = [
        {**common, "record_id": 0, "cid": "bafy-mock-sample", "snapshot_hash": to_field(keccak(sample))},
        # Claims the honest snapshotHash but serves edited bytes: must be rejected.
        {**common, "record_id": 1, "cid": "bafy-mock-tampered", "snapshot_hash": to_field(keccak(sample))},
    ]
    return records, store.__getitem__


# ---------- main entry ----------

def _task_families() -> dict:
    tasks = json.loads((config.REPO_ROOT / "tasks" / "tasks.json").read_text(encoding="utf-8"))
    return {int(k): v["family"] for k, v in tasks.items()}


def collect_lessons(family: str, mock_chain: bool = False, log=print) -> tuple:
    """Return (lessons: [text], memory_used: [{"record_id", "cid", "lessons_used"}])."""
    records, fetch = _mock_chain() if mock_chain else (read_records(), fetch_cid)
    families = _task_families()
    log(f"memory: {len(records)} on-chain records{' (MOCK CHAIN)' if mock_chain else ''}")

    lessons, used, seen = [], [], set()
    for rec in sorted(records, key=lambda r: r["record_id"], reverse=True):  # newest first
        if families.get(rec["task_id"]) != family:
            continue
        try:
            raw = fetch(rec["cid"])
        except Exception as exc:
            log(f"memory: record {rec['record_id']} SKIPPED, fetch failed: {exc}")
            continue
        if to_field(keccak(raw)) != rec["snapshot_hash"]:
            log(f"memory: record {rec['record_id']} REJECTED, IPFS bytes do not match on-chain snapshotHash")
            continue
        run = json.loads(raw)
        if run.get("task_family") != family:
            continue
        taken = []
        for item in run.get("lessons", []):
            text = item.get("text", "").strip()
            if text and text not in seen and len(lessons) < MAX_LESSONS:
                seen.add(text)
                lessons.append(text)
                taken.append(text)
        log(f"memory: record {rec['record_id']} VERIFIED (task {rec['task_id']}, cid {rec['cid']}), "
            f"{len(taken)} lessons taken")
        if taken:
            used.append({"record_id": rec["record_id"], "cid": rec["cid"], "lessons_used": taken})
    return lessons, used
