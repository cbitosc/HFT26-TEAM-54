#!/usr/bin/env bash
# One command: deploy verifier + registry, fund escrow, write schemas/ files, register tasks.
#   bash pipeline/deploy.sh [task ids...]        (default: 1)
# CHAIN / RPC_URL / DEPLOYER_PRIVATE_KEY come from .env. NO_EVALUATOR=1 deploys with evaluator = address(0)
# (the documented fallback: the signature check is skipped; say so honestly in the demo).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
PY=.venv/bin/python
# Load .env via python-dotenv, NOT `source .env`: sourcing executes the file, and a stray space after `=`
# makes bash run the secret as a command and print it in the error message.
eval "$($PY - <<'EOF'
import shlex
from dotenv import dotenv_values
for k, v in dotenv_values(".env").items():
    if v is not None and k.isidentifier():
        print(f"export {k}={shlex.quote(v.strip())}")
EOF
)"
CHAIN="${CHAIN:-local}"
RPC="${RPC_URL:-http://127.0.0.1:8545}"
TASKS="${*:-1}"

EVAL=$($PY -c "import json;print(json.load(open('schemas/addresses.json'))['evaluator'])")
if [ "${NO_EVALUATOR:-0}" = "1" ]; then EVAL=0x0000000000000000000000000000000000000000; fi
export EVALUATOR_ADDRESS="$EVAL"

if [ "$CHAIN" = "local" ]; then
  # Anvil starts with 10,000 ETH only on its own accounts: top up ours (public addresses only).
  for who in deployer agent_A agent_B evaluator; do
    addr=$($PY -c "import json;print(json.load(open('schemas/addresses.json'))['$who'])")
    cast rpc anvil_setBalance "$addr" 0x56BC75E2D63100000 --rpc-url "$RPC" >/dev/null
  done
fi

if [ "$CHAIN" = "local" ]; then
  (cd contracts && ./sync_verifier.sh && forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast \
    --private-key "$DEPLOYER_PRIVATE_KEY" 2>&1 | grep -vE "warning\[|╭|╰|│|━|help:|^$")
  PYTHONPATH=. $PY -m pipeline.post_deploy
else
  # Testnets: forge's built-in gas simulation is wrong for Sepolia's current gas schedule (every tx ran
  # out of gas), so compile with forge and deploy with web3 using the node's own gas estimates.
  (cd contracts && ./sync_verifier.sh && forge build 2>&1 | grep -E "Compiler run|No files changed|Error")
  PYTHONPATH=. $PY -m pipeline.deploy_web3
fi
PYTHONPATH=. $PY -m pipeline.register_tasks --tasks $TASKS
