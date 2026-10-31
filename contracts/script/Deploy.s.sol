// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Verifier.sol";
import {AutoEvolveRegistry} from "../src/AutoEvolveRegistry.sol";

/// Deploys the real Groth16 verifier + the registry, then funds the reward escrow.
/// Env: EVALUATOR_ADDRESS (address(0) = signature check skipped), optional REWARD_WEI, FUND_WEI.
/// Use pipeline/deploy.sh, which sets these and then runs pipeline/post_deploy.py.
contract Deploy is Script {
    function run() external {
        address evaluator = vm.envAddress("EVALUATOR_ADDRESS");
        uint256 reward = vm.envOr("REWARD_WEI", uint256(1e15));
        uint256 fundWei = vm.envOr("FUND_WEI", uint256(0.01 ether));

        vm.startBroadcast();
        Groth16Verifier verifier = new Groth16Verifier();
        AutoEvolveRegistry registry = new AutoEvolveRegistry(address(verifier), evaluator, reward);
        registry.fund{value: fundWei}();
        vm.stopBroadcast();

        console.log("verifier:", address(verifier));
        console.log("registry:", address(registry));
        console.log("evaluator:", evaluator);
    }
}
