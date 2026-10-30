# Slides outline

1. **Title**: AutoEvolve Protocol. "Verifiable self-improving agents with shared on-chain memory." Team name.
2. **Problem**: agents self-report improvement (trust me); scores and prompts are private; lessons are not shared between agents, or shared without proof.
3. **Solution in one picture**: Agent A → hidden tests → critic → V1 < V2 < V3 → ZK proof + evaluator signature → smart contract pays + stores IPFS CID → Agent B reads verified memory.
4. **Architecture**: Featherless LLMs (Qwen2.5-Coder generator, DeepSeek-R1 critic) · sandboxed evaluator · Circom Groth16 circuit (16 public signals) · evaluator ECDSA signature · AutoEvolveRegistry contract · IPFS (Pinata) · dashboard.
5. **Live demo** (switch to the dashboard).
6. **Cheat demo**: 5 attacks, 5 rejections (table from the dashboard).
7. **Agent B and memory**: (a) the mechanism, shown live: chain → IPFS → hash check → lessons injected. (b) honest benchmark, n = 1 per task: all 3 tasks incl. the regression, average V1 without vs with memory as measured. Message: verifiable inherited memory, not a guaranteed score boost.
8. **Trust model** (PLAN.md section 7): proven by ZK / guaranteed by signature / guaranteed by contract / NOT guaranteed (LLM honesty, evaluator honesty, tests not in ZK).
9. **Users and future work**: agent marketplaces, auditable AI claims, shared memory between teams; TEE or zkVM test execution, multiple evaluators, embeddings for memory search.
10. **Team**: P1 agent, P2 ZK + attestation, P3 contracts + integration, P4 dashboard + demo.
