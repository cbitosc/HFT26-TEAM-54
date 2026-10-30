#!/usr/bin/env bash
# Local end-to-end run of the five cheat attacks (zk/cheat_demo.js) against a FRESH Anvil.
#   bash zk/run_cheats_local.sh
# Starts Anvil, runs P3's pipeline/deploy.sh 1 2 3 4 (which rewrites the TRACKED files
# schemas/deployments.local.json and schemas/abi/AutoEvolveRegistry.json), runs the attacks, then runs
# the read-only (testnet-style) mode once as a self-test, and on exit (success OR failure) stops Anvil
# and restores those two tracked files with git checkout (by explicit path, never a broad schemas/ checkout).
# A guard hashes every other file under schemas/ (incl. deployments.sepolia.json) before and after and aborts if any changed.
# ALWAYS LOCAL, whatever .env says (it may say CHAIN=sepolia): see "Force a local run" below. Needs .venv
# and Foundry; AGENT_A_PRIVATE_KEY and EVALUATOR_PRIVATE_KEY still come from .env (chain-independent keys).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
TRACKED="schemas/deployments.local.json schemas/abi/AutoEvolveRegistry.json"
RPC="http://127.0.0.1:8545"
DEPLOY_COPY="zk/.deploy_local.sh" # temporary patched copy of pipeline/deploy.sh, removed on exit

# Force a local run. dotenv and python-dotenv never override variables that are already set, so these
# exports win for every node and python command below. The deployer is Anvil's PUBLIC account #0, derived
# from Anvil's public test mnemonic: the team deployer key in .env is never used here.
export CHAIN=local
export RPC_URL="$RPC"
DEPLOYER_PRIVATE_KEY=$(cast wallet private-key --mnemonic "test test test test test test test test test test test junk" --mnemonic-index 0)
export DEPLOYER_PRIVATE_KEY

# Guards run BEFORE the trap is armed, so refusing here never touches anyone's local edits.
if ! git diff --quiet -- $TRACKED || ! git diff --cached --quiet -- $TRACKED; then
  echo "REFUSING: $TRACKED already has local changes; the restore at the end would discard them." >&2
  exit 1
fi
# --- schemas guard begin ---
# Nothing under schemas/ except the two TRACKED files (restored by explicit path in the trap) may change.
# In particular deployments.sepolia.json: post_deploy.py / deploy_web3.py write deployments.<CHAIN>.json, so a
# wrong CHAIN would hit it. CHAIN is forced to local above; this guard proves it by hashing before and after.
schemas_snapshot() {
  find schemas -type f | sort \
    | grep -vxF -e schemas/deployments.local.json -e schemas/abi/AutoEvolveRegistry.json \
    | xargs shasum -a 256
}
SCHEMAS_BEFORE=$(schemas_snapshot)
if [ -f schemas/deployments.sepolia.json ] && ! printf '%s\n' "$SCHEMAS_BEFORE" | grep -q 'deployments.sepolia.json'; then
  echo "REFUSING: the schemas guard could not hash schemas/deployments.sepolia.json." >&2
  exit 1
fi
check_schemas_untouched() {
  local after
  after=$(schemas_snapshot)
  if [ "$after" != "$SCHEMAS_BEFORE" ]; then
    echo "!!! ABORT: files under schemas/ (other than the two restored ones) CHANGED during this run:" >&2
    diff <(printf '%s\n' "$SCHEMAS_BEFORE") <(printf '%s\n' "$after") >&2 || true
    echo "!!! If schemas/deployments.sepolia.json is listed, restore it by hand: git checkout -- schemas/deployments.sepolia.json" >&2
    return 1
  fi
  return 0
}
# --- schemas guard end ---
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
  rm -f "$DEPLOY_COPY"
  git checkout -- $TRACKED
  echo "restored: $TRACKED"
  if check_schemas_untouched; then
    echo "schemas guard: every other file under schemas/ (incl. deployments.sepolia.json) is unchanged"
  elif [ "$status" -eq 0 ]; then
    status=1
  fi
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

# pipeline/deploy.sh re-loads .env (python-dotenv + eval export), which would OVERRIDE our exports and, for
# CHAIN=sepolia, take its testnet branch and send real transactions. So run a temporary copy with just that
# block removed, and refuse to continue if it is still there (e.g. deploy.sh was changed).
awk '/^eval "\$\(\$PY - <<.EOF.$/ {skip=1} skip && /^\)"$/ {skip=0; next} !skip {print}' pipeline/deploy.sh > "$DEPLOY_COPY"
if grep -qE 'dotenv_values|^eval ' "$DEPLOY_COPY"; then
  echo "REFUSING: could not remove the .env loading from pipeline/deploy.sh (did it change?)." >&2
  exit 1
fi
bash "$DEPLOY_COPY" 1 2 3 4
check_schemas_untouched || exit 1
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
