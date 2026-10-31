"use client";
// Execution tree "road map": [memory] -> V1 -> V2 -> V3, retries as side branches,
// then sign -> prove -> upload -> on-chain verify (from events.jsonl + files).
// Animations: boxes slide in one by one, finished roads flow with a travelling dot,
// the running box glows, a box pops when it completes, rejected attempts shake.
import { useMemo } from "react";
import { ReactFlow, Handle, Position, Background, getSmoothStepPath } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { deriveVersions, deriveSteps, criticThinking, elapsed } from "@/lib/model";
import { short, Spinner } from "@/components/ui";

const SURFACE = {
  done: "neu-raised node-done",
  running: "neu-raised node-running",
  pending: "neu-inset",
  rejected: "neu-raised node-rejected",
  error: "neu-raised node-rejected",
  skipped: "neu-inset opacity-50",
  memory: "neu-raised node-done",
};
const ACCENT = {
  done: "var(--accent-teal)",
  running: "var(--accent)",
  pending: "var(--neu-dark)",
  rejected: "var(--accent-red)",
  error: "var(--accent-red)",
  skipped: "var(--neu-dark)",
  memory: "var(--accent)",
};
const INK = {
  done: "var(--ink-teal)",
  running: "var(--ink-violet)",
  rejected: "var(--ink-red)",
  error: "var(--ink-red)",
  memory: "var(--ink-violet)",
};
const ICON = { done: "✓", rejected: "✗", error: "✗", memory: "◆" };

