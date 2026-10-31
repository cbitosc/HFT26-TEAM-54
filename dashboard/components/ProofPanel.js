"use client";
// Proof panel: verdict badge, the 16 public signals labelled per PLAN.md 3.5, evaluator signature, tx + IPFS links.
import { Badge, Empty, ExtLink, short, weiToEth } from "@/components/ui";
import { signalLabels, walletFromSignal, scoreOf, pipelineErrors } from "@/lib/model";

const VERDICT_INK = {
  green: "var(--ink-teal)",
  red: "var(--ink-red)",
  amber: "var(--ink-yellow)",
  blue: "var(--ink-violet)",
  gray: "var(--neu-dark)",
};

const REVERTS = [
  "UNKNOWN_TASK",
  "TASK_MISMATCH",
  "NOT_AGENT",
  "ALREADY_CLAIMED",
  "BAD_PROOF",
  "BAD_EVALUATOR_SIG",
  "ESCROW_EMPTY",
  "PAY_FAILED",
];

function verdict(detail) {
  if (detail.source === "example")
    return { tone: "amber", text: "EXAMPLE DATA: placeholder proof, no real transaction or reward" };
  if (detail.receipt) return { tone: "green", text: "Verified on-chain" };
  if (detail.run && detail.run.status !== "improved")
    return { tone: "gray", text: "Not submitted: the run did not improve, so there is nothing to prove" };
  const err = pipelineErrors(detail).pop();
  if (err) {
    const reason = REVERTS.find((r) => err.msg?.includes(r));
    return { tone: "red", text: reason ? `Rejected: ${reason}` : "Rejected", detail: err.msg };
  }
  if (detail.proof?.verified_locally) return { tone: "blue", text: "Proof verified locally, not yet on-chain" };
  if (detail.proof) return { tone: "amber", text: "Proof generated" };
  return { tone: "gray", text: "No proof yet" };
}

function Check({ ok, children }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="font-bold" style={{ color: ok ? "var(--ink-teal)" : "var(--ink-red)" }}>
        {ok ? "✓" : "✗"}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function ProofPanel({ detail }) {
  const v = verdict(detail);
  const { proof, evaluator } = detail;
  const receipt = detail.source === "example" ? null : detail.receipt; // fake tx / reward: hide
  const pub = proof?.pubSignals || [];
  const labels = signalLabels();

  const scores = pub.length === 16 ? [0, 1, 2].map((i) => scoreOf(pub.slice(i * 4, i * 4 + 4))) : null;
  const signed = evaluator?.metrics?.flat().map(String);
  const sameAsSigned = signed && pub.length === 16 && signed.every((m, i) => m === String(pub[i]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="neu-raised inline-flex items-center gap-3 rounded-xl py-2 pl-2 pr-4 text-base font-bold text-gray-800 dark:text-gray-100">
          <span
            className="neu-inset flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ color: VERDICT_INK[v.tone] }}
          >
            {{ green: "✓", red: "✗", amber: "!", blue: "◆", gray: "·" }[v.tone]}
          </span>
          {v.text}
        </span>
        {receipt && (
          <>
            <ExtLink href={receipt.explorer_tx_url}>Transaction {short(receipt.tx_hash, 8, 6)} ↗</ExtLink>
            <ExtLink href={receipt.ipfs_url}>IPFS {short(receipt.cid, 10, 6)} ↗</ExtLink>
          </>
        )}
      </div>
      {v.detail && <pre className="whitespace-pre-wrap text-xs text-[var(--ink-red)]">{v.detail}</pre>}

      {receipt && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Record</dt>
            <dd className="font-semibold">#{receipt.record_id}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Block</dt>
            <dd className="font-semibold tabular-nums">{receipt.block}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Reward paid</dt>
            <dd className="font-semibold text-[var(--ink-teal)]">{weiToEth(receipt.reward_wei)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Chain id</dt>
            <dd className="font-semibold tabular-nums">{receipt.chain_id}</dd>
          </div>
        </dl>
      )}

      {!proof ? (
        <Empty>proof.json appears after `node zk/prove.js runs/&lt;id&gt;`.</Empty>
      ) : (
        <>
          <ul className="space-y-1">
            {scores && (
              <Check ok={scores[0] < scores[1] && scores[1] < scores[2]}>
                Scores rebuilt from the public signals with fixed weights [50, 20, 15, 15]:{" "}
                <span className="font-mono">
                  {scores[0]} &lt; {scores[1]} &lt; {scores[2]}
                </span>
              </Check>
            )}
            {signed && (
              <Check ok={sameAsSigned}>
                Metrics in the proof {sameAsSigned ? "match" : "DO NOT match"} the metrics the evaluator signed
              </Check>
            )}
            <Check ok={!!proof.prompt_commitment}>
              Secret system prompt hidden behind commitment{" "}
              <span className="font-mono">{short(proof.prompt_commitment, 10, 6)}</span>
            </Check>
          </ul>

          <div className="neu-inset overflow-hidden rounded-xl p-3">
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-200">
              <thead className="text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Public signal</th>
                  <th className="px-2 py-1.5 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {pub.map((val, i) => {
                  const shown = i === 14 ? walletFromSignal(val) : val;
                  return (
                    <tr key={i} className={i % 4 === 0 && i > 0 ? "[&>td]:pt-3" : ""}>
                      <td className="px-2 py-1 tabular-nums text-gray-400">{i}</td>
                      <td className="px-2 py-1">{labels[i]}</td>
                      <td className="px-2 py-1 font-mono" title={String(val)}>
                        {i < 12 || i === 15 ? shown : short(shown, 10, 8)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {evaluator && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Signed by evaluator <span className="font-mono">{short(evaluator.evaluator_address, 8, 6)}</span> · signature{" "}
          <span className="font-mono">{short(evaluator.signature, 10, 8)}</span> · test suite{" "}
          <span className="font-mono">{short(evaluator.test_suite_hash, 10, 6)}</span>
        </p>
      )}
    </div>
  );
}
