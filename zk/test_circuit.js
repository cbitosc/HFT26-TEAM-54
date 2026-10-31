// Witness-only tests for zk/circuits/autoevolve.circom (no setup, no proof).
// Run from the repo root: node zk/test_circuit.js
// Needs zk/build/autoevolve_js (compile first).
const fs = require("fs");
const path = require("path");
const { buildPoseidon } = require("circomlibjs");
const { keccak256, toUtf8Bytes } = require("ethers");

const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const BUILD = path.join(__dirname, "build", "autoevolve_js");
const CIRCUIT_SRC = fs
  .readFileSync(path.join(__dirname, "circuits", "autoevolve.circom"), "utf8")
  .split("\n");

// to_field(h) from PLAN.md 3.2, applied to a keccak of a test string.
const toField = (s) => BigInt(keccak256(toUtf8Bytes(s))) % P;

const GOOD = {
  promptHash: toField("test system prompt"),
  salt: toField("test salt") + 1n,
  snapshotHash: toField("test run.json bytes"),
  agentWallet: BigInt("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
  taskId: 1n,
};
const M_VALID = [[62, 25, 90, 100], [87, 50, 90, 100], [100, 100, 90, 90]];

let poseidon, F;
// promptCommitment = Poseidon(promptHash, salt), same call prove.js will use.
const commit = (promptHash, salt) => F.toObject(poseidon([promptHash, salt]));

function makeInput({ m = M_VALID, promptHash = GOOD.promptHash, salt = GOOD.salt, commitFrom } = {}) {
  const c = commitFrom || { promptHash, salt };
  return {
    m: m.map((row) => row.map(String)),
    promptCommitment: commit(c.promptHash, c.salt).toString(),
    snapshotHash: GOOD.snapshotHash.toString(),
    agentWallet: GOOD.agentWallet.toString(),
    taskId: GOOD.taskId.toString(),
    promptHash: promptHash.toString(),
    salt: salt.toString(),
  };
}

// Put one metric (V index k, metric j) to a bad value in an otherwise valid input.
const withMetric = (k, j, v) => {
  const m = M_VALID.map((r) => [...r]);
  m[k][j] = v;
  return m;
};

// Turn "Error in template X_12 line: 36" into a readable "caught by" label.
function explainError(err) {
  const msg = String(err && err.message ? err.message : err);
  const hit = msg.match(/Error in template (\w+?)_\d+ line: (\d+)/);
  if (!hit) return { tag: "unknown", text: msg.split("\n")[0] };
  const [, template, line] = hit;
  if (template === "AutoEvolve") {
    const src = (CIRCUIT_SRC[Number(line) - 1] || "").trim();
    return { tag: src, text: `autoevolve.circom line ${line}: ${src}` };
  }
  return { tag: template, text: `${template} (circomlib) line ${line}` };
}

// Built after Poseidon is ready, because every input needs a commitment.
const buildCases = () => [
  { id: "1", name: "valid run", expect: "ok", input: makeInput() },
  {
    id: "2",
    name: "boundary: V1 all 0, V2 mid, V3 all 100",
    expect: "ok",
    input: makeInput({ m: [[0, 0, 0, 0], [50, 50, 50, 50], [100, 100, 100, 100]] }),
  },
  {
    id: "3",
    name: "metric = 101",
    expect: "fail",
    rule: "le[k][j].out === 1",
    ruleName: "(1) metric <= 100 (LessEqThan)",
    input: makeInput({ m: withMetric(1, 2, 101) }),
  },
  {
    id: "4a",
    name: "metric = 128",
    expect: "fail",
    rule: "Num2Bits",
    ruleName: "(1) metric fits 7 bits (Num2Bits)",
    input: makeInput({ m: withMetric(0, 0, 128) }),
  },
  {
    id: "4b",
    name: "metric = 255",
    expect: "fail",
    rule: "Num2Bits",
    ruleName: "(1) metric fits 7 bits (Num2Bits)",
    input: makeInput({ m: withMetric(2, 3, 255) }),
  },
  {
    id: "5",
    name: "metric = P - 1 (negative)",
    expect: "fail",
    rule: "Num2Bits",
    ruleName: "(1) metric fits 7 bits (Num2Bits)",
    input: makeInput({ m: withMetric(0, 1, P - 1n) }),
  },
  {
    id: "6",
    name: "S1 == S2 (equal scores)",
    expect: "fail",
    rule: "lt[k].out === 1",
    ruleName: "(3) scores strictly increase (LessThan)",
    input: makeInput({ m: [M_VALID[1], M_VALID[1], M_VALID[2]] }),
  },
  {
    id: "7a",
    name: "S1 > S2 (score goes down)",
    expect: "fail",
    rule: "lt[k].out === 1",
    ruleName: "(3) scores strictly increase (LessThan)",
    input: makeInput({ m: [M_VALID[1], M_VALID[0], M_VALID[2]] }),
  },
  {
    id: "7b",
    name: "S2 > S3 (score goes down)",
    expect: "fail",
    rule: "lt[k].out === 1",
    ruleName: "(3) scores strictly increase (LessThan)",
    input: makeInput({ m: [M_VALID[0], M_VALID[2], M_VALID[1]] }),
  },
  {
    id: "8",
    name: "wrong promptHash",
    expect: "fail",
    rule: "pos.out === promptCommitment",
    ruleName: "(4) Poseidon commitment matches",
    input: makeInput({
      promptHash: GOOD.promptHash + 1n,
      commitFrom: { promptHash: GOOD.promptHash, salt: GOOD.salt },
    }),
  },
  {
    id: "9",
    name: "wrong salt",
    expect: "fail",
    rule: "pos.out === promptCommitment",
    ruleName: "(4) Poseidon commitment matches",
    input: makeInput({
      salt: GOOD.salt + 1n,
      commitFrom: { promptHash: GOOD.promptHash, salt: GOOD.salt },
    }),
  },
];

(async () => {
  poseidon = await buildPoseidon();
  F = poseidon.F;
  const CASES = buildCases();
  const builder = require(path.join(BUILD, "witness_calculator.js"));
  const wasmBytes = fs.readFileSync(path.join(BUILD, "autoevolve.wasm"));

  const rows = [];
  let validWitness = null;
  for (const c of CASES) {
    let outcome, caught = "";
    try {
      // Fresh calculator per case: one instance keeps old error frames and
      // would report a stale "caught by" line for every later failure.
      const wc = await builder(wasmBytes);
      const w = await wc.calculateWitness(c.input, 0);
      outcome = "ok";
      if (c.id === "1") validWitness = w;
    } catch (err) {
      outcome = "fail";
      const e = explainError(err);
      caught = e.text;
      c.caughtTag = e.tag;
    }
    let pass = outcome === c.expect;
    if (pass && c.expect === "fail") pass = String(c.caughtTag).includes(c.rule);
    rows.push({ c, outcome, caught, pass });
  }

  console.log("\n #  | result | expected | case");
  console.log("----+--------+----------+------------------------------------------");
  for (const { c, outcome, pass } of rows) {
    console.log(
      ` ${c.id.padEnd(2)} | ${(pass ? "PASS" : "FAIL").padEnd(6)} | ${c.expect === "ok" ? "witness ok" : "must fail"} | ${c.name}   [got: ${outcome === "ok" ? "witness ok" : "rejected"}]`
    );
  }
  console.log("\nWhich rule caught each rejected case:");
  for (const { c, caught } of rows) {
    if (c.expect === "fail") console.log(` ${c.id.padEnd(2)} -> ${c.ruleName}\n      actual: ${caught}`);
  }

  // Public-signal order check (PLAN.md 3.5): witness[0] is the constant 1,
  // witness[1..16] are the 16 public signals.
  console.log("\nPublic-signal order check (case 1, PLAN.md 3.5):");
  let orderOk = false;
  if (validWitness) {
    const input = CASES[0].input;
    const expected = [
      ...input.m.flat().map(BigInt),
      BigInt(input.promptCommitment),
      BigInt(input.snapshotHash),
      BigInt(input.agentWallet),
      BigInt(input.taskId),
    ];
    const got = validWitness.slice(1, 17);
    const labels = [
      ...[0, 1, 2].flatMap((k) => [0, 1, 2, 3].map((j) => `m[${k}][${j}] (V${k + 1} metric ${j})`)),
      "promptCommitment", "snapshotHash", "agentWallet", "taskId",
    ];
    orderOk = expected.length === 16 && expected.every((v, i) => v === got[i]);
    expected.forEach((v, i) => {
      const s = v.toString();
      console.log(` ${String(i).padStart(2)}  ${(got[i] === v ? "ok " : "BAD")}  ${labels[i].padEnd(28)} ${s.length > 22 ? s.slice(0, 10) + "..." + s.slice(-6) : s}`);
    });
    console.log(` witness[0] (constant 1) = ${validWitness[0]}`);
  }
  console.log(`order check: ${orderOk ? "PASS" : "FAIL"}`);

  const failed = rows.filter((r) => !r.pass).length + (orderOk ? 0 : 1);
  console.log(`\n${failed === 0 ? "ALL PASS" : failed + " PROBLEM(S)"}: ${rows.filter((r) => r.pass).length}/${rows.length} cases, order check ${orderOk ? "ok" : "BAD"}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
