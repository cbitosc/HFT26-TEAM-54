"use client";
// The honest chain/progress state of one run (see lib/model.js runState).
// VERIFIED only when an on-chain record matches this run's own snapshot_hash (and CID).
import { Badge } from "@/components/ui";

const STEP_LABEL = {
  generate: "writing code",
  evaluate: "running hidden tests",
  critique: "critic reviewing",
  revise: "revising",
  lessons: "writing lessons",
};

function Pulse() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
    </span>
  );
}

export default function RunStateBadge({ state, compact = false }) {
  switch (state.key) {
    case "live":
      return (
        <span className="neu-inset inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold text-[var(--ink-violet)]">
          <Pulse />
          LIVE{state.step ? ` · ${STEP_LABEL[state.step] || state.step}` : ""}
        </span>
      );
    case "verified":
      return (
        <Badge tone="green" title="An on-chain record matches this run's snapshot hash">
          {compact ? `on-chain #${state.record.record_id}` : `Verified on-chain · record #${state.record.record_id}`}
        </Badge>
      );
    case "unconfirmed":
      return (
        <Badge tone="amber" title="receipt.json exists, but no on-chain record matches this run's snapshot hash">
          {state.offline ? "Cannot check: chain offline" : "Not confirmed on-chain"}
        </Badge>
      );
    case "stalled":
      return (
        <Badge tone="amber" title="No run_done event and no new events for 2 minutes">
          {compact ? "stopped" : "Stopped (no run_done)"}
        </Badge>
      );
    case "not_submitted":
      return <Badge tone="gray">{compact ? "not submitted" : "Not submitted to chain (demo run)"}</Badge>;
    default:
      return null; // example data has its own banner
  }
}