function StepNode({ data }) {
  return (
    <div className="tree-node" style={{ "--delay": `${data.index * 80}ms` }}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="target" id="top" position={Position.Top} className="!opacity-0" />
      {/* key={status}: when the status changes the box re-mounts, so its pop / glow / shake plays again */}
      <div
        key={data.status}
        className={`relative w-[190px] overflow-hidden rounded-xl py-2 pl-4 pr-3 text-left ${SURFACE[data.status]}`}
      >
        <span className="absolute inset-y-2 left-1.5 w-1 rounded-full" style={{ background: ACCENT[data.status] }} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{data.title}</span>
          <span className="flex items-center gap-1 text-xs font-bold tabular-nums" style={{ color: INK[data.status] }}>
            {data.status === "running" ? <Spinner /> : ICON[data.status]} {data.score != null ? data.score : ""}
          </span>
        </div>
        {data.lines?.map((l, i) => (
          <div key={i} className="truncate text-[11px] leading-4 text-gray-600 dark:text-gray-400" title={l}>
            {l}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

// A road: recessed bed + coloured lane; done/active roads carry a travelling dot.
function RoadEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14 });
  const state = data?.state || "pending";
  const moving = state === "done" || state === "active";
  return (
    <g>
      <path d={path} className="road-bed" />
      <path d={path} className={`road-lane road-${state}`} />
      {moving && (
        <circle r={state === "active" ? 4.5 : 3.5} className={state === "active" ? "road-dot" : "road-dot-done"}>
          <animateMotion dur={state === "active" ? "1.4s" : "3.2s"} repeatCount="indefinite" path={path} />
        </circle>
      )}
    </g>
  );
}

const nodeTypes = { step: StepNode };
const edgeTypes = { road: RoadEdge };

const X = 230; // horizontal gap between boxes
const RETRY_Y = 120;
const ROAD = { done: "done", memory: "done", running: "active", rejected: "rejected", error: "rejected" };

function buildGraph(detail) {
  const nodes = [];
  const edges = [];
  const versions = deriveVersions(detail);
  const steps = deriveSteps(detail);
  const memory = detail.run?.memory_used || [];
  const statusOf = {};
  const node = (id, position, data) => {
    statusOf[id] = data.status;
    nodes.push({ id, type: "step", position, data: { ...data, index: nodes.length } });
  };
  // The road into a box takes the colour of that box's state.
  const edge = (source, target, extra = {}) =>
    edges.push({
      id: `${source}-${target}`,
      source,
      target,
      type: "road",
      data: { state: ROAD[statusOf[target]] || "pending" },
      ...extra,
    });

  let x = 0;
  let prev = null;
  if (memory.length) {
    const lessons = memory.reduce((n, m) => n + (m.lessons_used?.length || 0), 0);
    node("memory", { x, y: 0 }, {
      title: "On-chain memory",
      status: "memory",
      lines: [`${lessons} lessons injected`, ...memory.map((m) => `record #${m.record_id} · ${short(m.cid, 8, 4)}`)],
    });
    prev = "memory";
    x += X;
  }

  const thinking = criticThinking(detail);
  let maxRetries = 0;
  for (const v of versions) {
    const id = `v${v.v}`;
    const m = v.metrics;
    const reviewing = thinking && v.status === "running" && thinking.v === v.v - 1;
    node(id, { x, y: 0 }, {
      title: `V${v.v}`,
      status: v.status,
      score: v.score,
      lines: [
        reviewing
          ? `critic reviewing V${thinking.v} · ${elapsed(thinking.since)}`
          : m
            ? `tests ${m[0]} · edge ${m[1]} · lint ${m[2]} · simp ${m[3]}`
            : v.status === "running"
              ? "working…"
              : "—",
        v.status === "done" ? ((v.failed_cases || []).length ? `failed: ${(v.failed_cases || []).join(", ")}` : "all hidden tests pass") : "",
      ].filter(Boolean),
    });
    if (prev) edge(prev, id);
    // Retries: attempts that did not score strictly higher, branching off the previous version.
    v.retries.forEach((r, i) => {
      const rid = `${id}-retry${i}`;
      node(rid, { x, y: RETRY_Y * (i + 1) }, {
        title: `V${v.v} attempt ${i + 1}`,
        status: "rejected",
        score: r.score,
        lines: ["not strictly higher, retried"],
      });
      edge(prev || id, rid, { targetHandle: "top" });
    });
    maxRetries = Math.max(maxRetries, v.retries.length);
    prev = id;
    x += X;
  }

  const y2 = RETRY_Y * (maxRetries + 1) + 30;
  steps.forEach((s, i) => {
    const id = `step-${s.key}`;
    const ev = s.event?.msg ? s.event.msg.split("\n")[0] : "";
    node(id, { x: (memory.length ? X : 0) + i * X, y: y2 }, {
      title: s.label,
      status: s.status,
      lines: [s.error || ev || s.actor].filter(Boolean),
    });
    if (i === 0) edge("v3", id, { sourceHandle: "bottom", targetHandle: "top" });
    else edge(`step-${steps[i - 1].key}`, id);
  });

  return { nodes, edges, versions, steps };
}

// "4 / 7 · next: Evaluator signs" with a filling bar.
function Progress({ versions, steps }) {
  const items = [...versions.map((v) => ({ label: `V${v.v}`, status: v.status })), ...steps];
  const done = items.filter((i) => i.status === "done").length;
  const running = items.some((i) => i.status === "running");
  const stopped = items.find((i) => ["rejected", "error", "skipped"].includes(i.status));
  const next = items.find((i) => i.status !== "done");
  const pct = Math.round((done / items.length) * 100);
  const fill = done === items.length ? "var(--accent-teal)" : stopped && !running ? "var(--accent-red)" : "var(--accent)";
  return (
    <div className="mb-5 flex items-center gap-4">
      <div className="neu-inset h-4 flex-1 overflow-hidden rounded-full p-1">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${running ? "progress-live" : ""}`}
          style={{ width: `${Math.max(pct, 4)}%`, background: fill }}
        />
      </div>
      <span className="whitespace-nowrap text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
        {done} / {items.length} ·{" "}
        {done === items.length ? "complete" : stopped && !running ? `stopped at ${stopped.label}` : `next: ${next.label}`}
      </span>
    </div>
  );
}

export default function ExecTree({ detail, dark }) {
  const { nodes, edges, versions, steps } = useMemo(() => buildGraph(detail), [detail]);
  return (
    <div>
      <Progress versions={versions} steps={steps} />
      <div className="neu-inset-lg h-[380px] w-full overflow-hidden rounded-2xl">
        <ReactFlow
          key={`${detail.id}-${nodes.length}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={dark ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
        >
          <Background gap={18} size={1.5} color="var(--neu-dark)" />
        </ReactFlow>
      </div>
    </div>
  );
}
