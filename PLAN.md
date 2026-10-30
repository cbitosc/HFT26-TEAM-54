# PLAN.md: AutoEvolve Protocol (shared plan)
Every person AND every AI assistant reads this fully before writing code.

## 0. What we are building (simple version)
1. Agent A (Qwen2.5-Coder via Featherless) writes Python code for a task. This is V1.
2. The evaluator runs hidden tests in a sandbox and turns the results into 4 integer metrics (0-100). CODE computes the score, never an LLM.
3. A different model (DeepSeek-R1) reads the failures and writes a critique. Agent A revises to V2, then V3. Each version must score STRICTLY higher.
4. The evaluator (its own separate key) re-runs the tests and SIGNS the metrics.
5. A Circom ZK circuit proves: metrics are in range, scores use our fixed weights, S1 < S2 < S3, and we know the secret system prompt behind a public commitment (the prompt is never revealed).
6. run.json (code, diffs, critiques, lessons, NO secrets) is uploaded to IPFS, giving a CID.
7. The smart contract checks the proof, the evaluator signature and the memory commitment (snapshotHash), blocks replays, stores the CID publicly, and pays Agent A 0.001 test ETH.
8. Agent B (different wallet, NO access to Agent A's local files) reads the contract, downloads past runs from IPFS, verifies them, and injects their lessons, so it avoids Agent A's mistakes.
9. A dashboard shows all of this live.

## 1. People, laptops, folder ownership
Only edit folders you own. Need a change elsewhere? Message the owner.

| Person | Role | Owns |
|---|---|---|
| P1 | Agent engineer (Claude Code) | agent/ tasks/ evaluator/ docs/explain/p1.md |
| P2 | ZK + attestation engineer | zk/ attest/ docs/explain/p2.md |
| P3 | Integrator, contracts, repo owner | contracts/ pipeline/ common/ schemas/ backup/ docs/roles/ docs/STATUS.md PLAN.md CLAUDE.md README.md .gitignore .env.example requirements.txt |
| P4 | Dashboard, demo, pitch (no laptop; uses others' laptops during their naps) | dashboard/ demo/ docs/explain/p4.md |

Demo machine = P3's laptop. It holds all testnet keys and runs the final pipeline.
Windows users: install WSL2 Ubuntu and do EVERYTHING inside it (git, Python, Node, Claude Code).

## 2. Schedule (presentation at 3:00 PM)
| Time | What |
|---|---|
| 9:00-9:45 PM | Kickoff (all). P3 pushes repo skeleton by 9:30. Everyone clones, creates their branch, starts installs. |
| 9:45 PM-12:00 AM | Block 1 |
| 12:00 AM | Checkpoint 1 (15 min). Interfaces FROZEN. |
| 12:15-3:00 AM | Block 2. P4 sleeps. |
| 3:00 AM | Checkpoint 2. Circuit FROZEN. |
| 3:15-6:00 AM | Block 3. P2 sleeps 3:15-5:45; P4 codes dashboard on P2's laptop. |
| 6:00 AM | Checkpoint 3. END-TO-END on testnet. Tag demo-1. |
| 6:15-9:00 AM | Block 4. P3 sleeps 6:15-8:45; P4 codes on P3's laptop. |
| 9:00 AM | Checkpoint 4. FEATURE FREEZE. Tag demo-2. |
| 9:15-11:30 AM | Block 5 polish. P1 sleeps 9:15-11:15; P4 codes on P1's laptop. |
| 11:30 AM | CODE FREEZE. Tag final. |
| 11:30 AM-1:00 PM | Rehearsal 1. Fix ONLY demo-breaking bugs. |
| 1:00-2:00 PM | Rehearsal 2 + record backup video. |
| 2:00-3:00 PM | Eat, set up, buffer. |
| 3:00 PM | Present. |

### Checkpoint milestones
- CP1 (12:00 AM)
  - P1: tasks/t1 spec + tests; evaluate(code) returns 4 metrics; one real Featherless call per model.
  - P2: toy verifier deployed and verified by P3; real circuit compiles.
  - P3: repo; wallets funded (or Anvil); common/ helpers; schema examples.
  - P4: demo script v1; dashboard sketch; test ideas for tasks 2-4 sent to P1.
- CP2 (3:00 AM)
  - P1: full loop writes real run.json + secret.json + events.jsonl; agent/samples/run.sample.json committed.
  - P2: zk/out/ committed (wasm, final zkey, vkey, Verifier.sol, fixture); prove.js and attest/sign.py work.
  - P3: Registry passes all Foundry tests; deployed to testnet; ABI + deployments file in schemas/; Pinata upload works.
- CP3 (6:00 AM): `python -m pipeline.run_all --task 1 --agent A` works on testnet: CID on-chain, reward received. P4's dashboard shows run list, tree and diff.
- CP4 (9:00 AM): Agent B + runs/benchmark.json; cheat demo rejects all 5 attacks; dashboard has proof panel, on-chain log, benchmark, cheats; Anvil fallback works; backup run saved.

### Fallback rules (apply without debating)
- No real proof verified on testnet by 4:00 AM: do everything on local Anvil; keep trying testnet in the background.
- Evaluator signature not working by 5:00 AM: deploy with evaluator = address(0) (the contract skips the check). Say so honestly.
- R1 too slow or unavailable: switch the critic to a smaller reasoning model available on Featherless.
- Credits running low: use --mock-llm for all development; real calls only for demo runs.
- Dashboard not ready by 11:00 AM: demo with terminal + Etherscan + IPFS links.

### Cut order if behind
embeddings, then live polling (use refresh), then tasks 3-4, then evaluator signature.
NEVER cut: proof verified on-chain, CID on-chain, reward paid, Agent B reading memory.

## 3. FROZEN INTERFACES (only P3 may change; announce in group chat)

### 3.1 Constants
- METRICS order: [tests_passed, edge_cases, lint, simplicity], each an integer 0-100
- WEIGHTS: [50, 20, 15, 15]; SCORE = sum(w*m), range 0-10000
- P (BN254 field) = 21888242871839275222246405745257275088548364400416034343698204186575808495617
- Reward = 0.001 ETH (1000000000000000 wei). Escrow funded with 0.01-0.02 ETH.
- Chain: chosen by P3 by 10:30 PM (Sepolia 11155111 or Base Sepolia 84532). Local fallback: Anvil 31337. NEVER hardcode chain or addresses; read schemas/deployments.<CHAIN>.json, where CHAIN comes from .env (sepolia | basesepolia | local).
- Tasks: 1 = Agent A demo task; 2, 3, 4 = Agent B benchmark tasks. All are family "log_parsing".
- Models (Featherless ids): generator = Qwen/Qwen2.5-Coder-32B-Instruct; critic = deepseek-ai/DeepSeek-R1-0528 (plain DeepSeek-R1 is not on Featherless).
- schemas/addresses.json keys: deployer, agent_A, agent_B, evaluator. schemas/deployments.<CHAIN>.json keys: chain, chain_id, registry, verifier, evaluator, deploy_block, reward_wei, explorer. Read them via common/config.py (addresses(), load_deployment()).

### 3.2 Hashing rules (common/hashing.py from P3 implements these; everyone imports it)
- canonical_bytes(obj) = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
- keccak = Ethereum Keccak-256 (eth_utils.keccak in Python, ethers.keccak256 in JS). NEVER hashlib.sha3_256 (it gives different results).
- to_field(h) = int.from_bytes(h, "big") % P
- run.json is written ONCE by the agent as canonical_bytes. Nobody re-saves or reformats it. Upload the exact file bytes.
- snapshot_hash = to_field(keccak(raw bytes of run.json))
- prompt_hash = to_field(keccak(system prompt UTF-8 bytes))
- salt = secrets.randbelow(P - 1) + 1
- code_hash = "0x" + keccak(code UTF-8).hex()
- test_suite_hash = "0x" + keccak(raw bytes of tasks/t<id>/tests.json).hex()   (bytes32; not in the circuit)
- prompt_commitment = Poseidon(prompt_hash, salt), computed ONLY in JS (circomlibjs) by zk/prove.js

### 3.3 Run folder: runs/<run_id>/   (runs/ is gitignored)
run_id = t<task>-<YYYYMMDD-HHMMSS>-<A|B>, e.g. t1-20261031-021500-A

run.json: PUBLIC, written by P1. Example:
```json
{
  "schema_version": "1.0",
  "run_id": "t1-20261031-021500-A",
  "task_id": 1,
  "task_family": "log_parsing",
  "agent": "A",
  "agent_wallet": "0x...",
  "models": {"generator": "Qwen/Qwen2.5-Coder-32B-Instruct", "critic": "deepseek-ai/DeepSeek-R1-0528", "temperature": 0.0, "seed": 42},
  "metric_names": ["tests_passed", "edge_cases", "lint", "simplicity"],
  "weights": [50, 20, 15, 15],
  "test_suite_hash": "0x...",
  "versions": [
    {"v": 1, "code": "...", "code_hash": "0x...", "prev_code_hash": null, "diff": "",
     "metrics": [62, 25, 90, 100], "score": 6450, "failed_cases": ["edge_2", "edge_5"],
     "critique": "...", "attempts": 1, "request_hash": "0x...", "response_hash": "0x...",
     "tokens": {"prompt": 512, "completion": 300}}
  ],
  "changelog": ["V2: fixed edge_2, edge_5; score 6450 -> 8400 (+1950)"],
  "lessons": [{"text": "Strip whitespace and normalise case before parsing.", "embedding": null}],
  "memory_used": [],
  "status": "improved"
}
```
- versions has exactly 3 entries when status = "improved". status can also be "failed_no_improvement" or "too_easy".
- V3's critique is "".
- memory_used = [{"record_id": 0, "cid": "...", "lessons_used": ["..."]}] for Agent B.

secret.json: PRIVATE, written by P1, NEVER committed or uploaded:
`{"prompt_hash": "<decimal string>", "salt": "<decimal string>"}`

evaluator.json: written by P2's attest/sign.py:
```json
{"task_id": 1, "agent_wallet": "0x...", "metrics": [[62,25,90,100],[87,50,90,100],[100,100,90,90]],
 "snapshot_hash": "<decimal>", "test_suite_hash": "0x...", "chain_id": 11155111,
 "registry": "0x...", "evaluator_address": "0x...", "signature": "0x..."}
```

proof.json: written by P2's zk/prove.js. All numbers are decimal strings, already in Solidity order (pB coordinates swapped by snarkjs exportSolidityCallData):
```json
{"pA": ["",""], "pB": [["",""],["",""]], "pC": ["",""], "pubSignals": ["... 16 values ..."],
 "prompt_commitment": "<decimal>", "verified_locally": true}
```

receipt.json: written by P3's pipeline:
```json
{"cid": "bafy...", "tx_hash": "0x...", "block": 123, "record_id": 0, "reward_wei": "1000000000000000",
 "chain_id": 11155111, "explorer_tx_url": "https://...", "ipfs_url": "https://..."}
```

events.jsonl: everyone APPENDS one JSON object per line, live:
`{"ts": "2026-10-31T02:15:03Z", "actor": "agent|evaluator|prover|pipeline|cheat", "step": "generate|evaluate|critique|revise|lessons|run_done|sign|prove|upload|submit|verified|error", "v": 2, "score": 8400, "msg": "..."}`
(v and score may be null.)

Also: runs/benchmark.json (P1) and runs/cheats.json (P2).

### 3.4 Commands (always run from repo root)
| Command | Owner | Output |
|---|---|---|
| python -m agent.run --task 1 --agent A [--mock-llm] | P1 | runs/<id>/run.json, secret.json, events.jsonl; last stdout line = run folder path |
| python -m agent.agent_b --task 2 | P1 | same, with memory_used filled |
| python -m agent.benchmark --tasks 2 3 4 | P1 | runs/benchmark.json |
| python -m attest.sign --run runs/<id> | P2 | evaluator.json |
| node zk/prove.js runs/<id> | P2 | proof.json |
| node zk/cheat_demo.js | P2 | runs/cheats.json |
| python -m pipeline.submit --run runs/<id> | P3 | IPFS upload + on-chain submit, receipt.json |
| python -m pipeline.run_all --task 1 --agent A | P3 | runs all four steps in order, stops on first error |
| cd dashboard && npm run dev | P4 | dashboard at localhost:3000 |

### 3.5 Circuit public signals (exactly 16, in this order)
| Index | Meaning |
|---|---|
| 0-3 | V1 metrics |
| 4-7 | V2 metrics |
| 8-11 | V3 metrics |
| 12 | promptCommitment |
| 13 | snapshotHash |
| 14 | agentWallet (address as integer) |
| 15 | taskId |
Private inputs: promptHash, salt. Weights are constants inside the circuit (that is the "pre-committed" formula).

### 3.6 Evaluator signature (Python and Solidity must match EXACTLY)
digest = keccak256(abi.encode(uint256 chainId, address registry, uint256 taskId, address agent, uint256[12] metrics, uint256 snapshotHash, bytes32 testSuiteHash))
- metrics = V1, V2, V3 flattened (same as pubSignals 0-11)
- Python: eth_abi.encode(["uint256","address","uint256","address","uint256[12]","uint256","bytes32"], [...]), then eth_account.Account.sign_message(encode_defunct(primitive=digest), key)
- Solidity: ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), sig) == evaluator   (OpenZeppelin v5)

