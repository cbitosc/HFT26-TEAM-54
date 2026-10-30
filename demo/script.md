# Demo script (7 minutes)

Before going on stage:
- Demo laptop (P3): `.env` filled, wallets funded, `cd dashboard && npm run dev` running, browser open at http://localhost:3000, light mode, zoom 110 %.
- Tabs pre-opened: dashboard `#runs`, Etherscan registry page, the backup run's IPFS link.
- Terminal with large font, in the repo root, `python -m pipeline.run_all --task 1 --agent A` typed but NOT run yet.
- Backup run saved in `backup/` (appears in the run list with an orange "backup" tag).

| Time | Who | Say / do |
|---|---|---|
| 0:00-0:30 | Speaker | **Problem.** "AI agents claim they got better. Today you have to trust them: the scores, the tests, the prompt. And every agent learns alone; nobody can reuse another agent's lessons safely." |
| 0:30-1:45 | Speaker + driver | **Live run.** Press Enter on `run_all`. Switch to the dashboard: "follow latest" picks the new run. "Agent A, a Qwen coding model, writes V1. Our evaluator runs hidden tests in a sandbox. Code computes the score, never an LLM." Point at the V1 box turning green with its score. "A different model, DeepSeek-R1, critiques the failures..." If V2 has not appeared after ~60 s: **click the backup run** and say "here is the same run from this morning". |
| 1:45-2:30 | Speaker | **Diffs.** Versions panel: click V1 → V2. "This yellow box is the critic's feedback; here is exactly what changed; the changelog says which hidden tests got fixed. Every version must score strictly higher." Point at a red retry branch if there is one: "this attempt did not beat the previous score, so it was rejected and retried." |
| 2:30-3:30 | Speaker | **Proof + reward.** Proof panel: green "Verified on-chain". "This ZK proof shows the metrics are in range, the score uses our fixed weights, S1 < S2 < S3, and that we know the secret system prompt, without revealing it." Point at the 16 labelled public signals. Click the transaction link → Etherscan: "the contract checked the proof and the evaluator's signature, and paid Agent A 0.001 ETH automatically." |
| 3:30-4:00 | Speaker | **IPFS.** Click the IPFS link: "the full run, code, diffs, critiques and lessons, but no secrets, is public. Its hash is stored on-chain, so nobody can change it later." |
| 4:00-5:00 | Speaker | **Agent B.** Click the newest Agent B run (purple "memory" tag). "Agent B is a different wallet with no access to Agent A's files. It read the contract, downloaded past runs from IPFS, checked their hash, and injected the lessons." Point at the INJECTING LESSON lines. Open the `#bench` tab: "Its first draft is better with verified memory than without, on tasks it has never seen." Say the number on screen. If the badge says "mock LLM", say so. |
| 5:00-5:45 | Speaker | **Cheats.** `#cheats` tab: "We attacked our own contract 5 ways: tampered metrics, a stolen proof, a replay, a fake evaluator signature, a proof for the wrong task. All 5 rejected, each with the exact reason." |
| 5:45-6:30 | Speaker | **Trust model slide.** Proven: metrics in range, fixed weights, strictly improving, secret prompt known. Signed: metrics came from the evaluator, not the agent. Contract: proof + signature + memory hash checked, no replays, automatic payment. NOT guaranteed: that the LLM or the evaluator is honest; tests are sandboxed but not proven in ZK. Future: TEE / zkVM, several evaluators. |
| 6:30-7:00 | Speaker | **Close.** "Who uses this: agent marketplaces that pay per verified improvement, teams who want to share agent lessons without sharing prompts, and anyone auditing AI claims. Every step you saw today is public and checkable. Thank you." |

## If something breaks
- Testnet slow or down: show the backup run (it has a real tx link) and say "the live transaction is still pending".
- Dashboard down: terminal output + Etherscan + IPFS link (PLAN.md fallback).
- Chain badge says "chain offline": check `dashboard/.env.local` (CHAIN, RPC_URL) and that `schemas/deployments.<CHAIN>.json` exists.
