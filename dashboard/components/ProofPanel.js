"use client";
// Proof panel. "Verified on-chain" is shown ONLY when an on-chain record matches this run's own
// snapshot_hash (detail.chainRecord, see lib/model.js chainMatch). The tx link and reward come from
// that chain record, never from a local receipt.json. Any other run gets a neutral "not submitted" card.
import { Empty, ExtLink, NeuButton, short, weiToEth } from "@/components/ui";
import { signalLabels, walletFromSignal, scoreOf, pipelineErrors, chainMatch } from "@/lib/model";

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

function Verdict({ icon, ink, children }) {
  return (
    <span className="neu-raised inline-flex items-center gap-3 rounded-xl py-2 pl-2 pr-4 text-base font-bold text-gray-800 dark:text-gray-100">
      <span className="neu-inset flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ color: ink }}>
        {icon}
      </span>
      {children}
    </span>
  );
}

const ipfsUrl = (cid) => (cid ? `https://ipfs.io/ipfs/${cid}` : null);
const txUrl = (chain, tx) => (chain?.explorer && tx ? `${chain.explorer}/tx/${tx}` : null);

// The proof's checks + the 16 public signals (PLAN.md 3.5). Only rendered when proof.json exists for THIS run.
function ProofDetails({ proof, evaluator }) {
  const pub = proof?.pubSignals || [];
  const labels = signalLabels();
  const scores = pub.length === 16 ? [0, 1, 2].map((i) => scoreOf(pub.slice(i * 4, i * 4 + 4))) : null;
  const signed = evaluator?.metrics?.flat().map(String);
  const sameAsSigned = signed && pub.length === 16 && signed.every((m, i) => m === String(pub[i]));
  return (
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
      {evaluator && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Signed by evaluator <span className="font-mono">{short(evaluator.evaluator_address, 8, 6)}</span> · signature{" "}
          <span className="font-mono">{short(evaluator.signature, 10, 8)}</span> · test suite{" "}
          <span className="font-mono">{short(evaluator.test_suite_hash, 10, 6)}</span>
        </p>
      )}
    </>
  );
}

function Verified({ detail, chain }) {
  const rec = detail.chainRecord;
  const receipt = detail.receipt?.tx_hash && detail.receipt.tx_hash === rec.tx_hash ? detail.receipt : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Verdict icon="✓" ink="var(--ink-teal)">
          Verified on-chain
        </Verdict>
        {rec.tx_hash && <ExtLink href={txUrl(chain, rec.tx_hash)}>Transaction {short(rec.tx_hash, 8, 6)} ↗</ExtLink>}
        <ExtLink href={ipfsUrl(rec.cid)}>IPFS {short(rec.cid, 10, 6)} ↗</ExtLink>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Record</dt>
          <dd className="font-semibold">#{rec.record_id}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Block</dt>
          <dd className="font-semibold tabular-nums">{receipt?.block ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Reward paid</dt>
          <dd className="font-semibold text-[var(--ink-teal)]">{weiToEth(chain.reward_wei)}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Chain id</dt>
          <dd className="font-semibold tabular-nums">{chain.chain_id}</dd>
        </div>
      </dl>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Matched by snapshot hash: the hash of this run&apos;s run.json equals record #{rec.record_id}&apos;s on-chain
        snapshotHash <span className="font-mono">{short(rec.snapshot_hash, 10, 8)}</span>.
      </p>
      {detail.proof ? (
        <ProofDetails proof={detail.proof} evaluator={detail.evaluator} />
      ) : (
        <Empty>proof.json for this run is not on this laptop; the record above is read from the chain.</Empty>
      )}
    </div>
  );
}

// Neutral card for every run that has no matching on-chain record.
function NotSubmitted({ detail, chain, runs, onOpen }) {
  const err = pipelineErrors(detail).pop();
  const reason = err && REVERTS.find((r) => err.msg?.includes(r));
  let why = null;
  if (detail.phase === "live") why = "The agent is still running.";
  else if (detail.run && detail.run.status !== "improved") why = "It did not improve, so there is nothing to prove.";
  else if (detail.has_receipt)
    why =
      chain?.ok === false
        ? "A receipt.json exists, but the chain is offline, so it cannot be checked."
        : "A receipt.json exists, but no on-chain record matches this run's snapshot hash, so it is not shown as verified.";

  const newest = chain?.ok ? chain.records[0] : null;
  const local = newest && runs?.find((r) => chainMatch(r, { ok: true, records: [newest] }));

  return (
    <div className="space-y-6">
      <div className="neu-inset rounded-xl px-5 py-4">
        <div className="text-base font-semibold text-gray-800 dark:text-gray-100">This run has not been submitted.</div>
        {why && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{why}</p>}
        {reason && (
          <p className="mt-1 text-sm text-[var(--ink-red)]">
            The last submit attempt was rejected: <span className="font-mono font-semibold">{reason}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
          {newest ? (
            <>
              <span>
                Example of a verified run: <span className="font-semibold">record #{newest.record_id}</span> (task{" "}
                {newest.task_id}, {newest.scores.join(" → ")})
              </span>
              {newest.tx_hash && <ExtLink href={txUrl(chain, newest.tx_hash)}>on Etherscan ↗</ExtLink>}
              {local && local.id !== detail.id && (
                <NeuButton className="text-xs" onClick={() => onOpen?.(local.id)}>
                  Open record #{newest.record_id} here
                </NeuButton>
              )}
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {chain?.ok ? "No verified records on-chain yet." : "Chain offline: cannot show a verified example."}
            </span>
          )}
        </div>
      </div>
      {detail.proof && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Local proof for this run (not on-chain)
          </h3>
          <ProofDetails proof={detail.proof} evaluator={detail.evaluator} />
        </div>
      )}
    </div>
  );
}

export default function ProofPanel({ detail, chain, runs, onOpen }) {
  if (detail.source === "example")
    return (
      <div className="space-y-6">
        <Verdict icon="!" ink="var(--ink-yellow)">
          EXAMPLE DATA: placeholder proof, no real transaction or reward
        </Verdict>
        {detail.proof && <ProofDetails proof={detail.proof} evaluator={detail.evaluator} />}
      </div>
    );
  if (detail.chainRecord) return <Verified detail={detail} chain={chain} />;
  return <NotSubmitted detail={detail} chain={chain} runs={runs} onOpen={onOpen} />;
}