### 3.7 Contract interface: AutoEvolveRegistry
```solidity
struct Record { uint256 taskId; address agent; string cid; uint256 snapshotHash; uint256 promptCommitment; uint256[3] scores; uint64 timestamp; }
function registerTask(uint256 taskId, bytes32 testSuiteHash) external;   // onlyOwner, may overwrite
function fund() external payable;   // plus receive()
function submit(uint256 taskId, string calldata cid,
  uint256[2] calldata pA, uint256[2][2] calldata pB, uint256[2] calldata pC,
  uint256[16] calldata pub, bytes calldata evaluatorSig) external returns (uint256 recordId);
function recordCount() external view returns (uint256);
function getRecord(uint256 id) external view returns (Record memory);
event ImprovementVerified(uint256 indexed recordId, uint256 indexed taskId, address indexed agent,
  string cid, uint256 snapshotHash, uint256[3] scores, uint256 rewardWei);
```
submit() checks, in this order, with these exact revert strings:
1. UNKNOWN_TASK: no testSuiteHash registered for taskId
2. TASK_MISMATCH: pub[15] != taskId
3. NOT_AGENT: pub[14] != uint160(msg.sender)
4. ALREADY_CLAIMED: claimed[taskId][msg.sender]
5. BAD_PROOF: verifier.verifyProof(...) is false
6. BAD_EVALUATOR_SIG: signature check fails (skipped if evaluator == address(0))
7. ESCROW_EMPTY: balance < reward
Then: mark claimed, store record, emit event, pay the reward with call (PAY_FAILED if the transfer fails).

