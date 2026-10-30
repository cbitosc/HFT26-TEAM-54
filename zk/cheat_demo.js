// Five cheat attacks against the deployed AutoEvolveRegistry.
// Run from the repo root:  node zk/cheat_demo.js        (local: see zk/run_cheats_local.sh)
//
// Two modes, chosen by the connected chain id:
//   LOCAL (Anvil, 31337): a fresh chain. It does ONE real submit (Agent A, task 1) for attack 4, then
//     tries to claim again. A re-run needs a FRESH chain (restart Anvil, run pipeline/deploy.sh 1 2 3 4);
//     the script refuses to run otherwise.
//   READ-ONLY (any other chain, or READ_ONLY=1): never deploys, never sends a transaction, never calls
//     anvil_*. Every attack is a submit.staticCall. It needs Agent A to have ALREADY claimed task 1
//     (attack 4 replays that claim) and tasks 2 and 3 registered but unclaimed by Agent A.
//
// submit() checks, in order: UNKNOWN_TASK, TASK_MISMATCH, NOT_AGENT, ALREADY_CLAIMED, BAD_PROOF,
// BAD_EVALUATOR_SIG. Each attack is set up to pass every EARLIER check, so the revert we see is the
// one the attack is really about.
//
// Env (from .env via dotenv, never printed): CHAIN, RPC_URL, AGENT_A_PRIVATE_KEY (local mode only).
// PY = python interpreter for agent.run / attest.sign (default .venv/bin/python if it exists).
// Writes runs/cheats.json and runs/cheats.events.jsonl (truncated at the start of each run, then one line
// per attack); never touches a real run's events.jsonl. Flag --no-write skips both files.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(ROOT, ".env"), quiet: true });
const { ethers } = require("ethers");

const CHAIN = process.env.CHAIN || "local";
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const LOCAL_CHAIN_ID = 31337n;
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const RUNS = path.join(ROOT, "runs");
const EVENTS = path.join(RUNS, "cheats.events.jsonl");
const PY = process.env.PY || (fs.existsSync(path.join(ROOT, ".venv", "bin", "python")) ? ".venv/bin/python" : "python3");

function readJson(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error(`missing ${rel}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// PLAN.md 3.2 canonical JSON: sorted keys, no spaces.
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, PYTHONPATH: ROOT } });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "" };
}

const prove = (dir) => sh("node", [path.join("zk", "prove.js"), dir]);

// Evaluator digest, same as attest/digest.py and the contract (PLAN.md 3.6).
const coder = ethers.AbiCoder.defaultAbiCoder();
function evaluatorDigest({ chainId, registry, taskId, agent, metrics, snapshot, suite }) {
  return ethers.keccak256(coder.encode(
    ["uint256", "address", "uint256", "address", "uint256[12]", "uint256", "bytes32"],
    [chainId, registry, taskId, agent, metrics.flat(), snapshot, suite]));
}

// A made-up run folder (runs/cheat-<name>) with metrics we choose, whose evaluator.json is signed by `signer`.
async function syntheticRun(ctx, name, taskId, metrics, signer) {
  const dir = path.join(RUNS, `cheat-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const suite = await ctx.registry.testSuiteHash(taskId);
  const run = {
    schema_version: "1.0", run_id: `cheat-${name}`, task_id: taskId, task_family: "log_parsing", agent: "A",
    agent_wallet: ctx.agentA, test_suite_hash: suite, status: "improved",
    versions: metrics.map((m, i) => ({ v: i + 1, metrics: m })),
  };
  const bytes = Buffer.from(canonical(run), "utf8");
  fs.writeFileSync(path.join(dir, "run.json"), bytes);
  const snapshot = BigInt(ethers.keccak256(bytes)) % P;
  const salt = (BigInt(ethers.id(`${name}-salt`)) % (P - 1n)) + 1n;
  const promptHash = BigInt(ethers.id(`${name}-prompt`)) % P;
  fs.writeFileSync(path.join(dir, "secret.json"), JSON.stringify({ prompt_hash: promptHash.toString(), salt: salt.toString() }));
  const digest = evaluatorDigest({
    chainId: ctx.chainId, registry: ctx.registryAddress, taskId, agent: ctx.agentA, metrics, snapshot, suite });
  const evaluator = {
    task_id: taskId, agent_wallet: ctx.agentA, metrics, snapshot_hash: snapshot.toString(), test_suite_hash: suite,
    chain_id: Number(ctx.chainId), registry: ctx.registryAddress, evaluator_address: signer.address,
    signature: await signer.signMessage(ethers.getBytes(digest)),
  };
  fs.writeFileSync(path.join(dir, "evaluator.json"), JSON.stringify(evaluator, null, 2) + "\n");
  return dir;
}

const loadProof = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "proof.json"), "utf8"));
const loadSig = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "evaluator.json"), "utf8")).signature;

