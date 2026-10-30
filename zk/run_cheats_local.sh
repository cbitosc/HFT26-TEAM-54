#!/usr/bin/env bash
# Local end-to-end run of the five cheat attacks (zk/cheat_demo.js) against a FRESH Anvil.
#   bash zk/run_cheats_local.sh
# Starts Anvil, runs P3's pipeline/deploy.sh 1 2 3 4 (which rewrites the TRACKED files
# schemas/deployments.local.json and schemas/abi/AutoEvolveRegistry.json), runs the attacks, then runs
# the read-only (testnet-style) mode once as a self-test, and on exit (success OR failure) stops Anvil
# and restores those two tracked files with git checkout.
# Needs DEPLOYER_PRIVATE_KEY in .env (Anvil's public account #0 key is fine) and .venv for deploy.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
TRACKED="schemas/deployments.local.json schemas/abi/AutoEvolveRegistry.json"
RPC="http://127.0.0.1:8545"

# Guards run BEFORE the trap is armed, so refusing here never touches anyone's local edits.
if ! git diff --quiet -- $TRACKED || ! git diff --cached --quiet -- $TRACKED; then
  echo "REFUSING: $TRACKED already has local changes; the restore at the end would discard them." >&2
  exit 1
fi
node zk/cheat_demo.js --preflight
if curl -s -m 2 -X POST -H 'content-type: application/json' \
     --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$RPC" >/dev/null; then
  echo "REFUSING: something is already listening on $RPC. Stop it: the attacks need a FRESH chain." >&2
  exit 1
fi

ANVIL_PID=""
ANVIL_LOG=""
cleanup() {
  status=$?
  trap - EXIT
  if [ -n "$ANVIL_PID" ]; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
    echo "anvil stopped"
  fi
  if [ -n "$ANVIL_LOG" ]; then rm -f "$ANVIL_LOG"; fi
  git checkout -- $TRACKED
  echo "restored: $TRACKED"
  changed=$(git status --porcelain --untracked-files=no -- schemas pipeline contracts)
  if [ -n "$changed" ]; then
    echo "WARNING: still modified:"
    echo "$changed"
  else
    echo "git status: no modified files in schemas/, pipeline/ or contracts/"
  fi
  exit "$status"
}
trap cleanup EXIT

ANVIL_LOG=$(mktemp -t anvil)
anvil --port 8545 >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 30); do
  if curl -s -m 1 -X POST -H 'content-type: application/json' \
       --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$RPC" >/dev/null; then break; fi
  sleep 0.5
done
echo "anvil started (pid $ANVIL_PID)"
node zk/cheat_demo.js --fund-deployer

bash pipeline/deploy.sh 1 2 3 4
echo
echo "== read-only refusal check: nothing is claimed yet, so read-only mode must refuse =="
if READ_ONLY=1 node zk/cheat_demo.js --no-write; then
  echo "ERROR: read-only mode should have refused (task 1 is not claimed yet)" >&2
  exit 1
fi
echo "(refused, as expected)"
echo
PY="${PY:-.venv/bin/python}" node zk/cheat_demo.js
echo
echo "== read-only self-test: same chain, Agent A has now claimed task 1; staticCall only, no transactions =="
PY="${PY:-.venv/bin/python}" READ_ONLY=1 node zk/cheat_demo.js --no-write
