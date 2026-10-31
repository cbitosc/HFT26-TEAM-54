#!/usr/bin/env bash
# Copy P2's generated verifier (contract Groth16Verifier, 16 public signals) into src/.
set -e
cd "$(dirname "$0")"
cp ../zk/out/Verifier.sol src/Verifier.sol
echo "synced zk/out/Verifier.sol -> contracts/src/Verifier.sol"
