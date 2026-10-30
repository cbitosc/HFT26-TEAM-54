# 🚀 CBIT Hacktoberfest '26 — Project Starter Repository

> **Official Public Starter Repository for CBIT Hacktoberfest '26**  
> *Chaitanya Bharathi Institute of Technology (CBIT), Hyderabad*

**Our project: AutoEvolve Protocol.** Team plan and frozen interfaces: [PLAN.md](PLAN.md). Live status: [docs/STATUS.md](docs/STATUS.md).

---

## 📋 Team Information

| Attribute | Details |
| :--- | :--- |
| **Team Name** | **Coding Brigaders** |
| **Team Number** | `TEAM-54` (`HFT26-TEAM-54`) |
| **Registration ID** | `HFEST26-NWESBTK5` |
| **Problem Track** | **Track Selection in Progress** |
| **Domain** | `General Track` |
| **Team Leader** | Thaswik PLV (thaswik1011@gmail.com) |
| **Institution** | CBIT |

### 👥 Team Members

| # | Name | Email | Institution |
| :--- | :--- | :--- | :--- |
| 1 | Sai Koushik B | kaushikbommasani@gmail.com | CBIT |
| 2 | Paidi Karthik | paidikarthik784@gmail.com | CBIT |
| 3 | Vainyavi Thakur | thakurvainyavi@gmail.com | CBIT |

---

## 🎯 Problem Statement

### **TDecentralized, ZK-Attested Self-Improving Agent with Immutable Cross-Agent Memory
**
*Domain:* **Agentic AI, Zero-Knowledge Cryptography & Decentralized Infrastructure
**

Current self-improving AI agents operate inside proprietary, isolated runtime environments. When an agent critiques and revises its output, the user has no cryptographic guarantee that the agent didn't hallucinate its improvement score, ignore safety constraints, or delete critical context. Furthermore, learnings from an agent's failure loops are discarded rather than shared across the open-source AI ecosystem. Participants must build AutoEvolve Protocol, an open-source framework where an autonomous agent executes a generate-critique-revise loop (V1V2V3), cryptographically attests to its performance gains using Zero-Knowledge proofs, and publishes immutable execution snapshots to a decentralized storage network for cross-agent collective learning. REQUIREMENTS: 1. Multi-Stage Iterative Agent Engine: Construct an agent loop that generates an initial solution (V1), evaluates its performance against explicit quantitative metrics, and generates refined versions (V2,V3) along with an automated changelog. 2. ZK-Proof of Improvement: Integrate EZKL, Circom, or SP1 to generate a succinct proof () validating that Score(Vn+1)>Score(Vn) based on a pre-committed arithmetic constraint circuit without revealing sensitive system prompts. 3. Decentralized Memory Registry (DataDAO): Upload the execution diffs, critique logs, and memory embeddings to IPFS or Filecoin. Record the resulting IPFS Content Identifier (CID) on an EVM testnet smart contract so other agents can query and inherit the fix history. 4. Smart Contract Verification & Reward Escrow: Deploy an on-chain verifier contract that checks the ZK proof (), verifies the IPFS memory commitment, and distributes micro-rewards to the agent's wallet upon successful verified self-improvement. Open-Source Developer Dashboard: Provide a visual dashboard showing real-time agent execution trees, version diffs, ZK proof verification statuses, and on-chain memory CID logs. EXPECTED OUTCOME: 1. Verifiable Iterative Agent Loop: A functional agent that successfully executes a multi-stage Generate -> Critique -> Revise cycle with a clean automated changelog and measurable performance gains. 2. Cryptographic ZK Proof & On-Chain Settlement: A deployed verifier smart contract on an EVM testnet that successfully validates the ZK proof, records the storage CID, and distributes micro-rewards to the agent's wallet. 3. Cross-Agent Collective Memory: A decentralized DataDAO registry (IPFS/Filecoin) where execution logs and diffs are stored, allowing a second independent agent to query the smart contract, ingest the fix history, and avoid past failure loops. 4. Interactive Developer Dashboard: A visual interface enabling judges and developers to inspect real-time agent execution trees, side-by-side version diffs, ZK verification statuses, and live on-chain logs. Suggested Featherless usage: Adversarial Generator-Critic Separation: Eliminate self-grading bias by routing your agent loop through two distinct, pinned open-weight endpoints via the Featherless API (e.g., using a coding model like Qwen/Qwen2.5-Coder-32B-Instruct for drafting and a reasoning model like deepseek-ai/DeepSeek-R1 as the independent judge). Deterministic Reproducibility for ZK Inputs: Use Featherless serverless endpoints with deterministic parameters (temperature: 0.0) to generate consistent model outputs and exact metadata hashes that can be cleanly referenced in your ZK circuits and IPFS memory payloads.
---

## 🛠️ Contribution & Submission Workflow

All teams must follow the official fork-and-pull-request workflow:

1. **Fork this Repository**:
   - One team member should click the **Fork** button at the top right to fork this upstream repository to your personal/team GitHub account.
2. **Add Collaborators**:
   - In your forked repository, navigate to **Settings > Collaborators** and invite all your registered team members.
3. **Clone & Develop Locally**:
   ```bash
   git clone https://github.com/<your-username>/HFT26-TEAM-54.git
   cd HFT26-TEAM-54
   git checkout -b feature/prototype
   ```
4. **Commit & Push Regularly**:
   - Make atomic, descriptive commits throughout the hackathon.
   ```bash
   git add .
   git commit -m "feat: implement core solution architecture"
   git push origin feature/prototype
   ```
5. **Open Pull Request (PR) for Final Submission**:
   - When ready for evaluation, open a **Pull Request** from your fork's `main` branch back to this upstream repository's `main` branch.
   - **PR Title Format**: `[SUBMISSION] TEAM-54 - Coding Brigaders - Track Selection in Progress`
   - **PR Description Checklist**:
     - 📌 Solution Overview & Approach
     - 🏗️ Architecture & Tech Stack Details
     - 🚀 Local Setup & Installation Instructions
     - 🎥 Demo Video Link / Live Deployment URL
     - 📸 Key Screenshots & Visuals

---

## 📁 Recommended Project Structure

```
.
├── src/                  # Source code (Frontend / Backend / ML)
├── docs/                 # Documentation, architecture diagrams, slides
├── tests/                # Test suites & verification scripts
├── README.md             # Your project documentation & presentation
└── LICENSE               # Open-source license (MIT recommended)
```

---

## ⚠️ Important Rules & Code of Conduct
* **Upstream Protection**: Do not push directly to this repository's main branch. All evaluation will be conducted on your submitted Pull Request.
* **Original Work**: All code submitted must be developed during the hackathon timeline. Open-source libraries and frameworks are welcomed with proper attribution.
* **Code Freeze**: Final Pull Requests must be submitted before the designated hackathon submission deadline.
