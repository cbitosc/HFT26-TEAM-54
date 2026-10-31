"use client";
// Overview tab: the three things a judge should see first. Every value comes from /api/overview
// (cheats.json, run.json, events.jsonl) or /api/chain. Nothing is hard-coded; each card has an empty state.
import { Badge, Empty, ExtLink, NeuButton, short, weiToEth } from "@/components/ui";

const ipfsUrl = (cid) => (cid && !cid.startsWith("bafy-mock") ? `https://ipfs.io/ipfs/${cid}` : null);
const when = (ms) => (ms ? new Date(ms).toLocaleString() : "");

function OverviewCard({ title, children, source, onDetails }) {
  return (
    <section className="neu-card flex flex-col p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h2>
      <div className="mt-4 flex-1 space-y-4">{children}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold">Data source:</span> {source}
        </p>
        {onDetails && (
          <NeuButton className="text-xs" onClick={onDetails}>
            See details →
          </NeuButton>
        )}
      </div>
    </section>
  );
}

function Big({ children, ink }) {
  return (
    <div className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100" style={ink ? { color: ink } : undefined}>
      {children}
    </div>
  );
}

// ---------- Card 1: attacks the contract refused (cheats.json) ----------
function AttacksCard({ cheats, onDetails }) {
  const data = cheats?.data;
  const attacks = data?.attacks || [];
  if (!data || !attacks.length)
    return (
      <OverviewCard title="Attacks the contract refused" source="runs/cheats.json or backup/cheats.json (not found)">
        <Empty>No cheat run found</Empty>
      </OverviewCard>
    );
  const rejected = attacks.filter((a) => a.rejected).length;
  const lastEvent = cheats.events?.length ? cheats.events[cheats.events.length - 1] : null;
  const ranAt = lastEvent?.ts ? `run at ${when(Date.parse(lastEvent.ts))}` : `file saved ${when(cheats.file_updated)}`;
  const where = cheats.source === "runs" ? "live runs/cheats.json" : "backup/cheats.json (saved copy)";
  return (
    <OverviewCard title="Attacks the contract refused" source={`${where} · ${ranAt}`} onDetails={onDetails}>
      <Big ink={rejected === attacks.length ? "var(--ink-teal)" : "var(--ink-red)"}>
        {rejected} of {attacks.length} attacks rejected
      </Big>
      <ul className="space-y-2 text-sm">
        {attacks.map((a) => {
          const prover = (a.actual || "").startsWith("CANNOT PROVE");
          const highlight = a.name === "invented_metrics" && a.rejected;
          return (
            <li
              key={a.name}
              className={`relative rounded-xl px-3 py-2 ${highlight ? "neu-raised pl-5" : "neu-inset"}`}
            >
              {highlight && <span className="absolute inset-y-2 left-2 w-1 rounded-full bg-[var(--accent)]" />}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-100">{a.name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-xs">{a.actual || "—"}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {prover ? "prover refusal" : "contract revert"}
                  </span>
                  <span className="font-bold" style={{ color: a.rejected ? "var(--ink-teal)" : "var(--ink-red)" }}>
                    {a.rejected ? "✓" : "✗"}
                  </span>
                </span>
              </div>
              {highlight && (
                <p className="mt-1 text-xs font-medium text-[var(--ink-violet)]">
                  Valid proof, still rejected: the real evaluator never signed.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </OverviewCard>
  );
}

// ---------- Card 2: memory verified between agents (run.json memory_used + events.jsonl) ----------
function MemoryCard({ memoryRuns, onOpenRun }) {
  const run = memoryRuns?.[0];
  if (!run)
    return (
      <OverviewCard title="Memory verified between agents" source="run.json memory_used in runs/ and backup/">
        <Empty>No run has used on-chain memory yet.</Empty>
      </OverviewCard>
    );
  const lessons = run.memory_used.flatMap((m) => m.lessons_used || []);
  const where = run.source === "runs" ? "live runs/" : `${run.source}/`;
  return (
    <OverviewCard
      title="Memory verified between agents"
      source={`${where}${run.id}: run.json memory_used + events.jsonl`}
      onDetails={() => onOpenRun(run.id)}
    >
      <Big>{lessons.length} lessons injected</Big>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Read by <span className="font-semibold">Agent {run.agent}</span>{" "}
        <span className="font-mono text-xs">{short(run.agent_wallet, 6, 4)}</span>
        {run.task_id != null && <> on task {run.task_id}</>}, newest run {run.id}
      </p>
      <ul className="space-y-2 text-sm">
        {run.memory_used.map((m) => {
          const ev = run.verification_events?.[String(m.record_id)];
          return (
            <li key={m.record_id} className="neu-inset rounded-xl px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  From <span className="font-semibold">record #{m.record_id}</span> · CID{" "}
                  <span className="font-mono text-xs">
                    <ExtLink href={ipfsUrl(m.cid)}>{short(m.cid, 10, 6)}</ExtLink>
                  </span>{" "}
                  · {(m.lessons_used || []).length} lessons
                </span>
                {ev ? (
                  <Badge tone="green" title={ev.msg}>
                    ✓ VERIFIED
                  </Badge>
                ) : (
                  <Badge tone="gray" title="memory_used is in run.json, but no verification event is in events.jsonl">
                    memory used, verification not recorded
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {lessons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-gray-700 dark:text-gray-200">
          {lessons.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

// ---------- Card 3: real contract, real payment (/api/chain) ----------
function ChainCard({ chain, onDetails }) {
  if (!chain)
    return (
      <OverviewCard title="Real contract, real payment" source="/api/chain">
        <Empty>Reading the contract…</Empty>
      </OverviewCard>
    );
  if (!chain.ok)
    return (
      <OverviewCard title="Real contract, real payment" source={`/api/chain (${chain.chain})`} onDetails={onDetails}>
        <Big ink="var(--ink-red)">Chain offline</Big>
        <p className="break-words text-sm text-gray-600 dark:text-gray-300">{chain.error}</p>
      </OverviewCard>
    );
  const ex = chain.explorer || null;
  const registryUrl = ex ? `${ex}/address/${chain.registry}` : null;
  const newest = chain.records?.[0];
  return (
    <OverviewCard
      title="Real contract, real payment"
      source={`${chain.chain} contract, read live through the RPC (no keys)`}
      onDetails={onDetails}
    >
      <Big ink="var(--ink-teal)">
        {chain.record_count} verified record{chain.record_count === 1 ? "" : "s"}
      </Big>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Chain</dt>
          <dd className="font-semibold">
            {chain.chain} · {chain.chain_id}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Registry</dt>
          <dd className="font-mono text-xs">
            <ExtLink href={registryUrl}>{short(chain.registry, 6, 4)}</ExtLink>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Escrow balance</dt>
          <dd className="font-semibold tabular-nums">{chain.escrow_eth} ETH</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">Reward per record</dt>
          <dd className="font-semibold tabular-nums text-[var(--ink-teal)]">
            {chain.reward_wei != null ? weiToEth(chain.reward_wei) : "—"}
          </dd>
        </div>
      </dl>
      {newest ? (
        <div className="neu-inset rounded-xl px-3 py-2 text-sm">
          <div className="text-xs text-gray-500 dark:text-gray-400">Newest record #{newest.record_id}</div>
          <div>
            Task {newest.task_id} · agent{" "}
            <span className="font-mono text-xs">
              <ExtLink href={ex ? `${ex}/address/${newest.agent}` : null}>{short(newest.agent, 6, 4)}</ExtLink>
            </span>
          </div>
          <div className="font-mono font-semibold tabular-nums">{newest.scores.join(" → ")}</div>
          <div className="mt-1 text-xs">
            {newest.tx_hash ? (
              <ExtLink href={ex ? `${ex}/tx/${newest.tx_hash}` : null}>Transaction {short(newest.tx_hash, 8, 6)} ↗</ExtLink>
            ) : (
              <ExtLink href={registryUrl}>Registry on explorer ↗</ExtLink>
            )}
          </div>
        </div>
      ) : (
        <Empty>No records on this contract yet.</Empty>
      )}
    </OverviewCard>
  );
}

export default function Overview({ overview, chain, setTab, openRun }) {
  return (
    <div className="space-y-8">
      <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
        Agents improve code, prove it in zero knowledge, get paid by a smart contract, and pass their lessons to
        other agents through on-chain records.
      </p>
      {!overview ? (
        <Empty>Loading…</Empty>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <AttacksCard cheats={overview.cheats} onDetails={() => setTab("cheats")} />
          <MemoryCard memoryRuns={overview.memory_runs} onOpenRun={openRun} />
          <ChainCard chain={chain} onDetails={() => setTab("chain")} />
        </div>
      )}
    </div>
  );
}
