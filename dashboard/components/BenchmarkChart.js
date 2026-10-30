"use client";
// Agent B benchmark: V1 score WITHOUT memory vs WITH verified on-chain memory (runs/benchmark.json).
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, Empty } from "@/components/ui";

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-zinc-600 dark:text-zinc-300">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function BenchmarkChart({ benchmark }) {
  if (!benchmark) return <Card title="Agent B benchmark"><Empty>runs/benchmark.json not found yet (P1: python -m agent.benchmark --tasks 2 3 4).</Empty></Card>;
  const s = benchmark.summary || {};
  const data = (benchmark.tasks || []).map((t) => ({
    task: `Task ${t.task_id}`,
    without: t.without.score,
    with: t.with.score,
  }));
  const delta = (s.avg_score_with ?? 0) - (s.avg_score_without ?? 0);

  return (
    <Card
      title="Does verified memory help? First-draft (V1) score per task"
      right={
        <div className="flex gap-1.5">
          {s.mock_llm && <Badge tone="amber">mock LLM</Badge>}
          {s.mock_chain && <Badge tone="amber">mock chain</Badge>}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-6">
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Average V1 score</div>
          <div className="text-2xl font-bold tabular-nums">
            {s.avg_score_without} → {s.avg_score_with}
            <span className={`ml-2 text-base ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              ({delta >= 0 ? "+" : ""}
              {delta})
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Tasks improved</div>
          <div className="text-2xl font-bold tabular-nums">
            {s.tasks_improved} / {s.tasks_total}
          </div>
        </div>
      </div>
      <div className="h-64 text-zinc-500 dark:text-zinc-400">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} />
            <XAxis dataKey="task" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 12 }} />
            <YAxis domain={[0, 10000]} tickLine={false} axisLine={false} width={48} tick={{ fill: "currentColor", fontSize: 12 }} />
            <Tooltip content={<Tip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-zinc-700 dark:text-zinc-300">{value}</span>}
            />
            <Bar dataKey="without" name="Without memory" fill="var(--without-memory)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              <LabelList dataKey="without" position="top" fill="currentColor" fontSize={11} />
            </Bar>
            <Bar dataKey="with" name="With on-chain memory" fill="var(--with-memory)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              <LabelList dataKey="with" position="top" fill="currentColor" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">Table view and lessons used</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 font-medium">Task</th>
              <th className="py-1 font-medium">Without</th>
              <th className="py-1 font-medium">With</th>
              <th className="py-1 font-medium">Failed without → with</th>
            </tr>
          </thead>
          <tbody>
            {(benchmark.tasks || []).map((t) => (
              <tr key={t.task_id}>
                <td className="py-1">{t.task_id}</td>
                <td className="py-1 tabular-nums">{t.without.score}</td>
                <td className="py-1 tabular-nums">{t.with.score}</td>
                <td className="py-1 font-mono text-xs">
                  {t.without.failed_cases.length} → {t.with.failed_cases.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-2 list-disc pl-5">
          {(benchmark.tasks?.[0]?.lessons_used || []).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
