"use client";
// Side-by-side code diff between versions, with the critique that caused the change and the changelog.
import { useState } from "react";
import DiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Badge, Empty } from "@/components/ui";

export default function DiffPanel({ run, dark }) {
  const versions = run?.versions || [];
  const pairs = versions.slice(1).map((v, i) => [versions[i], v]);
  const [pick, setPick] = useState(null);

  if (!versions.length) return <Empty>The diff appears when run.json is written (after V3).</Empty>;
  const idx = pick != null && pick < pairs.length ? pick : pairs.length - 1;
  const [a, b] = pairs[idx] || [null, versions[0]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {pairs.map(([x, y], i) => (
          <button
            key={i}
            onClick={() => setPick(i)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              i === idx
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            V{x.v} → V{y.v}
            <span className="ml-1.5 tabular-nums opacity-70">
              {y.score - x.score >= 0 ? "+" : ""}
              {y.score - x.score}
            </span>
          </button>
        ))}
      </div>

      {a && a.critique && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-950/40">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Critic ({run.models?.critic}) on V{a.v}
          </div>
          <p className="max-h-40 overflow-auto whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{a.critique}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 text-xs dark:border-zinc-800">
        <DiffViewer
          oldValue={a?.code || ""}
          newValue={b.code || ""}
          splitView={!!a}
          useDarkTheme={dark}
          compareMethod={DiffMethod.LINES}
          leftTitle={a ? `V${a.v} · score ${a.score}` : undefined}
          rightTitle={`V${b.v} · score ${b.score}`}
        />
      </div>

      {b.failed_cases?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">V{b.v} still fails:</span>
          {b.failed_cases.map((c) => (
            <Badge key={c} tone="red">
              {c}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Changelog
          </h3>
          <ul className="space-y-1 text-sm">
            {(run.changelog || []).map((c, i) => (
              <li key={i} className="font-mono text-[13px]">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Lessons (published for other agents)
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(run.lessons || []).map((l, i) => (
              <li key={i}>{l.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
