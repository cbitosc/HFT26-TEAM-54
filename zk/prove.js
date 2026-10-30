// Build and locally verify the ZK proof for one run.
// Run from the repo root: node zk/prove.js runs/<id>
// Reads run.json, secret.json, evaluator.json; writes proof.json and appends
// one line to events.jsonl. Never prints promptHash or salt.
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");
const { keccak256, isAddress } = require("ethers");

// BN254 field prime (PLAN.md 3.1) and the circuit's fixed weights (PLAN.md 3.1).
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const WEIGHTS = [50, 20, 15, 15];
const OUT = path.join(__dirname, "out");
const WASM = path.join(OUT, "autoevolve.wasm");
const ZKEY = path.join(OUT, "autoevolve_final.zkey");
const VKEY = path.join(OUT, "verification_key.json");

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function readRaw(file) {
  if (!fs.existsSync(file)) fail(`missing file: ${file}`);
  return fs.readFileSync(file);
}

function parseJson(raw, file) {
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch (e) {
    return fail(`${file} is not valid JSON`);
  }
}

const scoreOf = (metrics) => metrics.reduce((sum, v, i) => sum + WEIGHTS[i] * v, 0);

// Decimal string for a value or nested array of values (hex or decimal in).
const toDec = (x) => (Array.isArray(x) ? x.map(toDec) : BigInt(x).toString());

