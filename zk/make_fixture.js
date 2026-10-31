// Build zk/out/fixture/fixture.json (for P3's Foundry tests) from a run that
// prove.js has already processed. Run from the repo root:
//   node zk/make_fixture.js runs/<id> [--agent 0x...] [--task N] [--test-suite-hash 0x...]
// Each value can also come from the env: AGENT_WALLET, TASK_ID, TEST_SUITE_HASH.
// Precedence: flag, then env, then the run itself (evaluator.json agent_wallet and
// task_id; keccak of tasks/t<id>/tests.json, else a clearly-marked placeholder).
// Reads only proof.json and evaluator.json. Never reads secret.json.
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { keccak256, isAddress } = require("ethers");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(__dirname, "out", "fixture");
const VKEY = path.join(__dirname, "out", "verification_key.json");
const PLACEHOLDER = "0x0000000000000000000000000000000000000000000000000000000000000001";

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function readJson(file) {
  if (!fs.existsSync(file)) fail(`missing file: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const runDir = process.argv[2];
  if (!runDir || runDir.startsWith("--")) {
    fail("usage: node zk/make_fixture.js runs/<id> [--agent 0x...] [--task N] [--test-suite-hash 0x...]");
  }
  const proof = readJson(path.join(runDir, "proof.json"));
  const ev = readJson(path.join(runDir, "evaluator.json"));
  if (proof.verified_locally !== true) fail("proof.json is not marked verified_locally; run prove.js first");

  const agent = flag("agent") || process.env.AGENT_WALLET || ev.agent_wallet;
  const taskId = String(flag("task") || process.env.TASK_ID || ev.task_id);
  if (!isAddress(agent)) fail(`not a valid address: ${agent}`);
  if (!/^\d+$/.test(taskId)) fail(`task id must be a decimal number: ${taskId}`);

  // The proof is bound to one wallet and one task: refuse anything else.
  if (BigInt(proof.pubSignals[14]) !== BigInt(agent)) {
    fail("agent address does not match the proof (pubSignals[14]); the proof was made for a different wallet");
  }
  if (proof.pubSignals[15] !== taskId) {
    fail(`task id does not match the proof (pubSignals[15] = ${proof.pubSignals[15]})`);
  }

  let testSuiteHash = flag("test-suite-hash") || process.env.TEST_SUITE_HASH;
  let source = "argument/env";
  if (!testSuiteHash) {
    const testsFile = path.join(ROOT, "tasks", `t${taskId}`, "tests.json");
    if (fs.existsSync(testsFile)) {
      testSuiteHash = keccak256(fs.readFileSync(testsFile)); // PLAN 3.2: keccak of the raw bytes
      source = `keccak of tasks/t${taskId}/tests.json`;
    } else {
      testSuiteHash = PLACEHOLDER;
      source = `PLACEHOLDER (tasks/t${taskId}/tests.json not found)`;
    }
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(testSuiteHash)) fail("test_suite_hash must be 0x + 64 hex characters (bytes32)");

  const fixture = {
    pA: proof.pA,
    pB: proof.pB,
    pC: proof.pC,
    pubSignals: proof.pubSignals,
    agent_wallet: agent,
    task_id: taskId,
    test_suite_hash: testSuiteHash,
  };

  // Self-check: undo the Solidity pB swap and verify with only the fixture's values.
  const snarkProof = {
    pi_a: [fixture.pA[0], fixture.pA[1], "1"],
    pi_b: [[fixture.pB[0][1], fixture.pB[0][0]], [fixture.pB[1][1], fixture.pB[1][0]], ["1", "0"]],
    pi_c: [fixture.pC[0], fixture.pC[1], "1"],
    protocol: "groth16",
    curve: "bn128",
  };
  if (fixture.pubSignals.length !== 16) fail(`expected 16 pubSignals, got ${fixture.pubSignals.length}`);
  const ok = await snarkjs.groth16.verify(readJson(VKEY), fixture.pubSignals, snarkProof);
  if (!ok) fail("fixture does not verify against zk/out/verification_key.json");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "fixture.json"), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`agent_wallet: ${agent}`);
  console.log(`task_id: ${taskId}`);
  console.log(`test_suite_hash: ${testSuiteHash}  [${source}]`);
  console.log("fixture verifies against verification_key.json: OK");
  console.log("wrote zk/out/fixture/fixture.json");
  process.exit(0);
}

main().catch((e) => fail(`unexpected failure: ${String(e && e.message ? e.message : e).split("\n")[0]}`));
