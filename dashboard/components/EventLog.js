"use client";
// Live terminal-style view of events.jsonl, plus Agent B's injected memory lessons.
import { useEffect, useRef } from "react";
import { Empty, ExtLink, short } from "@/components/ui";

const ACTOR_COLOR = {
  agent: "var(--ink-violet)",
  evaluator: "var(--ink-yellow)",
  prover: "var(--ink-violet)",
  pipeline: "var(--ink-teal)",
  cheat: "var(--ink-red)",
};

const WELL = "neu-inset-lg rounded-xl p-4 font-mono text-xs leading-5 text-gray-700 dark:text-gray-200";

export function EventLog({ events }) {
  const box = useRef(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight; // follow the newest line
  }, [events.length]);
  if (!events.length) return <Empty>No events yet.</Empty>;
  return (
    <div ref={box} className={`max-h-80 overflow-auto ${WELL}`}>
      {events.map((e, i) => (
        <div key={i} style={e.step === "error" ? { color: "var(--ink-red)" } : undefined}>
          <span className="text-gray-400">{(e.ts || "").slice(11, 19)} </span>
          <span className="font-semibold" style={{ color: ACTOR_COLOR[e.actor] }}>
            {(e.actor || "").padEnd(9)}
          </span>{" "}
          <span className="text-gray-500 dark:text-gray-400">[{e.step}]</span>
          {e.v ? <span> V{e.v}</span> : null}
          {e.score != null ? (
            <span className="font-semibold" style={{ color: "var(--ink-teal)" }}>
              {" "}
              score={e.score}
            </span>
          ) : null}{" "}
          <span title={e.msg}>{(e.msg || "").split("\n")[0].slice(0, 220)}</span>
        </div>
      ))}
    </div>
  );
}

// Agent B: which verified on-chain records it read, and the lessons it injected into its prompt.
export function MemoryUsed({ memory }) {
  if (!memory?.length) return null;
  return (
    <div className={`space-y-2 ${WELL}`}>
      {memory.map((m) => (
        <div key={m.record_id}>
          <div style={{ color: "var(--ink-violet)" }}>
            memory: record #{m.record_id} VERIFIED (IPFS bytes match on-chain snapshotHash) · cid{" "}
            <ExtLink href={m.cid?.startsWith("bafy-mock") ? null : `https://ipfs.io/ipfs/${m.cid}`}>{short(m.cid, 12, 6)}</ExtLink>
          </div>
          {(m.lessons_used || []).map((l, i) => (
            <div key={i}>
              <span className="font-bold" style={{ color: "var(--ink-teal)" }}>
                INJECTING LESSON:
              </span>{" "}
              {l}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
