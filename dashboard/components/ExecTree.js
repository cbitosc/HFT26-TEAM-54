"use client";
// Execution tree: [memory] -> V1 -> V2 -> V3, retries as side branches,
// then sign -> prove -> upload -> on-chain verify (from events.jsonl + files).
import { useMemo } from "react";
import { ReactFlow, Handle, Position, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { deriveVersions, deriveSteps, criticThinking, elapsed } from "@/lib/model";
import { short, Spinner } from "@/components/ui";

const STYLE = {
  done: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60",
  running: "border-blue-500 bg-blue-50 dark:bg-blue-950/60",
  pending: "border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900",
  rejected: "border-red-500 bg-red-50 dark:bg-red-950/60",
  error: "border-red-500 bg-red-50 dark:bg-red-950/60",
  skipped: "border-dashed border-zinc-300 bg-zinc-50 opacity-50 dark:border-zinc-700 dark:bg-zinc-900",
  memory: "border-violet-500 bg-violet-50 dark:bg-violet-950/60",
};
const ICON = { done: "✓", pending: "", rejected: "✗", error: "✗", skipped: "", memory: "◆" };

function StepNode({ data }) {
  return (
    <div className={`w-[190px] rounded-lg border-2 px-3 py-2 text-left shadow-sm ${STYLE[data.status]}`}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="target" id="top" position={Position.Top} className="!opacity-0" />
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{data.title}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-300">
          {data.status === "running" ? <Spinner /> : ICON[data.status]} {data.score != null ? data.score : ""}
        </span>
      </div>
      {data.lines?.map((l, i) => (
        <div key={i} className="truncate text-[11px] leading-4 text-zinc-600 dark:text-zinc-400" title={l}>
          {l}
        </div>
      ))}
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
const nodeTypes = { step: StepNode };

const X = 230; // horizontal gap between boxes
const RETRY_Y = 120;

function buildGraph(detail) {
  const nodes = [];
  const edges = [];
  const versions = deriveVersions(detail);
  const steps = deriveSteps(detail);
  const memory = detail.run?.memory_used || [];
  const edge = (source, target, extra = {}) =>
    edges.push({ id: `${source}-${target}`, source, target, type: "smoothstep", ...extra });

  let x = 0;
  let prev = null;
  if (memory.length) {
    const lessons = memory.reduce((n, m) => n + (m.lessons_used?.length || 0), 0);
    nodes.push({
      id: "memory",
      type: "step",
      position: { x, y: 0 },
      data: {
        title: "On-chain memory",
        status: "memory",
        lines: [`${lessons} lessons injected`, ...memory.map((m) => `record #${m.record_id} · ${short(m.cid, 8, 4)}`)],
      },
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
    nodes.push({
      id,
      type: "step",
      position: { x, y: 0 },
      data: {
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
          v.status === "done" ? (v.failed_cases.length ? `failed: ${v.failed_cases.join(", ")}` : "all hidden tests pass") : "",
        ].filter(Boolean),
      },
    });
    if (prev) edge(prev, id, { animated: v.status === "running" });
    // Retries: attempts that did not score strictly higher, branching off the previous version.
    v.retries.forEach((r, i) => {
      const rid = `${id}-retry${i}`;
      nodes.push({
        id: rid,
        type: "step",
        position: { x, y: RETRY_Y * (i + 1) },
        data: {
          title: `V${v.v} attempt ${i + 1}`,
          status: "rejected",
          score: r.score,
          lines: ["not strictly higher, retried"],
        },
      });
      edge(prev || id, rid, { targetHandle: "top", style: { stroke: "#ef4444", strokeDasharray: "4 4" } });
    });
    maxRetries = Math.max(maxRetries, v.retries.length);
    prev = id;
    x += X;
  }

  const y2 = RETRY_Y * (maxRetries + 1) + 30;
  steps.forEach((s, i) => {
    const id = `step-${s.key}`;
    const ev = s.event?.msg ? s.event.msg.split("\n")[0] : "";
    nodes.push({
      id,
      type: "step",
      position: { x: (memory.length ? X : 0) + i * X, y: y2 },
      data: { title: s.label, status: s.status, lines: [s.error || ev || s.actor].filter(Boolean) },
    });
    if (i === 0) edge("v3", id, { sourceHandle: "bottom", targetHandle: "top", animated: s.status === "running" });
    else edge(`step-${steps[i - 1].key}`, id, { animated: s.status === "running" });
  });

  return { nodes, edges };
}

export default function ExecTree({ detail, dark }) {
  const { nodes, edges } = useMemo(() => buildGraph(detail), [detail]);
  return (
    <div className="h-[360px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <ReactFlow
        key={`${detail.id}-${nodes.length}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={dark ? "dark" : "light"}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
      >
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
