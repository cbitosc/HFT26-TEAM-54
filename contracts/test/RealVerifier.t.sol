// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Groth16Verifier} from "../src/Verifier.sol";
import {AutoEvolveRegistry} from "../src/AutoEvolveRegistry.sol";
import {Fixture} from "./Fixture.sol";

/// The same contract, but with P2's REAL Groth16 verifier and a REAL proof (zk/out/fixture/fixture.json).
contract RealVerifierTest is Test {
    Groth16Verifier verifier;
    AutoEvolveRegistry reg;

    uint256 constant EVAL_KEY = 0xE7A1;
    string constant CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    uint256 constant REWARD = 1e15;

    function setUp() public {
        verifier = new Groth16Verifier();
        reg = new AutoEvolveRegistry(address(verifier), vm.addr(EVAL_KEY), REWARD);
        reg.registerTask(Fixture.TASK_ID, Fixture.TEST_SUITE_HASH);
        vm.deal(address(reg), 0.01 ether);
    }

    function _sign(uint256[16] memory p) internal view returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            reg.evaluatorDigest(Fixture.TASK_ID, Fixture.AGENT, p, Fixture.TEST_SUITE_HASH)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(EVAL_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_fixtureIsBoundToAgentAndTask() public pure {
        uint256[16] memory p = Fixture.pub();
        assertEq(p[14], uint256(uint160(Fixture.AGENT)));
        assertEq(p[15], Fixture.TASK_ID);
    }

    function test_realVerifier_acceptsRealProof() public view {
        assertTrue(verifier.verifyProof(Fixture.pA(), Fixture.pB(), Fixture.pC(), Fixture.pub()));
    }

    /// Changing ANY single public signal (metrics, commitment, snapshot hash, wallet, task) breaks the proof.
    function test_realVerifier_rejectsEveryTamperedSignal() public view {
        for (uint256 i = 0; i < 16; i++) {
            uint256[16] memory p = Fixture.pub();
            p[i] += 1;
            assertFalse(verifier.verifyProof(Fixture.pA(), Fixture.pB(), Fixture.pC(), p), "tampered signal accepted");
        }
    }

    function test_realVerifier_rejectsTamperedProofPoints() public view {
        uint256[2] memory a = Fixture.pA();
        a[0] += 1;
        assertFalse(verifier.verifyProof(a, Fixture.pB(), Fixture.pC(), Fixture.pub()));
        uint256[2] memory c = Fixture.pC();
        c[1] += 1;
        assertFalse(verifier.verifyProof(Fixture.pA(), Fixture.pB(), c, Fixture.pub()));
    }

    /// Full on-chain flow with the real proof: verified, evaluator-signed, recorded, paid.
    function test_realProof_endToEnd_paysAgent() public {
        uint256[16] memory p = Fixture.pub();
        bytes memory sig = _sign(p);
        uint256 before_ = Fixture.AGENT.balance;

        vm.prank(Fixture.AGENT);
        uint256 id = reg.submit(Fixture.TASK_ID, CID, Fixture.pA(), Fixture.pB(), Fixture.pC(), p, sig);

        assertEq(id, 0);
        assertEq(Fixture.AGENT.balance, before_ + REWARD);
        AutoEvolveRegistry.Record memory r = reg.getRecord(0);
        assertEq(r.agent, Fixture.AGENT);
        assertEq(r.cid, CID);
        assertEq(r.promptCommitment, p[12]);
        assertEq(r.snapshotHash, p[13]);
        assertEq(r.scores[0], 6450);
        assertEq(r.scores[1], 8200);
        assertEq(r.scores[2], 9700);
        assertTrue(r.scores[0] < r.scores[1] && r.scores[1] < r.scores[2]);
    }

    function test_realProof_tamperedMetric_BAD_PROOF() public {
        uint256[16] memory p = Fixture.pub();
        p[10] += 5; // V3 lint 90 -> 95: a cheater inflates a metric...
        bytes memory sig = _sign(p); // ...and even a VALID evaluator signature over the lie cannot save it
        vm.prank(Fixture.AGENT);
        vm.expectRevert(bytes("BAD_PROOF"));
        reg.submit(Fixture.TASK_ID, CID, Fixture.pA(), Fixture.pB(), Fixture.pC(), p, sig);
    }

    function test_realProof_stolenByAnotherWallet_NOT_AGENT() public {
        uint256[16] memory p = Fixture.pub();
        bytes memory sig = _sign(p);
        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("NOT_AGENT"));
        reg.submit(Fixture.TASK_ID, CID, Fixture.pA(), Fixture.pB(), Fixture.pC(), p, sig);
    }

    function test_realProof_replay_ALREADY_CLAIMED() public {
        uint256[16] memory p = Fixture.pub();
        bytes memory sig = _sign(p);
        vm.startPrank(Fixture.AGENT);
        reg.submit(Fixture.TASK_ID, CID, Fixture.pA(), Fixture.pB(), Fixture.pC(), p, sig);
        vm.expectRevert(bytes("ALREADY_CLAIMED"));
        reg.submit(Fixture.TASK_ID, CID, Fixture.pA(), Fixture.pB(), Fixture.pC(), p, sig);
        vm.stopPrank();
    }

    function test_realProof_wrongEvaluator_BAD_EVALUATOR_SIG() public {
        uint256[16] memory p = Fixture.pub();
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            reg.evaluatorDigest(Fixture.TASK_ID, Fixture.AGENT, p, Fixture.TEST_SUITE_HASH)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBEEF, digest); // the agent signs its own numbers
        vm.prank(Fixture.AGENT);
        vm.expectRevert(bytes("BAD_EVALUATOR_SIG"));
        reg.submit(Fixture.TASK_ID, CID, Fixture.pA(), Fixture.pB(), Fixture.pC(), p, abi.encodePacked(r, s, v));
    }
}
