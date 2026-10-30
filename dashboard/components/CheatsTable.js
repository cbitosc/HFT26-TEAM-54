"use client";
// Cheat demo: each attack against the contract and the revert it got (runs/cheats.json from P2).
import { Badge, Card, Empty } from "@/components/ui";

// cheats.json is not frozen yet, so accept a few shapes: [..], {attacks: [..]} or {results: [..]}.
function rows(cheats) {
  const list = Array.isArray(cheats) ? cheats : cheats?.attacks || cheats?.results || cheats?.cheats || [];
  return list.map((c) => ({
    name: c.name || c.attack || c.id,
    description: c.description || c.desc || "",
    expected: c.expected || c.expected_revert || "",
    actual: c.actual || c.revert || c.reason || c.result || "",
    rejected: c.rejected ?? c.blocked ?? (c.expected && c.actual ? c.actual.includes(c.expected) : undefined),
  }));
}

export default function CheatsTable({ cheats }) {
  const list = rows(cheats);
  const all = list.length > 0 && list.every((r) => r.rejected);
  return (
    <Card
      title="Cheat attempts"
      right={list.length > 0 && <Badge tone={all ? "green" : "red"}>{all ? `all ${list.length} rejected` : "some attacks passed!"}</Badge>}
    >
      {!list.length ? (
        <Empty>runs/cheats.json not found yet (P2: node zk/cheat_demo.js).</Empty>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Attack</th>
              <th className="py-1.5 pr-3 font-medium">What the cheater tried</th>
              <th className="py-1.5 pr-3 font-medium">Expected</th>
              <th className="py-1.5 pr-3 font-medium">Contract said</th>
              <th className="py-1.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {list.map((r, i) => (
              <tr key={i}>
                <td className="py-2 pr-3 font-medium">{r.name}</td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{r.description}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.expected}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.actual}</td>
                <td className="py-2">
                  {r.rejected ? <Badge tone="green">✓ rejected</Badge> : <Badge tone="red">✗ accepted</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
