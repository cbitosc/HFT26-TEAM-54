// Server-only helpers: read the run folders that P1/P2/P3's scripts write (PLAN.md 3.3).
// The dashboard never writes anything; it only reads files from the repo root.
import fs from "node:fs";
import path from "node:path";

// dashboard/ lives inside the repo, so the repo root is one folder up.
export const ROOT = process.env.REPO_ROOT || path.resolve(process.cwd(), "..");
const SOURCES = ["runs", "backup"]; // backup/ = the saved demo run (PLAN.md 2, fallback)
const EXAMPLES = path.join(ROOT, "schemas", "examples");
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null; // missing, or half-written while a script is still running
  }
}

export function readJsonl(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // last line may be half-written; skip it, the next poll will get it
    }
  }
  return out;
}

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

// run_id = t<task>-<YYYYMMDD-HHMMSS>-<A|B>
function parseRunId(id) {
  const m = /^t(\d+)-(\d{8})-(\d{6})-([AB])$/.exec(id);
  return m ? { task_id: Number(m[1]), agent: m[4] } : { task_id: null, agent: null };
}

// Each run folder is { id, source, dir }. Examples are used only while no real run exists.
function runFolders() {
  const found = [];
  for (const source of SOURCES) {
    const base = path.join(ROOT, source);
    let names = [];
    try {
      names = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      continue;
    }
    for (const name of names) {
      if (SAFE_ID.test(name)) found.push({ id: name, source, dir: path.join(base, name) });
    }
  }
  return found;
}

const EXAMPLE_FILES = {
  run: "run.example.json",
  evaluator: "evaluator.example.json",
  proof: "proof.example.json",
  receipt: "receipt.example.json",
  events: "events.example.jsonl",
};
const RUN_FILES = {
  run: "run.json",
  evaluator: "evaluator.json",
  proof: "proof.json",
  receipt: "receipt.json",
  events: "events.jsonl",
};

function loadFolder(folder) {
  const names = folder.source === "example" ? EXAMPLE_FILES : RUN_FILES;
  const p = (k) => path.join(folder.dir, names[k]);
  const files = {
    run: readJson(p("run")),
    evaluator: readJson(p("evaluator")),
    proof: readJson(p("proof")),
    receipt: readJson(p("receipt")),
    events: readJsonl(p("events")),
  };
  const updated = Math.max(...Object.keys(names).map((k) => mtime(p(k))));
  return { id: folder.id, source: folder.source, updated, ...files };
}

function allFolders() {
  const real = runFolders();
  if (real.length) return real;
  const exampleRun = readJson(path.join(EXAMPLES, EXAMPLE_FILES.run));
  return exampleRun ? [{ id: exampleRun.run_id, source: "example", dir: EXAMPLES }] : [];
}

// A short row for the run list.
function summarise(r) {
  const fromId = parseRunId(r.id);
  const run = r.run || {};
  const events = r.events;
  const last = events[events.length - 1] || null;
  const errored = events.some((e) => e.step === "error");
  const scores = (run.versions || []).map((v) => v.score);
  // While run.json does not exist yet, show the scores the evaluator already logged.
  if (!scores.length) {
    for (const e of events) if (e.v && e.score != null && e.step === "revise") scores[e.v - 1] = e.score;
    const v1 = events.find((e) => e.v === 1 && e.step === "evaluate");
    if (v1) scores[0] = v1.score;
  }
  return {
    id: r.id,
    source: r.source,
    updated: r.updated,
    task_id: run.task_id ?? fromId.task_id,
    agent: run.agent ?? fromId.agent,
    status: run.status || (errored ? "error" : events.length ? "running" : "empty"),
    scores,
    uses_memory: (run.memory_used || []).length > 0,
    example: r.source === "example",
    // Example files contain a fake receipt: never show them as signed / proved / on-chain.
    steps: {
      run: !!r.run,
      signed: r.source !== "example" && !!r.evaluator,
      proved: r.source !== "example" && !!r.proof,
      onchain: r.source !== "example" && !!r.receipt,
    },
    error: errored,
    last_event: last,
  };
}

export function listRuns() {
  return allFolders()
    .map((f) => summarise(loadFolder(f)))
    .sort((a, b) => b.updated - a.updated);
}

export function getRun(id) {
  if (!SAFE_ID.test(id)) return null; // never let the URL walk out of runs/
  const folder = allFolders().find((f) => f.id === id);
  return folder ? loadFolder(folder) : null;
}

// runs/benchmark.json (P1) and runs/cheats.json (P2), with backup/ as fallback.
export function getExtras() {
  const pick = (name) => readJson(path.join(ROOT, "runs", name)) || readJson(path.join(ROOT, "backup", name));
  return { benchmark: pick("benchmark.json"), cheats: pick("cheats.json") };
}

// schemas/deployments.<CHAIN>.json (P3) and the registry ABI. Never hardcode addresses (PLAN.md 3.1).
export function getDeployment(chain) {
  return readJson(path.join(ROOT, "schemas", `deployments.${chain}.json`));
}

export function getRegistryAbi() {
  return readJson(path.join(ROOT, "schemas", "abi", "AutoEvolveRegistry.json"));
}