async function main() {
  const runDir = process.argv[2];
  if (!runDir) fail("usage: node zk/prove.js runs/<id>");
  if (!fs.existsSync(runDir)) fail(`run folder not found: ${runDir}`);

  // 1. Read the three input files (run.json both as raw bytes and parsed).
  const runRaw = readRaw(path.join(runDir, "run.json"));
  const run = parseJson(runRaw, "run.json");
  const secret = parseJson(readRaw(path.join(runDir, "secret.json")), "secret.json");
  const ev = parseJson(readRaw(path.join(runDir, "evaluator.json")), "evaluator.json");

  // 2. Cross-checks.
  const versions = run.versions;
  if (!Array.isArray(versions) || versions.length !== 3) {
    fail("run.json must have exactly 3 versions (status 'improved')");
  }
  const runMetrics = versions.map((v) => v.metrics);
  const evMetrics = ev.metrics;
  if (!Array.isArray(evMetrics) || evMetrics.length !== 3) fail("evaluator.json metrics must be 3 rows of 4");
  for (let k = 0; k < 3; k++) {
    if (!Array.isArray(runMetrics[k]) || runMetrics[k].length !== 4 || !Array.isArray(evMetrics[k]) || evMetrics[k].length !== 4) {
      fail(`version ${k + 1}: metrics must have 4 values in both run.json and evaluator.json`);
    }
    for (let j = 0; j < 4; j++) {
      if (!Number.isInteger(runMetrics[k][j]) || !Number.isInteger(evMetrics[k][j])) {
        fail(`version ${k + 1}, metric ${j}: metrics must be integers`);
      }
      if (runMetrics[k][j] !== evMetrics[k][j]) {
        fail(`evaluator.json metrics differ from run.json at version ${k + 1}, metric ${j}: evaluator says ${evMetrics[k][j]}, run.json says ${runMetrics[k][j]}`);
      }
    }
  }

  const snapshotHash = BigInt(keccak256(runRaw)) % P;
  if (ev.snapshot_hash === undefined || snapshotHash !== BigInt(ev.snapshot_hash)) {
    fail("snapshot_hash mismatch: keccak(raw run.json bytes) % P does not equal evaluator.json snapshot_hash (was run.json re-saved or edited?)");
  }

  if (!isAddress(ev.agent_wallet)) fail("evaluator.json agent_wallet is not a valid address");
  if (String(run.agent_wallet).toLowerCase() !== ev.agent_wallet.toLowerCase()) {
    fail("agent_wallet differs between run.json and evaluator.json");
  }
  if (Number(run.task_id) !== Number(ev.task_id)) fail("task_id differs between run.json and evaluator.json");

  let promptHash, salt;
  try {
    promptHash = BigInt(secret.prompt_hash);
    salt = BigInt(secret.salt);
  } catch (e) {
    return fail("secret.json needs prompt_hash and salt as decimal strings");
  }
  if (promptHash < 0n || promptHash >= P || salt <= 0n || salt >= P) {
    fail("secret.json values must be field elements (0 <= prompt_hash < P, 0 < salt < P)");
  }

  // 3. promptCommitment = Poseidon([promptHash, salt]) (circomlibjs only, PLAN 3.2).
  const poseidon = await buildPoseidon();
  const promptCommitment = poseidon.F.toObject(poseidon([promptHash, salt])).toString();

  // 4. Circuit input, all decimal strings.
  const agentWallet = BigInt(ev.agent_wallet).toString();
  const taskId = String(BigInt(ev.task_id));
  const input = {
    m: evMetrics.map((row) => row.map(String)),
    promptCommitment,
    snapshotHash: snapshotHash.toString(),
    agentWallet,
    taskId,
    promptHash: promptHash.toString(),
    salt: salt.toString(),
  };

  // 5. Prove, then verify locally.
  let proof, publicSignals;
  try {
    ({ proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY));
  } catch (e) {
    // 8. Witness generation failed: say why if it is the scores.
    const s = evMetrics.map(scoreOf);
    if (!(s[0] < s[1] && s[1] < s[2])) {
      console.error(`CANNOT PROVE: score did not improve (S1=${s[0]}, S2=${s[1]}, S3=${s[2]}; need S1 < S2 < S3)`);
      process.exit(1);
    }
    return fail(`witness generation failed: ${String(e.message).split("\n").slice(0, 3).join(" | ")}`);
  }

  const vkey = JSON.parse(fs.readFileSync(VKEY, "utf8"));
  if (!(await snarkjs.groth16.verify(vkey, publicSignals, proof))) fail("proof did not verify locally");

  // 6. Public signals: 16 values, in PLAN.md 3.5 order.
  if (publicSignals.length !== 16) fail(`expected 16 public signals, got ${publicSignals.length}`);
  const expectedPub = [...evMetrics.flat().map(String), promptCommitment, snapshotHash.toString(), agentWallet, taskId];
  expectedPub.forEach((v, i) => {
    if (publicSignals[i] !== v) fail(`public signal ${i} does not match the expected value (order or content problem)`);
  });

  // 7. Solidity-ordered proof from snarkjs (it swaps pB for us). Never hand-format pB.
  const callData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC, pub] = JSON.parse(`[${callData}]`).map(toDec);
  if (JSON.stringify(pub) !== JSON.stringify(publicSignals)) fail("exported pubSignals differ from the proof's public signals");

  const proofJson = {
    pA,
    pB,
    pC,
    pubSignals: pub,
    prompt_commitment: promptCommitment,
    verified_locally: true,
  };
  fs.writeFileSync(path.join(runDir, "proof.json"), JSON.stringify(proofJson, null, 2) + "\n");

  const event = {
    ts: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    actor: "prover",
    step: "prove",
    v: null,
    score: null,
    msg: "Groth16 proof built and verified locally (16 public signals)",
  };
  fs.appendFileSync(path.join(runDir, "events.jsonl"), JSON.stringify(event) + "\n");

  const s = evMetrics.map(scoreOf);
  console.log(`run: ${run.run_id}`);
  console.log(`scores: ${s[0]} < ${s[1]} < ${s[2]}`);
  console.log(`promptCommitment: ${promptCommitment}`);
  console.log(`snapshotHash: ${snapshotHash}`);
  console.log("public signals: 16, order checked");
  console.log("verified locally: OK");
  console.log(`wrote ${path.join(runDir, "proof.json")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`ERROR: unexpected failure: ${String(e && e.message ? e.message : e).split("\n")[0]}`);
  process.exit(1);
});