## 4. Git rules (no confusion)
Branches: p1-agent, p2-zk, p3-integration, p4-dashboard. main is updated ONLY by P3 at checkpoints or on request.

First time:
```
git clone <repo-url> autoevolve && cd autoevolve
git checkout p1-agent        # use your own branch
```
While working:
```
git add agent/ tasks/ evaluator/ docs/explain/p1.md    # ONLY your folders
git commit -m "p1: sandbox runner works"
git push
```
After each checkpoint (once P3 says main is merged):
```
git fetch origin
git merge origin/main
```
Need something from a teammate before the next checkpoint? Ask P3 for a "mini-merge" to main, then run the two commands above.

NEVER: `git add .` or `git add -A`; `git push --force`; edit another person's folder; commit .env, keys, secret.json, runs/, system_prompt.txt, agent/.cache/.
Merge conflict? STOP and call P3. Do not "fix" it alone.

P4 on a borrowed laptop: use a SEPARATE clone folder (~/autoevolve-p4) on branch p4-dashboard. Set `git config user.name "<P4 name>"` and `git config user.email "<P4 email>"` inside that folder. Commit and push BEFORE returning the laptop.

## 5. Secrets
- .env lives only on laptops, never in git. .env.example shows the variable names.
- Variables: FEATHERLESS_API_KEY, PINATA_JWT, PINATA_GATEWAY, RPC_URL, CHAIN, DEPLOYER_PRIVATE_KEY, AGENT_A_PRIVATE_KEY, AGENT_B_PRIVATE_KEY, EVALUATOR_PRIVATE_KEY, USE_DOCKER
- Throwaway testnet wallets only. Public addresses go in schemas/addresses.json.
- Each laptop gets only the keys it needs. The demo machine gets all of them.
- Never paste private keys into any AI chat.

