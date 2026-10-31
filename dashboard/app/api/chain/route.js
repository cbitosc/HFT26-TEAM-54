import { createPublicClient, http, parseAbi, parseAbiItem, formatEther } from "viem";
import { getDeployment, getRegistryAbi } from "@/lib/repo";

export const dynamic = "force-dynamic";

// Used only until P3 commits schemas/abi/AutoEvolveRegistry.json (same functions, PLAN.md 3.7).
const FALLBACK_ABI = parseAbi([
  "struct Record { uint256 taskId; address agent; string cid; uint256 snapshotHash; uint256 promptCommitment; uint256[3] scores; uint64 timestamp; }",
  "function recordCount() view returns (uint256)",
  "function getRecord(uint256 id) view returns (Record)",
]);
const VERIFIED_EVENT = parseAbiItem(
  "event ImprovementVerified(uint256 indexed recordId, uint256 indexed taskId, address indexed agent, string cid, uint256 snapshotHash, uint256[3] scores, uint256 rewardWei)"
);
const MAX_RECORDS = 50;
const CACHE_MS = 4000; // the page polls every 3 s; don't hammer a public RPC

let cache = { at: 0, body: null };

async function readChain() {
  const chain = process.env.CHAIN || "local";
  const rpc = process.env.RPC_URL || (chain === "local" ? "http://127.0.0.1:8545" : "");
  const dep = getDeployment(chain);
  if (!dep) return { ok: false, chain, error: `schemas/deployments.${chain}.json not found (ask P3)` };
  if (!rpc) return { ok: false, chain, error: "RPC_URL is not set in dashboard/.env.local" };

  const abi = getRegistryAbi() || FALLBACK_ABI;
  const client = createPublicClient({ transport: http(rpc, { timeout: 10_000 }) });
  const registry = dep.registry;

  const [count, balance] = await Promise.all([
    client.readContract({ address: registry, abi, functionName: "recordCount" }),
    client.getBalance({ address: registry }),
  ]);
  const n = Number(count);
  const ids = [...Array(Math.min(n, MAX_RECORDS)).keys()].map((i) => n - 1 - i); // newest first
  const raw = await Promise.all(
    ids.map((id) => client.readContract({ address: registry, abi, functionName: "getRecord", args: [BigInt(id)] }))
  );

  // Transaction hashes come from the events; optional, because some RPCs limit log ranges.
  const txByRecord = {};
  try {
    const logs = await client.getLogs({
      address: registry,
      event: VERIFIED_EVENT,
      fromBlock: BigInt(dep.deploy_block || 0),
      toBlock: "latest",
    });
    for (const l of logs) txByRecord[String(l.args.recordId)] = l.transactionHash;
  } catch {
    // records still show, just without tx links
  }

  const records = raw.map((r, i) => ({
    record_id: ids[i],
    task_id: Number(r.taskId),
    agent: r.agent,
    cid: r.cid,
    snapshot_hash: r.snapshotHash.toString(),
    prompt_commitment: r.promptCommitment.toString(),
    scores: r.scores.map(Number),
    timestamp: Number(r.timestamp),
    tx_hash: txByRecord[String(ids[i])] || null,
  }));

  return {
    ok: true,
    chain,
    chain_id: dep.chain_id,
    registry,
    explorer: dep.explorer || null,
    reward_wei: dep.reward_wei ?? null,
    escrow_eth: formatEther(balance),
    record_count: n,
    records,
  };
}

// GET /api/chain -> the on-chain memory log (recordCount + getRecord for each record)
export async function GET() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return Response.json(cache.body);
  let body;
  try {
    body = await readChain();
  } catch (e) {
    body = { ok: false, chain: process.env.CHAIN || "local", error: e.shortMessage || e.message };
  }
  cache = { at: Date.now(), body };
  return Response.json(body);
}
