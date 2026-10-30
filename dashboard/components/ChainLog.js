"use client";
// On-chain memory log: every Record in AutoEvolveRegistry (recordCount + getRecord).
import { Badge, Card, Empty, ExtLink, short } from "@/components/ui";

export default function ChainLog({ chain }) {
  if (!chain) return <Empty>Reading the contract…</Empty>;
  if (!chain.ok)
    return (
      <Card title="On-chain memory log">
        <Empty>
          Chain not reachable ({chain.chain}): {chain.error}
        </Empty>
      </Card>
    );
  const ex = chain.explorer;
  return (
    <Card
      title="On-chain memory log"
      right={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="blue">
            {chain.chain} · {chain.chain_id}
          </Badge>
          <span>
            Registry{" "}
            <ExtLink href={ex ? `${ex}/address/${chain.registry}` : null}>{short(chain.registry, 6, 4)}</ExtLink>
          </span>
          <span>escrow {Number(chain.escrow_eth).toFixed(4)} ETH</span>
        </div>
      }
    >
      {!chain.records.length ? (
        <Empty>No verified records yet. The first successful submit() will appear here.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Record</th>
                <th className="py-1.5 pr-3 font-medium">Task</th>
                <th className="py-1.5 pr-3 font-medium">Agent</th>
                <th className="py-1.5 pr-3 font-medium">Scores S1 → S2 → S3</th>
                <th className="py-1.5 pr-3 font-medium">IPFS CID</th>
                <th className="py-1.5 pr-3 font-medium">Time</th>
                <th className="py-1.5 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {chain.records.map((r) => (
                <tr key={r.record_id}>
                  <td className="py-1.5 pr-3 font-semibold">#{r.record_id}</td>
                  <td className="py-1.5 pr-3">{r.task_id}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    <ExtLink href={ex ? `${ex}/address/${r.agent}` : null}>{short(r.agent, 6, 4)}</ExtLink>
                  </td>
                  <td className="py-1.5 pr-3 font-mono tabular-nums">{r.scores.join(" → ")}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    <ExtLink href={`https://ipfs.io/ipfs/${r.cid}`}>{short(r.cid, 10, 6)}</ExtLink>
                  </td>
                  <td className="py-1.5 pr-3 text-xs">{new Date(r.timestamp * 1000).toLocaleTimeString()}</td>
                  <td className="py-1.5 font-mono text-xs">
                    {r.tx_hash ? <ExtLink href={ex ? `${ex}/tx/${r.tx_hash}` : null}>{short(r.tx_hash, 6, 4)}</ExtLink> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
