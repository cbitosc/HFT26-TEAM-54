"use client";
// The whole dashboard: header, tabs, and the panels. Every panel polls its API route every 3 s;
// the open run polls every 1 s while it is LIVE (or its pipeline is still writing events).
import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Badge, Card, Empty, StatusBadge, ExtLink, NeuButton, Spinner, short, scoreLine, usePoll } from "@/components/ui";
import RunList from "@/components/RunList";
import ProofPanel from "@/components/ProofPanel";
import ChainLog from "@/components/ChainLog";
import CheatsTable from "@/components/CheatsTable";
import Overview from "@/components/Overview";
import { EventLog, MemoryUsed } from "@/components/EventLog";
import RunStateBadge from "@/components/RunState";
import { isLive, criticThinking, elapsed, chainMatch, runState, pipelineActive } from "@/lib/model";

// These three draw with browser-only APIs, so render them in the browser only.
const ExecTree = dynamic(() => import("@/components/ExecTree"), { ssr: false });
const DiffPanel = dynamic(() => import("@/components/DiffPanel"), { ssr: false });
const BenchmarkChart = dynamic(() => import("@/components/BenchmarkChart"), { ssr: false });

const TABS = [
  ["overview", "Overview"],
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

function RunHeader({ detail, state }) {
  const run = detail.run;
  const thinking = criticThinking(detail);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {detail.source === "example" && (
        <div className="neu-inset relative w-full overflow-hidden rounded-xl py-4 pl-7 pr-5">
          <span className="absolute inset-y-3 left-2.5 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
          <div className="text-lg font-extrabold tracking-wide text-[var(--ink-yellow)]">EXAMPLE DATA, not a real run</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            No real runs found in runs/ or backup/, so this shows schemas/examples/. The proof, signature and
            transaction are placeholders: nothing here was verified or paid.
          </div>
        </div>
      )}
      <h2 className="font-mono text-lg font-semibold text-gray-800 dark:text-gray-100">{detail.id}</h2>
      {run?.status && <StatusBadge status={run.status} />}
      <RunStateBadge state={state} />
      {detail.source !== "runs" && <Badge tone="amber">from {detail.source}/</Badge>}
      {run && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Task {run.task_id} ({run.task_family}) · Agent {run.agent}{" "}
          <span className="font-mono">{short(run.agent_wallet, 6, 4)}</span> · {run.models?.generator} + critic{" "}
          {run.models?.critic}
        </span>
      )}
      {run?.versions?.length > 0 && (
        <span className="ml-auto font-mono text-lg font-bold tabular-nums text-gray-800 dark:text-gray-100">
          {scoreLine(run.versions.map((v) => v.score))}
        </span>
      )}
      {thinking && (
        <div className="neu-inset flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
          <Spinner className="h-4 w-4" />
          <span>
            <span className="font-semibold">{thinking.model}</span> is reviewing the failures of V{thinking.v} ·{" "}
            <span className="font-mono tabular-nums">{elapsed(thinking.since)}</span>
            <span className="text-gray-500 dark:text-gray-400"> · reasoning models can take several minutes; not stuck</span>
          </span>
        </div>
      )}
    </div>
  );
}

