"use client";
// Left column: every run, grouped by what it really is, newest first inside each group.
//   Running now -> Verified on-chain -> Real runs (not submitted) -> Practice runs (mock model)
// Everything shown comes from the run's own files (run.json, events.jsonl, tasks/tasks.json) or /api/chain.
import { Badge, Empty, StatusBadge, scoreLine, timeAgo } from "@/components/ui";
import RunStateBadge from "@/components/RunState";
import { runState } from "@/lib/model";

const GROUPS = [
  {
    key: "live",
    title: "Running now",
    help: "The agent is working right now. Watch the tree on the right fill in.",
  },
  {
    key: "verified",
    title: "Verified on-chain",
    help: "Signed by the evaluator, proven with ZK, and recorded on the blockchain. Open one to see the proof and the transaction.",
  },
  {
    key: "real",
    title: "Real runs, not submitted",
    help: "A real AI model wrote and fixed the code, scored by the hidden tests. These were test runs on the laptop and were never sent to the chain.",
  },
  {
    key: "practice",
    title: "Practice runs (mock model)",
    help: "Rehearsals with canned answers instead of a real AI model. They test the pipeline and are not real results.",
    collapsed: true,
  },
];

function groupOf(run, state) {
  if (state.key === "live") return "live";
  if (state.key === "verified") return "verified";
  return run.mock ? "practice" : "real";
}

function startedAt(run) {
  const d = new Date(run.started || run.updated);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function RunCard({ run, state, active, onSelect }) {
  const known = run.scores.filter((s) => s != null);
  const gain = known.length > 1 ? known[known.length - 1] - known[0] : null;
  return (
    <button
      onClick={() => onSelect(run.id)}
      className={`w-full rounded-xl px-3.5 py-3 text-left transition-all duration-200 ${
        active ? "neu-inset" : "neu-raised-sm hover:scale-[0.98]"
      }`}
    >
      <div className={`text-sm font-semibold ${active ? "text-[var(--ink-violet)]" : "text-gray-800 dark:text-gray-100"}`}>
        Task {run.task_id ?? "?"}
        {run.function_name && <span className="ml-1.5 font-mono text-xs font-normal">{run.function_name}</span>}
      </div>
      <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        Agent {run.agent ?? "?"}
        {run.uses_memory ? " · started from on-chain memory" : " · started from scratch"}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">
          {scoreLine(run.scores) || "no score yet"}
        </span>
        {gain != null && (
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: gain > 0 ? "var(--ink-teal)" : gain < 0 ? "var(--ink-red)" : undefined }}
          >
            {gain > 0 ? `+${gain}` : gain}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={run.status} />
        {state.key !== "example" && <RunStateBadge state={state} compact />}
        {run.source === "backup" && (
          <Badge tone="amber" title="Loaded from the committed backup/ folder">
            saved copy
          </Badge>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span>
          {startedAt(run)} · {timeAgo(run.updated)}
        </span>
        <span className="shrink-0 font-mono" title={`run folder: ${run.source}/${run.id}`}>
          {run.id.replace(/^t\d+-\d{8}-/, "#")}
        </span>
      </div>
    </button>
  );
}

function GroupHeading({ group, count }) {
  return (
    <div className="inline-block align-top">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
        {group.title} <span className="font-normal text-gray-500 dark:text-gray-400">· {count}</span>
        {group.collapsed && (
          <span className="ml-2 font-normal normal-case text-[var(--ink-violet)]">click to show</span>
        )}
      </h3>
      <p className="mt-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400">{group.help}</p>
    </div>
  );
}

export default function RunList({ runs, selected, onSelect, chain }) {
  if (!runs) return <Empty>Loading runs…</Empty>;
  if (!runs.length) return <Empty>No runs yet. Start one with `python -m pipeline.run_all --task 1 --agent A`.</Empty>;

  const grouped = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
  for (const run of runs) {
    const state = runState(run, chain);
    grouped[groupOf(run, state)].push({ run, state });
  }

  return (
    <div className="space-y-6">
      <details className="text-xs text-gray-600 dark:text-gray-300">
        <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-200">What is this list?</summary>
        <p className="mt-2 leading-5">
          Each card is <span className="font-semibold">one run</span>: one agent trying one task. Agent A starts from
          scratch. Agent B starts from lessons it read from the blockchain. The score is out of 10000 and each version
          must beat the last. A run only counts as verified when a record on the contract matches it.
        </p>
      </details>

      {GROUPS.map((g) => {
        const items = grouped[g.key];
        if (!items.length) return null;
        const list = (
          <ul className="space-y-3">
            {items.map(({ run, state }) => (
              <li key={`${run.source}/${run.id}`}>
                <RunCard run={run} state={state} active={run.id === selected} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        );
        return (
          <section key={g.key}>
            {g.collapsed ? (
              <details open={items.some((x) => x.run.id === selected)}>
                <summary className="flex cursor-pointer list-none items-start gap-1.5 [&::-webkit-details-marker]:hidden">
                  <GroupHeading group={g} count={items.length} />
                </summary>
                <div className="mt-3">{list}</div>
              </details>
            ) : (
              <>
                <GroupHeading group={g} count={items.length} />
                <div className="mt-3">{list}</div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
