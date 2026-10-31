// Turns one run's raw files (run.json + events.jsonl + evaluator/proof/receipt) into
// "what happened so far". Works while the run is still in progress (no run.json yet).

const LIVE_MS = 120_000; // a run folder touched in the last 2 minutes counts as live

function metricsFromMsg(msg) {
  const m = /metrics \[([^\]]*)\]/.exec(msg || "");
  return m ? m[1].split(",").map((x) => Number(x.trim())) : null;
}

function failedFromMsg(msg) {
  const m = /failed \[([^\]]*)\]/.exec(msg || "");
  return m ? m[1].split(",").map((x) => x.trim().replace(/^'|'$/g, "")).filter(Boolean) : [];
}

// V1..V3 with their accepted score, plus rejected retries (attempts that did not beat the previous score).
export function deriveVersions(detail) {
  const run = detail.run;
  const events = detail.events || [];
  const versions = [];
  const done = !!run;
  const failed = run?.status === "failed_no_improvement";

  for (let n = 1; n <= 3; n++) {
    const fromRun = run?.versions?.[n - 1];
    const evals = events.filter((e) => e.step === "evaluate" && e.v === n);
    const accepted =
      !!fromRun || (n === 1 ? evals.length > 0 : events.some((e) => e.step === "revise" && e.v === n));
    const tries = evals.map((e) => ({ score: e.score, metrics: metricsFromMsg(e.msg), failed: failedFromMsg(e.msg) }));
    const retries = accepted ? tries.slice(0, -1) : tries;
    const last = tries[tries.length - 1];

    let status = "pending";
    if (accepted) status = "done";
    else if (done) status = failed ? "rejected" : "skipped"; // e.g. too_easy stops after V1
    else if (detail.phase === "live" && (versions[n - 2]?.status === "done" || n === 1)) status = "running";

    versions.push({
      v: n,
      status,
      score: fromRun?.score ?? (accepted ? last?.score : null) ?? null,
      metrics: Array.isArray(fromRun?.metrics) ? fromRun.metrics : accepted ? (last?.metrics ?? null) : null,
      failed_cases: fromRun?.failed_cases ?? (accepted ? last?.failed : null) ?? [],
      critique: fromRun?.critique ?? "",
      code: fromRun?.code ?? null,
      retries,
    });
  }
  // After the first unreachable version, later ones never happen.
  let stop = false;
  for (const v of versions) {
    if (stop) v.status = "skipped";
    if (v.status === "rejected") stop = true;
  }
  return versions;
}

// Errors from the steps after the agent loop (the agent's own errors are shown on V1-V3 instead).
export function pipelineErrors(detail) {
  return (detail.events || []).filter((e) => e.step === "error" && e.actor !== "agent");
}

// The four steps after the agent loop: sign -> prove -> upload -> submit (reward paid).
export function deriveSteps(detail) {
  const events = detail.events || [];
  const has = (step) => events.find((e) => e.step === step);
  const errors = pipelineErrors(detail);
  const notImproved = detail.run && detail.run.status !== "improved"; // nothing to prove, steps never run
  const steps = [
    { key: "sign", label: "Evaluator signs", done: !!detail.evaluator || !!has("sign"), actor: "evaluator" },
    { key: "prove", label: "ZK proof", done: !!detail.proof || !!has("prove"), actor: "prover" },
    { key: "upload", label: "IPFS upload", done: !!detail.receipt?.cid || !!has("upload"), actor: "pipeline" },
    { key: "submit", label: "On-chain verify + reward", done: !!detail.chainRecord, actor: "pipeline" },
  ];
  const live = pipelineActive(detail);
  let firstOpen = true;
  for (const s of steps) {
    s.event = [...events].reverse().find((e) => e.step === s.key || (s.key === "submit" && e.step === "verified"));
    if (s.key === "submit" && detail.chainRecord) s.event = { msg: `record #${detail.chainRecord.record_id} on-chain` };
    if (detail.source === "example") {
      s.status = "skipped"; // schemas/examples has a fake receipt; never draw it as done
      s.error = "example data, not real";
      continue;
    }
    if (s.done) {
      s.status = "done";
      continue;
    }
    const err = firstOpen && errors[errors.length - 1];
    if (notImproved) s.status = "skipped";
    else s.status = err ? "error" : firstOpen && detail.run && live ? "running" : "pending";
    if (err) s.error = err.msg;
    // A local receipt or "verified" event is not proof: say what is missing.
    if (s.key === "submit" && !err && (detail.has_receipt || has("verified")))
      s.error = detail.chainOk === false ? "cannot check: chain offline" : "no matching on-chain record";
    firstOpen = false;
  }
  return steps;
}

