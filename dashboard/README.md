# AutoEvolve dashboard (P4)

Live developer view of the protocol: runs, execution tree, diffs, proof, on-chain memory, benchmark, cheats.
Next.js (App Router) + Tailwind. It only READS files from the repo; it never writes anything.

## Run it (from the repo root)

```
cd dashboard
npm install          # first time only
npm run dev          # http://localhost:3000
```

Node 20+ is needed. On a Windows laptop without Node, a portable Node works (no admin):
download `node-v24.x-win-x64.zip` from nodejs.org, unzip it, and put that folder on PATH.

## Chain settings: dashboard/.env.local (never committed)

```
CHAIN=sepolia          # sepolia | basesepolia | local (same as the root .env)
RPC_URL=https://...    # public RPC URL only; NO private keys here
```

Without this file the dashboard uses CHAIN=local and http://127.0.0.1:8545 (Anvil).
Addresses come from `schemas/deployments.<CHAIN>.json` (P3); nothing is hardcoded.

## What it reads

| API route | Reads |
|---|---|
| `/api/runs` | every folder in `runs/` and `backup/` (falls back to `schemas/examples/` if there are none) |
| `/api/runs/<run_id>` | `run.json`, `evaluator.json`, `proof.json`, `receipt.json`, `events.jsonl` |
| `/api/chain` | `recordCount()` + `getRecord(i)` on the registry, escrow balance, `ImprovementVerified` tx hashes |
| `/api/extras` | `runs/benchmark.json` (P1) and `runs/cheats.json` (P2) |

Every panel polls every 3 seconds. Tabs can be bookmarked: `#runs`, `#chain`, `#bench`, `#cheats`.
"Follow latest" (on by default) jumps to the newest run, so a live `run_all` appears by itself.
