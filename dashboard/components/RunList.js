"use client";
// Left column: every run folder in runs/ and backup/, newest first.
import { Badge, Empty, StatusBadge, scoreLine, timeAgo } from "@/components/ui";

function Dot({ on, label }) {
  return (
    <span
      title={label}
      className={`inline-block h-2 w-2 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
    />
  );
}

export default function RunList({ runs, selected, onSelect }) {
  if (!runs) return <Empty>Loading runs…</Empty>;
  if (!runs.length) return <Empty>No runs yet. Start one with `python -m pipeline.run_all --task 1 --agent A`.</Empty>;
  return (
    <ul className="space-y-1.5">
      {runs.map((r) => {
        const active = r.id === selected;
        return (
          <li key={`${r.source}/${r.id}`}>
            <button
              onClick={() => onSelect(r.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                  : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs font-semibold">{r.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  Task {r.task_id} · Agent {r.agent}
                  {r.uses_memory && (
                    <span className="ml-1">
                      <Badge tone="violet">memory</Badge>
                    </span>
                  )}
                  {r.source !== "runs" && (
                    <span className="ml-1">
                      <Badge tone="amber">{r.source}</Badge>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1" aria-label="signed, proved, on-chain">
                  <Dot on={r.steps.signed} label="evaluator signed" />
                  <Dot on={r.steps.proved} label="ZK proof" />
                  <Dot on={r.steps.onchain} label="verified on-chain" />
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums">{scoreLine(r.scores)}</span>
                <span className="text-zinc-400">{timeAgo(r.updated)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
