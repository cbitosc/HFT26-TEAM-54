"use client";
// Cheat demo: each attack and what stopped it (runs/cheats.json + runs/cheats.events.jsonl from P2's zk/cheat_demo.js).
// Format: { attacks: [{ name, description, expected, actual, rejected }], all_rejected }
// rejected = (actual === expected): stopped, and for the reason we predicted.
import { Badge, Card, Empty } from "@/components/ui";
import { EventLog } from "@/components/EventLog";

// Who stopped the attack: the prover (no valid proof exists) or the contract (a revert string).
function stoppedBy(actual) {
  if (!actual) return "";
  if (actual.startsWith("CANNOT PROVE")) return "prover: no valid proof exists";
  if (/^[A-Z_]+$/.test(actual) && actual !== "NO_REVERT") return "contract revert";
  return "";
}

function Result({ attack }) {
  if (attack.rejected) return <Badge tone="green">✓ rejected</Badge>;
  // Not rejected as expected: either it went through, or it failed for some other reason.
  if (!attack.actual || attack.actual === "NO_REVERT") return <Badge tone="red">✗ accepted</Badge>;
  return <Badge tone="amber">✗ wrong reason</Badge>;
}

export default function CheatsTable({ cheats, events = [] }) {
  const list = cheats?.attacks || [];
  const all = cheats?.all_rejected ?? (list.length > 0 && list.every((a) => a.rejected));
  return (
    <div className="space-y-8">
      <Card
        title="Cheat attempts"
        right={
          list.length > 0 && (
            <Badge tone={all ? "green" : "red"}>{all ? `all ${list.length} rejected` : "not all rejected!"}</Badge>
          )
        }
      >
        {!list.length ? (
          <Empty>runs/cheats.json not found yet (P2: node zk/cheat_demo.js).</Empty>
        ) : (
          <div className="neu-inset overflow-x-auto rounded-xl p-3">
            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-200">
              <thead className="text-xs text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Attack</th>
                  <th className="py-1.5 pr-3 font-medium">What the cheater tried</th>
                  <th className="py-1.5 pr-3 font-medium">Expected</th>
                  <th className="py-1.5 pr-3 font-medium">Stopped by</th>
                  <th className="py-1.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.name} className="align-top">
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold">{a.name}</td>
                    <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-300">{a.description}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs">{a.expected}</td>
                    <td className="py-2.5 pr-3">
                      <div className="whitespace-nowrap font-mono text-xs">{a.actual}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{stoppedBy(a.actual)}</div>
                    </td>
                    <td className="py-2.5">
                      <Result attack={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {events.length > 0 && (
        <Card title="Cheat events (runs/cheats.events.jsonl)">
          <EventLog events={events} />
        </Card>
      )}
    </div>
  );
}