// What does submit() say? "NO_REVERT" if it would succeed, else the revert string.
async function attempt(ctx, from, taskId, p, sig) {
  try {
    await ctx.registry.submit.staticCall(taskId, "ipfs://cheat-demo", p.pA, p.pB, p.pC, p.pubSignals, sig, { from });
    return "NO_REVERT";
  } catch (e) {
    return e.reason || (String(e.shortMessage || e.message).match(/reverted.*?:\s*(\w+)/) || [])[1] || String(e.shortMessage || e.message).split("\n")[0];
  }
}

const IMPROVING = [[40, 30, 60, 50], [70, 60, 80, 70], [95, 90, 90, 90]];

async function main() {
  if (process.argv.includes("--preflight")) {
    let host = "";
    try { host = new URL(RPC).hostname; } catch (e) { host = ""; }
    const ok = CHAIN === "local" && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
    console.log(ok ? "preflight: .env points at a local chain: OK"
      : "preflight: REFUSING: .env is not set for local Anvil (CHAIN must be local and RPC_URL must be localhost)");
    process.exit(ok ? 0 : 1);
  }
  const noWrite = process.argv.includes("--no-write");

  // ---- setup and guards ----
  const provider = new ethers.JsonRpcProvider(RPC);
  const chainId = (await provider.getNetwork()).chainId;
  const isLocalChain = chainId === LOCAL_CHAIN_ID;
  const isLocal = isLocalChain && process.env.READ_ONLY !== "1" && !process.argv.includes("--read-only");
  // The only transaction this script can send is the real claim inside the LOCAL branch of attack 4;
  // this counter is printed at the end (read-only mode must show 0).
  let txSent = 0;

  if (process.argv.includes("--fund-deployer")) {
    // Throwaway local chain only: the deployer key in .env may belong to an account with no ETH on a
    // fresh Anvil, and fund() needs 0.01 ETH. Top it up (never down); print no address or key.
    if (!isLocalChain) throw new Error("--fund-deployer only works on local Anvil (31337): refusing to call anvil_setBalance elsewhere");
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is not set in .env");
    const deployer = new ethers.Wallet(key).address;
    if ((await provider.getBalance(deployer)) < ethers.parseEther("1")) {
      await provider.send("anvil_setBalance", [deployer, "0x56BC75E2D63100000"]); // 100 ETH
      console.log("deployer account topped up to 100 ETH on local Anvil (it had under 1 ETH)");
    } else {
      console.log("deployer account already funded");
    }
    process.exit(0);
  }

  const deployment = readJson(`schemas/deployments.${CHAIN}.json`);
  if (BigInt(deployment.chain_id) !== chainId) {
    throw new Error(`schemas/deployments.${CHAIN}.json is for chain ${deployment.chain_id} but the connected chain is ${chainId}`);
  }
  const addrs = readJson("schemas/addresses.json");
  const registryAddress = ethers.getAddress(deployment.registry);
  if ((await provider.getCode(registryAddress)) === "0x") {
    throw new Error("no contract at the registry address" + (isLocal ? ": start a fresh Anvil and run pipeline/deploy.sh 1 2 3 4" : ""));
  }
  const registry = new ethers.Contract(registryAddress, readJson("schemas/abi/AutoEvolveRegistry.json"), provider);
  if ((await registry.evaluator()) === ethers.ZeroAddress) {
    throw new Error("the registry's evaluator is address(0): the signature check is skipped, so attack 5 cannot be rejected. Redeploy with a real evaluator");
  }
  const ctx = { registry, registryAddress, chainId, agentA: ethers.getAddress(addrs.agent_A), agentB: ethers.getAddress(addrs.agent_B) };
  for (const t of [1, 2, 3]) {
    if ((await registry.testSuiteHash(t)) === ethers.ZeroHash) {
      throw new Error(`task ${t} is not registered on this registry` + (isLocal ? ": run pipeline/deploy.sh 1 2 3 4" : ""));
    }
  }
  if (await registry.claimed(2, ctx.agentA)) {
    throw new Error("Agent A already claimed task 2 here: attack 5 would hit ALREADY_CLAIMED before the evaluator check");
  }
  if (await registry.claimed(3, ctx.agentA)) {
    throw new Error("Agent A already claimed task 3 here: attack 2 would hit ALREADY_CLAIMED before the proof check");
  }
  const claimed1 = await registry.claimed(1, ctx.agentA);
  if (isLocal && claimed1) {
    throw new Error("Agent A already claimed task 1 on this chain. A re-run needs a FRESH chain: restart Anvil and run pipeline/deploy.sh 1 2 3 4 (or use zk/run_cheats_local.sh)");
  }
  if (!isLocal && !claimed1) {
    throw new Error("Agent A has NOT claimed task 1 on this chain, so the replay attack cannot be shown. This mode sends no transactions: make the real claim first with the normal pipeline, then re-run");
  }
  console.log(isLocal
    ? `mode: LOCAL chain ${chainId}: one real transaction (attack 4 setup)`
    : `mode: READ-ONLY chain ${chainId}: no deploys, no transactions, no anvil_* calls (staticCall only)`);

  fs.mkdirSync(RUNS, { recursive: true });
  if (!noWrite) fs.writeFileSync(EVENTS, ""); // truncate: this file holds only the current run
  const results = [];
  const record = (name, description, expected, actual) => {
    results.push({ name, description, expected, actual, rejected: actual === expected });
    if (!noWrite) {
      const event = { ts: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), actor: "cheat", step: "error", v: null, score: null, msg: actual };
      fs.appendFileSync(EVENTS, JSON.stringify(event) + "\n");
    }
  };

  // ---- the proof package for task 1 ----
  let real, realSig, honest;
  if (isLocal) {
    // The one REAL run: agent (mock) -> sign.py -> prove.js, with the real evaluator signature.
    console.log("setup: mock agent run for task 1, then sign.py and prove.js (real evaluator signature)...");
    const agent = sh(PY, ["-m", "agent.run", "--task", "1", "--agent", "A", "--mock-llm"]);
    const realDir = agent.stdout.trim().split("\n").pop();
    if (agent.status !== 0 || !realDir.startsWith("runs/")) throw new Error(`agent.run failed:\n${agent.out.slice(-600)}`);
    const signed = sh(PY, ["-m", "attest.sign", "--run", realDir]);
    if (signed.status !== 0) throw new Error(`attest.sign failed:\n${signed.out.slice(-600)}`);
    const proved = prove(realDir);
    if (proved.status !== 0) throw new Error(`prove.js failed:\n${proved.out.slice(-600)}`);
    real = loadProof(realDir);
    realSig = loadSig(realDir);
    console.log(`setup ok: ${realDir}`);
    // Honest path: valid proof + real evaluator signature on an unclaimed task must NOT revert.
    honest = await attempt(ctx, ctx.agentA, 1, real, realSig);
  } else {
    // Read-only: a synthetic valid proof for Agent A + task 1 is enough, because ALREADY_CLAIMED and
    // NOT_AGENT are checked before the proof and the signature.
    const dir = await syntheticRun(ctx, "task1_package", 1, IMPROVING, ethers.Wallet.createRandom());
    const proved = prove(dir);
    if (proved.status !== 0) throw new Error(`prove.js failed for the task 1 package:\n${proved.out.slice(-400)}`);
    real = loadProof(dir);
    realSig = loadSig(dir);
    honest = "SKIPPED";
  }

  // ---- 1. score_down: S3 < S2, so no proof can be built ----
  const down = await syntheticRun(ctx, "score_down", 3, [[40, 30, 60, 50], [90, 80, 90, 90], [60, 50, 70, 60]], ethers.Wallet.createRandom());
  const downRun = prove(down);
  const downOk = /CANNOT PROVE: score did not improve/.test(downRun.out) && downRun.status !== 0;
  record("score_down", "Third score is lower than the second: the S2 < S3 rule makes a proof impossible",
    "CANNOT PROVE", downOk ? "CANNOT PROVE" : "PROOF_CREATED_OR_OTHER_ERROR");
  if (!downOk) console.log(downRun.out.slice(-400));

  // ---- 2. forged_metrics: valid proof for unclaimed task 3, then edit one public metric ----
  const forgedDir = await syntheticRun(ctx, "forged_metrics", 3, IMPROVING, ethers.Wallet.createRandom());
  const forgedProve = prove(forgedDir);
  if (forgedProve.status !== 0) throw new Error(`prove.js failed for forged_metrics:\n${forgedProve.out.slice(-400)}`);
  const forged = loadProof(forgedDir);
  const control = await attempt(ctx, ctx.agentA, 3, forged, loadSig(forgedDir));
  const tampered = { ...forged, pubSignals: [...forged.pubSignals] };
  tampered.pubSignals[8] = (BigInt(tampered.pubSignals[8]) + 1n).toString();
  record("forged_metrics", "Valid proof for unclaimed task 3, then one public metric (V3 metric 0) is edited after proving",
    "BAD_PROOF", await attempt(ctx, ctx.agentA, 3, tampered, loadSig(forgedDir)));
  console.log(`control for forged_metrics (untampered proof): ${control} (expected BAD_EVALUATOR_SIG: proves it passed every check up to the proof)`);

  // ---- 3. stolen_proof: Agent A's task 1 proof, sent from Agent B ----
  record("stolen_proof", "Agent B submits Agent A's proof for task 1: the proof is bound to Agent A's wallet",
    "NOT_AGENT", await attempt(ctx, ctx.agentB, 1, real, realSig));

  // ---- 4. replay: Agent A claims task 1 again ----
  let replayActual;
  let replayDescription;
  if (isLocal) {
    replayDescription = "Agent A is paid for task 1, then submits the very same proof again for a second reward";
    try {
      const key = process.env.AGENT_A_PRIVATE_KEY;
      if (!key) throw new Error("AGENT_A_PRIVATE_KEY is not set in .env");
      const wallet = new ethers.Wallet(key, provider);
      if (wallet.address !== ctx.agentA) throw new Error("AGENT_A_PRIVATE_KEY does not belong to agent_A in schemas/addresses.json");
      if (honest !== "NO_REVERT") throw new Error(`honest submit would revert (${honest}), so a real first claim is impossible`);
      txSent += 1;
      const tx = await registry.connect(wallet).submit(1, "ipfs://cheat-demo", real.pA, real.pB, real.pC, real.pubSignals, realSig);
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("the real submit transaction reverted");
      // Pin balances to exact blocks (a plain "latest" read can be served from a short request cache).
      const reward = await registry.rewardWei();
      const delta = (await provider.getBalance(ctx.agentA, receipt.blockNumber)) - (await provider.getBalance(ctx.agentA, receipt.blockNumber - 1));
      const expected = reward - receipt.gasUsed * receipt.gasPrice;
      const claimedNow = await registry.claimed(1, ctx.agentA);
      const records = await registry.recordCount();
      console.log(`replay setup: real submit mined (block ${receipt.blockNumber}, tx ${tx.hash})`);
      console.log(`  Agent A balance change ${ethers.formatEther(delta)} ETH; expected reward ${ethers.formatEther(reward)} minus gas = ${ethers.formatEther(expected)} -> paid: ${delta === expected ? "yes" : "NO"}`);
      console.log(`  on-chain: claimed(1, Agent A) = ${claimedNow}, recordCount = ${records}`);
      if (delta !== expected || !claimedNow || records !== 1n) throw new Error("the real submit did not pay out or record as expected");
      replayActual = await attempt(ctx, ctx.agentA, 1, real, realSig);
    } catch (e) {
      replayActual = `SETUP_FAILED: ${String(e.shortMessage || e.message).split("\n")[0]}`;
    }
  } else {
    replayDescription = "Agent A already claimed task 1 earlier on this chain; the same claim is submitted again (read-only: staticCall)";
    replayActual = await attempt(ctx, ctx.agentA, 1, real, realSig);
  }
  record("replay", replayDescription, "ALREADY_CLAIMED", replayActual);

  // ---- 5. invented_metrics: valid proof for made-up metrics, signed by a random wallet ----
  const inventedDir = await syntheticRun(ctx, "invented_metrics", 2, [[60, 55, 70, 65], [80, 75, 85, 80], [99, 99, 99, 99]], ethers.Wallet.createRandom());
  const inventedProve = prove(inventedDir);
  if (inventedProve.status !== 0) throw new Error(`prove.js failed for invented_metrics:\n${inventedProve.out.slice(-400)}`);
  record("invented_metrics", "Agent invents improving metrics for task 2 and signs them with a random wallet instead of the evaluator",
    "BAD_EVALUATOR_SIG", await attempt(ctx, ctx.agentA, 2, loadProof(inventedDir), loadSig(inventedDir)));

  // ---- report ----
  const allRejected = results.every((r) => r.rejected);
  if (!noWrite) {
    fs.writeFileSync(path.join(RUNS, "cheats.json"), JSON.stringify({ attacks: results, all_rejected: allRejected }, null, 2) + "\n");
  }
  const pad = (s, n) => String(s).padEnd(n);
  console.log("\n #  | attack           | expected          | actual            | rejected");
  console.log("----+------------------+-------------------+-------------------+---------");
  results.forEach((r, i) => console.log(` ${i + 1}  | ${pad(r.name, 16)} | ${pad(r.expected, 17)} | ${pad(r.actual, 17)} | ${r.rejected ? "yes" : "NO"}`));
  const honestLine = honest === "NO_REVERT" ? "PASS (no revert)"
    : honest === "SKIPPED" ? "SKIPPED (read-only mode: it needs a real evaluator-signed run on an unclaimed task)"
      : `FAIL (${honest})`;
  console.log(`\nhonest path (valid proof + real evaluator signature, task 1, before any claim): ${honestLine}`);
  console.log(`transactions sent by this script: ${txSent}${isLocal ? " (the one real claim for attack 4)" : ""}`);
  console.log(`all_rejected: ${allRejected}`);
  console.log(noWrite ? "(--no-write: runs/cheats.json and runs/cheats.events.jsonl left untouched)" : "wrote runs/cheats.json and runs/cheats.events.jsonl");
  const readOnlyViolation = !isLocal && txSent !== 0;
  process.exit(allRejected && (honest === "NO_REVERT" || honest === "SKIPPED") && !readOnlyViolation ? 0 : 1);
}

main().catch((e) => {
  console.error(`ERROR: ${String(e && e.message ? e.message : e)}`);
  process.exit(1);
});
