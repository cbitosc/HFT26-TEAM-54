"use client";
// Left column: every run folder in runs/ and backup/, newest first.
import { Badge, Empty, StatusBadge, scoreLine, timeAgo } from "@/components/ui";

function Dot({ on, label }) {
  return (
    <span
      title={label}
      className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-[var(--accent-teal)]" : "neu-inset"}`}
    />
  );
}

export default function RunList({ runs, selected, onSelect }) {
  if (!runs) return <Empty>Loading runs…</Empty>;
  if (!runs.length) return <Empty>No runs yet. Start one with `python -m pipeline.run_all --task 1 --agent A`.</Empty>;
  return (
    <ul className="space-y-3">
      {runs.map((r) => {
        const active = r.id === selected;
        return (
          <li key={`${r.source}/${r.id}`}>
            <button
              onClick={() => onSelect(r.id)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 ${
                active ? "neu-inset" : "neu-raised-sm hover:scale-[0.98]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate font-mono text-xs font-semibold ${active ? "text-[var(--ink-violet)]" : "text-gray-800 dark:text-gray-100"}`}>{r.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
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
                <span className="flex items-center gap-1.5" aria-label="signed, proved, on-chain">
                  <Dot on={r.steps.signed} label="evaluator signed" />
                  <Dot on={r.steps.proved} label="ZK proof" />
                  <Dot on={r.steps.onchain} label="verified on-chain" />
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums text-gray-700 dark:text-gray-200">{scoreLine(r.scores)}</span>
                <span className="text-gray-400">{timeAgo(r.updated)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
