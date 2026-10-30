"use client";
// Agent B benchmark: V1 score WITHOUT memory vs WITH verified on-chain memory (runs/benchmark.json from P1).
// Honest by design: every task is shown (improved, flat or regressed), numbers are computed from the per-task
// rows, and the n=1 caveat is printed. An optional per-task `note` in benchmark.json explains a result.
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, Empty } from "@/components/ui";

// tasks/tasks.json function names (tasks 2-4 are the benchmark tasks)
const TASK_FN = { 2: "count_levels", 3: "extract_fields", 4: "filter_by_level" };

const sign = (n) => (n > 0 ? `+${n}` : String(n));
const tone = (n) => (n > 0 ? "var(--ink-teal)" : n < 0 ? "var(--ink-red)" : "var(--neu-dark)");
const word = (n) => (n > 0 ? "improved" : n < 0 ? "regressed" : "no change");
const mean = (xs) => Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length);

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neu-raised-sm rounded-xl px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600 dark:text-gray-300">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function BenchmarkChart({ benchmark }) {
  if (!benchmark?.tasks?.length)
    return (
      <Card title="Agent B benchmark">
        <Empty>runs/benchmark.json not found yet (P1: python -m agent.benchmark --tasks 2 3 4).</Empty>
      </Card>
    );
  const s = benchmark.summary || {};
  const rows = benchmark.tasks.map((t) => {
    const without = t.without?.score ?? 0;
    const withMem = t.with?.score ?? 0;
    return {
      id: t.task_id,
      fn: TASK_FN[t.task_id] || "",
      without,
      with: withMem,
      delta: withMem - without,
      failedWithout: (t.without?.failed_cases || []).length,
      failedWith: (t.with?.failed_cases || []).length,
      note: t.note || "",
      lessons: t.lessons_used || [],
    };
  });
  const avgWithout = mean(rows.map((r) => r.without));
  const avgWith = mean(rows.map((r) => r.with));
  const avgDelta = avgWith - avgWithout;
  const improved = rows.filter((r) => r.delta > 0).length;
  const regressed = rows.filter((r) => r.delta < 0);
  const data = rows.map((r) => ({ task: `Task ${r.id}`, without: r.without, with: r.with }));

  return (
    <Card
      title="Does verified memory help? First-draft (V1) score per task"
      right={
        <div className="flex gap-1.5">
          {s.mock_llm && <Badge tone="amber">mock LLM</Badge>}
          {s.mock_chain && <Badge tone="amber">mock chain</Badge>}
          <Badge tone="gray">n = 1 per task</Badge>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Average V1 score, all {rows.length} tasks</div>
          <div className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100">
            {avgWithout} → {avgWith}
            <span className="ml-2 text-base" style={{ color: tone(avgDelta) }}>
              ({sign(avgDelta)})
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Per task</div>
          <div className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100">
            {improved} improved
            {regressed.length > 0 && (
              <span className="ml-2 text-base" style={{ color: "var(--ink-red)" }}>
                · {regressed.length} regressed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="neu-inset h-72 rounded-xl p-4 text-gray-500 dark:text-gray-400">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} />
            <XAxis dataKey="task" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 12 }} />
            <YAxis domain={[0, 10000]} tickLine={false} axisLine={false} width={48} tick={{ fill: "currentColor", fontSize: 12 }} />
            <Tooltip content={<Tip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-gray-700 dark:text-gray-300">{value}</span>}
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

      {/* Every task, always visible: nothing hidden behind a toggle. */}
      <div className="neu-inset mt-6 overflow-x-auto rounded-xl p-3">
        <table className="w-full text-left text-sm text-gray-700 dark:text-gray-200">
          <thead className="text-xs text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Task</th>
              <th className="py-1.5 pr-3 font-medium">Without</th>
              <th className="py-1.5 pr-3 font-medium">With memory</th>
              <th className="py-1.5 pr-3 font-medium">Change</th>
              <th className="py-1.5 pr-3 font-medium">Failed hidden tests</th>
              <th className="py-1.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-2 pr-3">
                  <span className="font-semibold">Task {r.id}</span>
                  {r.fn && <span className="ml-1.5 font-mono text-xs text-gray-500 dark:text-gray-400">{r.fn}</span>}
                </td>
                <td className="py-2 pr-3 tabular-nums">{r.without}</td>
                <td className="py-2 pr-3 tabular-nums">{r.with}</td>
                <td className="py-2 pr-3">
                  <span className="font-bold tabular-nums" style={{ color: tone(r.delta) }}>
                    {sign(r.delta)}
                  </span>{" "}
                  <span className="text-xs text-gray-500 dark:text-gray-400">{word(r.delta)}</span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {r.failedWithout} → {r.failedWith}
                </td>
                <td className="py-2 text-xs text-gray-600 dark:text-gray-300">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-5 text-gray-600 dark:text-gray-300">
        <span className="font-semibold">Read this honestly:</span> one sample per task (n = 1), so these differences are
        anecdotal, not statistically significant. All tasks are shown, including regressions
        {regressed.length > 0 && ` (${regressed.map((r) => `Task ${r.id}`).join(", ")})`}. The point of this demo is the
        memory mechanism: chain → IPFS → hash check → lessons injected. It is not a claim that memory always raises scores.
      </p>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-gray-500 dark:text-gray-400">Lessons injected</summary>
        <ul className="mt-2 list-disc pl-5 text-gray-700 dark:text-gray-200">
          {(rows.find((r) => r.lessons.length)?.lessons || []).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
