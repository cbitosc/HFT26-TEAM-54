"use client";
// Side-by-side code diff between versions, with the critique that caused the change and the changelog.
import { useState } from "react";
import DiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Badge, Empty, NeuButton } from "@/components/ui";

// Match the diff viewer to the neumorphic surface (light = style guide colours).
const DIFF_STYLES = {
  variables: {
    light: {
      diffViewerBackground: "#e0e5ec",
      diffViewerTitleBackground: "#e0e5ec",
      diffViewerColor: "#1f2937",
      diffViewerTitleColor: "#374151",
      diffViewerTitleBorderColor: "#cfd4db",
      gutterBackground: "#d8dde5",
      gutterBackgroundDark: "#d1d6de",
      gutterColor: "#9ca3af",
      addedBackground: "#d3ece9",
      addedGutterBackground: "#c3e5e1",
      wordAddedBackground: "#a7ddd7",
      removedBackground: "#f3dcdc",
      removedGutterBackground: "#eccfcf",
      wordRemovedBackground: "#ebb9b9",
      emptyLineBackground: "#e0e5ec",
      codeFoldBackground: "#d8dde5",
      codeFoldGutterBackground: "#d1d6de",
      codeFoldContentColor: "#6b7280",
      highlightBackground: "#e6e2ff",
      highlightGutterBackground: "#dcd7ff",
    },
    dark: {
      diffViewerBackground: "#2a2e35",
      diffViewerTitleBackground: "#2a2e35",
      diffViewerColor: "#e5e7eb",
      diffViewerTitleColor: "#d1d5db",
      diffViewerTitleBorderColor: "#1e2126",
      gutterBackground: "#262a30",
      gutterBackgroundDark: "#23262c",
      gutterColor: "#6b7280",
      addedBackground: "#22403e",
      addedGutterBackground: "#1f3a38",
      wordAddedBackground: "#2b5a56",
      removedBackground: "#4a2a2e",
      removedGutterBackground: "#43262a",
      wordRemovedBackground: "#6a3439",
      emptyLineBackground: "#2a2e35",
      codeFoldBackground: "#262a30",
      codeFoldGutterBackground: "#23262c",
      codeFoldContentColor: "#9ca3af",
      highlightBackground: "#3a3570",
      highlightGutterBackground: "#332f63",
    },
  },
};

export default function DiffPanel({ run, dark }) {
  const versions = run?.versions || [];
  const pairs = versions.slice(1).map((v, i) => [versions[i], v]);
  const [pick, setPick] = useState(null);

  if (!versions.length) return <Empty>The diff appears when run.json is written (after V3).</Empty>;
  const idx = pick != null && pick < pairs.length ? pick : pairs.length - 1;
  const [a, b] = pairs[idx] || [null, versions[0]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {pairs.map(([x, y], i) => (
          <NeuButton key={i} active={i === idx} onClick={() => setPick(i)}>
            V{x.v} → V{y.v}
            <span className="ml-1.5 tabular-nums opacity-70">
              {y.score != null && x.score != null ? `${y.score - x.score >= 0 ? "+" : ""}${y.score - x.score}` : ""}
            </span>
          </NeuButton>
        ))}
      </div>

      {a && a.critique && (
        <div className="neu-inset relative overflow-hidden rounded-xl py-3 pl-6 pr-4 text-sm">
          <span className="absolute inset-y-3 left-2.5 w-1 rounded-full bg-[var(--accent-yellow)]" />
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-yellow)]">
            Critic ({run.models?.critic}) on V{a.v}
          </div>
          <p className="max-h-40 overflow-auto whitespace-pre-wrap text-gray-700 dark:text-gray-200">{a.critique}</p>
        </div>
      )}

      <div className="neu-inset overflow-x-auto rounded-xl p-2 text-xs">
        <DiffViewer
          oldValue={a?.code || ""}
          newValue={b.code || ""}
          splitView={!!a}
          useDarkTheme={dark}
          styles={DIFF_STYLES}
          compareMethod={DiffMethod.LINES}
          leftTitle={a ? `V${a.v} · score ${a.score}` : undefined}
          rightTitle={`V${b.v} · score ${b.score}`}
        />
      </div>

      {(b.failed_cases || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-gray-500 dark:text-gray-400">V{b.v} still fails:</span>
          {b.failed_cases.map((c) => (
            <Badge key={c} tone="red">
              {c}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Changelog
          </h3>
          <ul className="space-y-1 text-sm">
            {(run.changelog || []).map((c, i) => (
              <li key={i} className="font-mono text-[13px] text-gray-700 dark:text-gray-200">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Lessons (published for other agents)
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-200">
            {(run.lessons || []).map((l, i) => (
              <li key={i}>{l.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
