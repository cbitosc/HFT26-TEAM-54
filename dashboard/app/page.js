"use client";
// The whole dashboard: header, tabs, and the panels. Every panel polls its API route every 3 s.
import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Badge, Card, Empty, StatusBadge, ExtLink, short, scoreLine, usePoll } from "@/components/ui";
import RunList from "@/components/RunList";
import ProofPanel from "@/components/ProofPanel";
import ChainLog from "@/components/ChainLog";
import CheatsTable from "@/components/CheatsTable";
import { EventLog, MemoryUsed } from "@/components/EventLog";
import { isLive } from "@/lib/model";

// These three draw with browser-only APIs, so render them in the browser only.
const ExecTree = dynamic(() => import("@/components/ExecTree"), { ssr: false });
const DiffPanel = dynamic(() => import("@/components/DiffPanel"), { ssr: false });
const BenchmarkChart = dynamic(() => import("@/components/BenchmarkChart"), { ssr: false });

const TABS = [
  ["runs", "Runs"],
  ["chain", "On-chain memory"],
  ["bench", "Agent B benchmark"],
  ["cheats", "Cheat attempts"],
];

// The "dark" class on <html> is the source of truth (set before paint by the script in layout.js).
function subscribeTheme(onChange) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function useTheme() {
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );
  const toggle = () => {
    const d = !dark;
    document.documentElement.classList.toggle("dark", d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
    try {
      localStorage.setItem("theme", d ? "dark" : "light");
    } catch {}
  };
  return [dark, toggle];
}

function RunHeader({ detail }) {
  const run = detail.run;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 className="font-mono text-lg font-semibold">{detail.id}</h2>
      <StatusBadge status={run?.status || (isLive(detail) ? "running" : "empty")} />
      {isLive(detail) && !detail.receipt && <Badge tone="blue">● live</Badge>}
      {detail.source !== "runs" && <Badge tone="amber">from {detail.source}/</Badge>}
      {run && (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Task {run.task_id} ({run.task_family}) · Agent {run.agent}{" "}
          <span className="font-mono">{short(run.agent_wallet, 6, 4)}</span> · {run.models?.generator} + critic{" "}
          {run.models?.critic}
        </span>
      )}
      {run?.versions?.length > 0 && (
        <span className="ml-auto font-mono text-lg font-bold tabular-nums">
          {scoreLine(run.versions.map((v) => v.score))}
        </span>
      )}
    </div>
  );
}

function RunsTab({ runs, selected, onSelect, follow, setFollow, dark }) {
  const { data: detail, error } = usePoll(selected ? `/api/runs/${selected}` : null);
  const current = detail && detail.id === selected ? detail : null;
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card
        title="Runs"
        right={
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            follow latest
          </label>
        }
        className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto"
      >
        <RunList runs={runs} selected={selected} onSelect={onSelect} />
      </Card>

      <div className="min-w-0 space-y-4">
        {!current ? (
          <Card>
            <Empty>{error || (selected ? "Loading run…" : "Pick a run on the left.")}</Empty>
          </Card>
        ) : (
          <>
            <Card>
              <RunHeader detail={current} />
            </Card>
            <Card title="Execution tree">
              <ExecTree detail={current} dark={dark} />
            </Card>
            {current.run?.memory_used?.length > 0 && (
              <Card title="Memory inherited from other agents (verified on-chain + IPFS)">
                <MemoryUsed memory={current.run.memory_used} />
              </Card>
            )}
            <Card title="Versions: diff, critique, changelog">
              {current.run ? <DiffPanel key={current.id} run={current.run} dark={dark} /> : <Empty>Waiting for run.json…</Empty>}
            </Card>
            <Card title="Proof & on-chain verification">
              <ProofPanel detail={current} />
            </Card>
            <Card title="Live event log (events.jsonl)">
              <EventLog events={current.events} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// The tab lives in the URL (#runs, #chain, #bench, #cheats) so each view can be bookmarked for the demo.
function subscribeHash(onChange) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function useTab() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
  const tab = TABS.some(([k]) => k === hash) ? hash : "runs";
  return [tab, (key) => (window.location.hash = key)];
}

export default function Dashboard() {
  const [dark, toggleTheme] = useTheme();
  const [tab, setTab] = useTab();
  const [follow, setFollow] = useState(true);
  const [picked, setPicked] = useState(null);
  const { data: runsData, error: runsError } = usePoll("/api/runs");
  const { data: chain } = usePoll("/api/chain");
  const { data: extras } = usePoll("/api/extras");

  const runs = runsData?.runs;
  // "Follow latest": always show the newest run, so a live run_all appears by itself during the demo.
  const selected = follow ? runs?.[0]?.id : picked || runs?.[0]?.id;
  const onSelect = (id) => {
    setPicked(id);
    setFollow(false);
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AutoEvolve Protocol</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Self-improving code agents · ZK-proven improvement · on-chain memory
          </p>
        </div>
        <nav className="ml-0 flex flex-wrap gap-1 rounded-lg bg-zinc-200/60 p-1 sm:ml-6 dark:bg-zinc-800/60">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === key
                  ? "bg-white shadow-sm dark:bg-zinc-950"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {label}
              {key === "chain" && chain?.ok ? ` (${chain.record_count})` : ""}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {chain && (
            <Badge tone={chain.ok ? "green" : "gray"} title={chain.error}>
              {chain.ok ? `${chain.chain} · ${chain.record_count} records` : `chain offline (${chain.chain})`}
            </Badge>
          )}
          <Badge tone={runsError ? "red" : "green"}>{runsError ? "disconnected" : "● live · 3 s"}</Badge>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Toggle light or dark mode"
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      {tab === "runs" && (
        <RunsTab runs={runs} selected={selected} onSelect={onSelect} follow={follow} setFollow={setFollow} dark={dark} />
      )}
      {tab === "chain" && <ChainLog chain={chain} />}
      {tab === "bench" && <BenchmarkChart benchmark={extras?.benchmark} />}
      {tab === "cheats" && <CheatsTable cheats={extras?.cheats} />}

      <footer className="mt-6 text-center text-xs text-zinc-400">
        Reads runs/, backup/ and schemas/ from the repo
        {chain?.ok && chain.explorer && (
          <>
            {" "}· registry <ExtLink href={`${chain.explorer}/address/${chain.registry}`}>{short(chain.registry, 6, 4)}</ExtLink>
          </>
        )}
      </footer>
    </div>
  );
}
