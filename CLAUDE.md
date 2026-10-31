# CLAUDE.md

Before writing any code:
1. Read PLAN.md fully. Section 3 (FROZEN INTERFACES) is law: file formats, hashing rules, public-signal order, signature digest, contract revert strings. Only P3 may change it.
2. Ask your human which role they are (P1-P4), then read docs/roles/P<n>.md.

Hard rules (details in PLAN.md section 6):
- Edit only your human's folders (PLAN.md section 1). For anything else, write the exact message your human should send to the owner.
- Stage only your human's folders. Never `git add .` / `git add -A`, never merge, never force-push.
- Never print, log or commit secrets: .env values, private keys, secret.json, agent/prompts/system_prompt.txt.
- Hashing goes through common/hashing.py (Ethereum Keccak via eth_utils, NEVER hashlib.sha3_256). run.json is written once as canonical bytes and never re-saved.
- Never hardcode chain IDs or addresses: use common/config.py (reads schemas/deployments.<CHAIN>.json).
- Your human is a beginner who presents to judges: explain each step in 2-4 simple sentences before doing it, run it after, explain the output. Small steps; test after each.
- Keep docs/explain/<role>.md updated.
- Run every command from the repo root.