## 6. Rules for AI coding assistants (Claude Code etc.)
- Read PLAN.md and your human's role file first. Follow the frozen interfaces EXACTLY.
- Your human is a beginner who must explain this to judges. Before each step, explain in 2-4 simple sentences what and why. After each step, run it, show the output, and explain it.
- Small steps. Run or test after every step. Never write large untested files.
- Edit only your human's folders. For anything else, write the exact message your human should send to the owner.
- Stage only your human's folders. Never merge, never force-push, never git add . / -A.
- Never print, log or commit secrets (.env values, private keys, secret.json, system_prompt.txt).
- Keep docs/explain/<role>.md updated: what each file does in plain English, plus a 3-sentence "how to explain this to judges".

## 7. Trust model (what we claim, said honestly)
- The ZK proof guarantees: the metrics are in range, the score uses the fixed pre-committed weights, S1 < S2 < S3, and the prover knows the secret system prompt behind the public commitment.
- The evaluator signature guarantees: those metrics came from the named evaluator (who re-ran the hidden tests), not from the agent.
- The contract guarantees: proof + signature + memory commitment (snapshotHash) are checked; no replays; no proof theft; reward is paid automatically.
- NOT guaranteed: that the LLM behaved honestly, or that the evaluator is honest (it is a named trust assumption). Tests run in a sandbox but are not proven in ZK. Future work: TEE or zkVM execution of tests, and multiple independent evaluators.
