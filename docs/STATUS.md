# STATUS (updated by P3 at each checkpoint)

## Current
| Person | Done | Blocked | Next |
|---|---|---|---|
| P1 | tasks 1-4 frozen; Agent A task 1; Agent B task 3 (0 -> 7940 -> 9100, used record #0's lessons); honest benchmark | | rehearsal support |
| P2 | circuit, real verifier, prove.js, sign.py, cheat_demo.js (5/5 rejected on Sepolia) | | rehearsal support |
| P3 | contract (24 Foundry tests), Sepolia deploy, ipfs/submit/run_all, records #0 and #1 on-chain | | README, final cheat run, Anvil fallback test |
| P4 | dashboard (runs, tree, diffs, proof, chain log, cheats), demo script | | benchmark panel with Agent B, rehearsal |

## Decisions
- Chain: **Sepolia (11155111)**. Anvil (local) stays as the fallback (`CHAIN=local`, `bash pipeline/deploy.sh 1`).
- Evaluator signature is ON (evaluator = 0xeC9D569DE0e5e7F671396a2B95200EC722fbb5D0, not address(0)).
- Critic model: deepseek-ai/DeepSeek-R1-0528.
- Testnet deploys use pipeline/deploy_web3.py (node gas estimates): forge's gas simulation does not match Sepolia's current gas schedule.

## Links
- Registry: https://sepolia.etherscan.io/address/0xF97417eccD3ab2Db4F9787Aba3b4713e082d61D9
- Verifier: https://sepolia.etherscan.io/address/0xC3add50f96616Ca68bC93FD7ddaEA280c6DaEf3c
- Record #0 (Agent A, task 1, 4150 -> 8950 -> 9100, 0.001 ETH paid):
  https://sepolia.etherscan.io/tx/0xc99167cc2d72cd2192749afc818cd1d6786c76b5cd723b74a9c165a23871c5f1
- Record #0 memory (run.json on IPFS): CID bafkreidqcreyvopzy4avc6me5ehgxpswjdpjtqhuldebunhrsbxotnk3km
  https://ipfs.io/ipfs/bafkreidqcreyvopzy4avc6me5ehgxpswjdpjtqhuldebunhrsbxotnk3km
- Record #1 (Agent B, task 3, 0 -> 7940 -> 9100, 0.001 ETH paid; used 3 lessons from record #0):
  https://sepolia.etherscan.io/tx/0x5b6812d07cdd676a89df14e507671cd15e16bed05d18fd8329e0a517b0d78559
- Record #1 memory (run.json on IPFS): CID bafkreieyly5jei37m24boalkv3xe2e7qxt43hyiapqyauk4ybs5tfijgbi
  https://ipfs.io/ipfs/bafkreieyly5jei37m24boalkv3xe2e7qxt43hyiapqyauk4ybs5tfijgbi
- Backup of the public files: backup/t1-20261030-213353-A/, backup/t3-20261030-231945-B/ and backup/cheats.*
- Honest limits: tasks 2 and 4 with memory start so high that V1 < V2 < V3 cannot be satisfied (task 4 run ended
  failed_no_improvement and was not submitted); the benchmark is n=1 per task and average V1 went down with memory.

## Checkpoint log
- CP1 (12:00 AM): skeleton, common/, wallets, toy verifier verified on Anvil (late, ~1 AM).
- CP2 (3:00 AM): contract + tests, real verifier + fixture, Sepolia deploy, pipeline modules.
- CP3 (6:00 AM): END-TO-END on Sepolia done early: record #0, reward paid, IPFS re-hash matches, cheats 5/5 rejected.
- CP4 (9:00 AM):
- Final (11:30 AM):