const THINKING_MS = 20 * 60_000; // R1 may reason for several minutes without writing anything

// The critic (DeepSeek-R1) is still reasoning: the last event is "<model> is reviewing V<n> ...".
// Returns { v, model, since } or null.
export function criticThinking(detail) {
  const events = detail.events || [];
  const last = events[events.length - 1];
  if (detail.run || !last || last.step !== "critique" || !/ is reviewing /.test(last.msg || "")) return null;
  const since = Date.parse(last.ts);
  if (!(Date.now() - since < THINKING_MS)) return null;
  return { v: last.v, model: last.msg.split(" is reviewing ")[0], since };
}

// LIVE = the agent loop is still running: no run_done event yet, and events.jsonl changed in the
// last 2 minutes (or the critic is still reasoning). Used on the server (lib/repo.js) per run.
export function runPhase({ events, events_updated }) {
  if (!events.length) return "empty";
  if (events.some((e) => e.step === "run_done")) return "done";
  const last = events[events.length - 1];
  const reviewing =
    last.step === "critique" && / is reviewing /.test(last.msg || "") && Date.now() - Date.parse(last.ts) < THINKING_MS;
  return reviewing || Date.now() - (events_updated || 0) < LIVE_MS ? "live" : "stalled";
}

export function isLive(detail) {
  return detail.phase === "live";
}

// After run_done, sign / prove / upload / submit may still be appending events (pipeline.run_all).
export function pipelineActive(detail) {
  return detail.phase === "done" && !detail.chainRecord && Date.now() - (detail.events_updated || 0) < LIVE_MS;
}

// The on-chain record for this run, or null. A match needs the snapshot_hash computed from this
// run's own run.json bytes, and the CID too when the run has a receipt. Nothing else counts.
export function chainMatch(item, chain) {
  if (!chain?.ok || !item?.snapshot_hash || item.source === "example") return null;
  return (
    chain.records.find((r) => r.snapshot_hash === item.snapshot_hash && (!item.cid || r.cid === item.cid)) || null
  );
}

// One honest state per run: example | verified | live | stalled | unconfirmed | not_submitted
export function runState(item, chain) {
  if (item.source === "example") return { key: "example" };
  const record = chainMatch(item, chain);
  if (record) return { key: "verified", record };
  if (item.phase === "live") return { key: "live", step: item.current_step };
  if (item.phase !== "done") return { key: "stalled" };
  if (item.has_receipt) return { key: "unconfirmed", offline: !chain?.ok };
  return { key: "not_submitted" };
}

export function elapsed(since) {
  const s = Math.max(0, Math.round((Date.now() - since) / 1000));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

// PLAN.md 3.5: exactly 16 public signals, in this order.
export function signalLabels() {
  const names = ["tests_passed", "edge_cases", "lint", "simplicity"];
  const out = [];
  for (let v = 1; v <= 3; v++) for (const n of names) out.push(`V${v} ${n}`);
  return [...out, "promptCommitment", "snapshotHash", "agentWallet", "taskId"];
}

export function walletFromSignal(value) {
  try {
    return "0x" + BigInt(value).toString(16).padStart(40, "0");
  } catch {
    return String(value);
  }
}

export function scoreOf(metrics, weights = [50, 20, 15, 15]) {
  return metrics.reduce((s, m, i) => s + Number(m) * weights[i], 0);
}
