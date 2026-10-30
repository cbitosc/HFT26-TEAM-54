"use client";
// Live terminal-style view of events.jsonl, plus Agent B's injected memory lessons.
import { useEffect, useRef } from "react";
import { Empty, ExtLink, short } from "@/components/ui";

const ACTOR_COLOR = {
  agent: "text-sky-400",
  evaluator: "text-amber-400",
  prover: "text-violet-400",
  pipeline: "text-emerald-400",
  cheat: "text-red-400",
};

export function EventLog({ events }) {
  const box = useRef(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight; // follow the newest line
  }, [events.length]);
  if (!events.length) return <Empty>No events yet.</Empty>;
  return (
    <div ref={box} className="max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-200">
      {events.map((e, i) => (
        <div key={i} className={e.step === "error" ? "text-red-400" : ""}>
          <span className="text-zinc-500">{(e.ts || "").slice(11, 19)} </span>
          <span className={ACTOR_COLOR[e.actor] || "text-zinc-300"}>{(e.actor || "").padEnd(9)}</span>{" "}
          <span className="text-zinc-400">[{e.step}]</span>
          {e.v ? <span className="text-zinc-300"> V{e.v}</span> : null}
          {e.score != null ? <span className="text-emerald-300"> score={e.score}</span> : null}{" "}
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
    <div className="space-y-2 rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-200">
      {memory.map((m) => (
        <div key={m.record_id}>
          <div className="text-violet-300">
            memory: record #{m.record_id} VERIFIED (IPFS bytes match on-chain snapshotHash) · cid{" "}
            <ExtLink href={m.cid?.startsWith("bafy-mock") ? null : `https://ipfs.io/ipfs/${m.cid}`}>{short(m.cid, 12, 6)}</ExtLink>
          </div>
          {(m.lessons_used || []).map((l, i) => (
            <div key={i}>
              <span className="font-bold text-emerald-400">INJECTING LESSON:</span> {l}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