function RunsTab({ runs, selected, onSelect, follow, setFollow, dark, chain }) {
  const [fast, setFast] = useState(false);
  const { data: detail, error } = usePoll(selected ? `/api/runs/${selected}` : null, fast ? 1000 : 3000);
  const loaded = detail && detail.id === selected ? detail : null;
  // Join the run with the chain: chainRecord is set ONLY when an on-chain record matches its snapshot hash.
  const current = loaded && { ...loaded, chainRecord: chainMatch(loaded, chain), chainOk: chain ? !!chain.ok : null };
  const state = current ? runState(current, chain) : null;
  // Poll this run every second while it is still producing events.
  const wantFast = !!current && (isLive(current) || pipelineActive(current));
  if (wantFast !== fast) setFast(wantFast);
  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card
        title="Runs"
        right={
          <button
            role="switch"
            aria-checked={follow}
            onClick={() => setFollow(!follow)}
            className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
          >
            follow latest
            <span className="neu-inset relative h-5 w-9 rounded-full">
              <span
                className={`neu-raised-sm absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ${
                  follow ? "left-[18px] !bg-[var(--accent)]" : "left-0.5"
                }`}
              />
            </span>
          </button>
        }
        className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto"
      >
        <RunList runs={runs} selected={selected} onSelect={onSelect} chain={chain} />
      </Card>

      <div className="min-w-0 space-y-8">
        {!current ? (
          <Card>
            <Empty>{error || (selected ? "Loading run…" : "Pick a run on the left.")}</Empty>
          </Card>
        ) : (
          <>
            <Card>
              <RunHeader detail={current} state={state} />
            </Card>
            <Card title="Execution tree">
              <ExecTree detail={current} dark={dark} />
            </Card>
            {current.run?.memory_used?.length > 0 && (
              <Card title="Memory inherited from other agents (on-chain records + IPFS)">
                <MemoryUsed memory={current.run.memory_used} events={current.events} />
              </Card>
            )}
            <Card title="Versions: diff, critique, changelog">
              {current.run ? <DiffPanel key={current.id} run={current.run} dark={dark} /> : <Empty>Waiting for run.json…</Empty>}
            </Card>
            <Card title="Proof & on-chain verification">
              <ProofPanel detail={current} chain={chain} runs={runs} onOpen={onSelect} />
            </Card>
            <Card title="Live event log (events.jsonl)">
              <EventLog key={current.id} events={current.events} live={isLive(current) || pipelineActive(current)} />
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
  // No hash: land on the Overview, unless a ?run=<id> link asks for a specific run.
  const hasRunLink = useSyncExternalStore(subscribeHash, () => new URLSearchParams(window.location.search).has("run"), () => false);
  const tab = TABS.some(([k]) => k === hash) ? hash : hasRunLink ? "runs" : "overview";
  return [tab, (key) => (window.location.hash = key)];
}

export default function Dashboard() {
  const [dark, toggleTheme] = useTheme();
  const [tab, setTab] = useTab();
  // ?run=<id> opens that run with "follow latest" off (bookmarkable); null = not touched by the user yet.
  const urlRun = useSyncExternalStore(subscribeHash, () => new URLSearchParams(window.location.search).get("run"), () => null);
  const [followChoice, setFollowChoice] = useState(null);
  const follow = followChoice ?? !urlRun;
  const setFollow = (on) => setFollowChoice(on);
  const [picked, setPicked] = useState(null);
  const { data: runsData, error: runsError } = usePoll("/api/runs");
  const { data: chain } = usePoll("/api/chain");
  const { data: extras } = usePoll("/api/extras");
  const { data: overview } = usePoll("/api/overview");

  const runs = runsData?.runs;
  // "Follow latest": always show the newest run, so a live run_all appears by itself during the demo.
  const selected = follow ? runs?.[0]?.id : picked || urlRun || runs?.[0]?.id;
  const onSelect = (id) => {
    setPicked(id);
    setFollow(false);
  };

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8 md:px-8">
      <header className="mb-8 flex flex-wrap items-center gap-4 md:gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-800 md:text-3xl dark:text-gray-100">AutoEvolve Protocol</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Self-improving code agents · ZK-proven improvement · on-chain memory
          </p>
        </div>
        <nav className="neu-inset flex flex-wrap gap-1.5 rounded-2xl p-1.5">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                tab === key
                  ? "neu-raised-sm text-[var(--ink-violet)]"
                  : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
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
          <Badge tone={runsError ? "red" : "green"}>{runsError ? "disconnected" : "live · 3 s"}</Badge>
          <NeuButton onClick={toggleTheme} aria-label="Toggle light or dark mode" className="text-xs">
            {dark ? "☀ Light" : "☾ Dark"}
          </NeuButton>
        </div>
      </header>

      {tab === "overview" && <Overview
          overview={overview}
          chain={chain}
          setTab={setTab}
          openRun={(id) => {
            onSelect(id);
            setTab("runs");
          }}
        />}
      {tab === "runs" && (
        <RunsTab
          runs={runs}
          selected={selected}
          onSelect={onSelect}
          follow={follow}
          setFollow={setFollow}
          dark={dark}
          chain={chain}
        />
      )}
      {tab === "chain" && <ChainLog chain={chain} />}
      {tab === "bench" && <BenchmarkChart benchmark={extras?.benchmark} />}
      {tab === "cheats" && <CheatsTable cheats={extras?.cheats} events={extras?.cheat_events} />}

      <footer className="mt-10 text-center text-xs text-gray-400">
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
