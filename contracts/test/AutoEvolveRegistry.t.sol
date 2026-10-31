// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {AutoEvolveRegistry} from "../src/AutoEvolveRegistry.sol";

/// Stand-in for the Groth16 verifier: accepts exactly one set of public signals (like a real proof for them),
/// so tampering with any pub value makes it return false. The real verifier is exercised in RealVerifier.t.sol.
contract MockVerifier {
    bytes32 public expected;

    function setExpected(uint256[16] memory pub) external {
        expected = keccak256(abi.encode(pub));
    }

    function verifyProof(uint256[2] calldata, uint256[2][2] calldata, uint256[2] calldata, uint256[16] calldata pub)
        external
        view
        returns (bool)
    {
        return keccak256(abi.encode(pub)) == expected;
    }
}

/// An agent wallet that cannot receive ETH (no receive/fallback): tests PAY_FAILED.
contract Rejecter {
    function go(
        AutoEvolveRegistry reg,
        uint256 taskId,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[16] calldata pub,
        bytes calldata sig
    ) external {
        reg.submit(taskId, "cid", pA, pB, pC, pub, sig);
    }
}

/// An agent wallet that tries to re-enter submit() when it receives the reward.
contract Reenterer {
    AutoEvolveRegistry reg;
    uint256 taskId;
    uint256[16] pub;
    bytes sig;
    bool public triedReentry;
    bool public reentrySucceeded;
    string public lastError;

    function go(AutoEvolveRegistry reg_, uint256 taskId_, uint256[16] calldata pub_, bytes calldata sig_) external {
        reg = reg_;
        taskId = taskId_;
        pub = pub_;
        sig = sig_;
        uint256[2] memory z2;
        uint256[2][2] memory z22;
        reg.submit(taskId, "cid", z2, z22, z2, pub, sig);
    }

    receive() external payable {
        triedReentry = true;
        uint256[2] memory z2;
        uint256[2][2] memory z22;
        try reg.submit(taskId, "cid", z2, z22, z2, pub, sig) returns (uint256) {
            reentrySucceeded = true;
        } catch Error(string memory why) {
            lastError = why;
        }
    }
}

contract AutoEvolveRegistryTest is Test {
    AutoEvolveRegistry reg;
    MockVerifier mock;

    uint256 constant EVAL_KEY = 0xE7A1;
    address evaluatorAddr;
    address agent = address(0xA11CE);
    address stranger = address(0xBAD);

    uint256 constant REWARD = 1e15;
    uint256 constant TASK = 1;
    uint256 constant SNAP = 123456789;
    uint256 constant COMMIT = 777;
    bytes32 constant SUITE = 0xabababababababababababababababababababababababababababababababab;
    string constant CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    uint256[2] pA;
    uint256[2][2] pB;
    uint256[2] pC;

    function setUp() public {
        evaluatorAddr = vm.addr(EVAL_KEY);
        mock = new MockVerifier();
        reg = new AutoEvolveRegistry(address(mock), evaluatorAddr, REWARD);
        reg.registerTask(TASK, SUITE);
        vm.deal(address(reg), 0.01 ether);
    }

    // ---------- helpers ----------

    function _pub(address who, uint256 taskId) internal pure returns (uint256[16] memory p) {
        uint8[12] memory m = [62, 25, 90, 100, 87, 50, 90, 100, 100, 100, 90, 90];
        for (uint256 i = 0; i < 12; i++) {
            p[i] = m[i];
        }
        p[12] = COMMIT;
        p[13] = SNAP;
        p[14] = uint256(uint160(who));
        p[15] = taskId;
    }

    function _sign(AutoEvolveRegistry r, uint256 key, address who, uint256 taskId, uint256[16] memory p)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(r.evaluatorDigest(taskId, who, p, SUITE));
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(rr, s, v);
    }

    function _submit(address from, uint256 taskId, uint256[16] memory p, bytes memory sig) internal returns (uint256) {
        vm.prank(from);
        return reg.submit(taskId, CID, pA, pB, pC, p, sig);
    }

    /// Valid proof + valid evaluator signature for `agent` on TASK.
    function _good() internal returns (uint256[16] memory p, bytes memory sig) {
        p = _pub(agent, TASK);
        mock.setExpected(p);
        sig = _sign(reg, EVAL_KEY, agent, TASK, p);
    }

    // ---------- the 9 required cases ----------

    // 1. Happy path: record stored, event emitted, agent paid.
    function test_1_happyPath() public {
        (uint256[16] memory p, bytes memory sig) = _good();
        uint256 before_ = agent.balance;
        uint256[3] memory scores = [uint256(6450), 8200, 9700];

        vm.expectEmit(true, true, true, true);
        emit AutoEvolveRegistry.ImprovementVerified(0, TASK, agent, CID, SNAP, scores, REWARD);
        uint256 id = _submit(agent, TASK, p, sig);

        assertEq(id, 0);
        assertEq(reg.recordCount(), 1);
        assertEq(agent.balance, before_ + REWARD);
        assertEq(address(reg).balance, 0.01 ether - REWARD);
        assertTrue(reg.claimed(TASK, agent));

        AutoEvolveRegistry.Record memory r = reg.getRecord(0);
        assertEq(r.taskId, TASK);
        assertEq(r.agent, agent);
        assertEq(r.cid, CID);
        assertEq(r.snapshotHash, SNAP);
        assertEq(r.promptCommitment, COMMIT);
        assertEq(r.scores[0], 6450);
        assertEq(r.scores[1], 8200);
        assertEq(r.scores[2], 9700);
        assertEq(r.timestamp, uint64(block.timestamp));
    }

    // 2. A tampered public signal (inflated V3 metric) no longer matches the proof.
    function test_2_tamperedPubSignal_BAD_PROOF() public {
        (uint256[16] memory p, bytes memory sig) = _good();
        p[8] = 99; // V3 tests_passed changed after the proof was made
        vm.expectRevert(bytes("BAD_PROOF"));
        _submit(agent, TASK, p, sig);
    }

    // 3. Someone copies agent's proof and sends it from their own wallet (front-running / proof theft).
    function test_3_wrongSender_NOT_AGENT() public {
        (uint256[16] memory p, bytes memory sig) = _good();
        vm.expectRevert(bytes("NOT_AGENT"));
        _submit(stranger, TASK, p, sig);
    }

    // 4. Same agent claims the same task twice.
    function test_4_replay_ALREADY_CLAIMED() public {
        (uint256[16] memory p, bytes memory sig) = _good();
        _submit(agent, TASK, p, sig);
        vm.expectRevert(bytes("ALREADY_CLAIMED"));
        _submit(agent, TASK, p, sig);
    }

    // 5. Metrics not signed by the named evaluator (agent signs its own numbers, or garbage).
    function test_5_wrongSigner_BAD_EVALUATOR_SIG() public {
        (uint256[16] memory p,) = _good();
        bytes memory forged = _sign(reg, 0xBEEF, agent, TASK, p);
        vm.expectRevert(bytes("BAD_EVALUATOR_SIG"));
        _submit(agent, TASK, p, forged);
    }

    function test_5b_garbageSignature_BAD_EVALUATOR_SIG() public {
        (uint256[16] memory p,) = _good();
        vm.expectRevert(bytes("BAD_EVALUATOR_SIG")); // not an ECDSA revert: tryRecover turns it into our string
        _submit(agent, TASK, p, hex"1234");
    }

    // 6. Task that nobody registered.
    function test_6_unregisteredTask_UNKNOWN_TASK() public {
        uint256[16] memory p = _pub(agent, 9);
        mock.setExpected(p);
        vm.expectRevert(bytes("UNKNOWN_TASK"));
        _submit(agent, 9, p, "");
    }

    // 7. A valid proof for task 2 submitted as task 1.
    function test_7_taskMismatch_TASK_MISMATCH() public {
        uint256[16] memory p = _pub(agent, 2);
        mock.setExpected(p);
        vm.expectRevert(bytes("TASK_MISMATCH"));
        _submit(agent, TASK, p, "");
    }

    // 8. Escrow ran dry.
    function test_8_emptyEscrow_ESCROW_EMPTY() public {
        (uint256[16] memory p, bytes memory sig) = _good();
        vm.deal(address(reg), REWARD - 1);
        vm.expectRevert(bytes("ESCROW_EMPTY"));
        _submit(agent, TASK, p, sig);
    }

    // 9. Fallback mode: evaluator == address(0) skips the signature check (said honestly in the demo).
    function test_9_evaluatorZero_signatureSkipped() public {
        AutoEvolveRegistry open = new AutoEvolveRegistry(address(mock), address(0), REWARD);
        open.registerTask(TASK, SUITE);
        vm.deal(address(open), 0.01 ether);
        uint256[16] memory p = _pub(agent, TASK);
        mock.setExpected(p);
        vm.prank(agent);
        open.submit(TASK, CID, pA, pB, pC, p, "");
        assertEq(open.recordCount(), 1);
        assertEq(agent.balance, REWARD);
    }

    // ---------- extras ----------

    // Python (attest/sign.py, eth_abi) and Solidity must build the SAME digest. Reference computed with eth_abi.
    function test_digestMatchesPython() public {
        address fixedRegistry = 0x1000000000000000000000000000000000000001;
        deployCodeTo(
            "AutoEvolveRegistry.sol:AutoEvolveRegistry", abi.encode(address(mock), evaluatorAddr, REWARD), fixedRegistry
        );
        uint256[16] memory p = _pub(0x2000000000000000000000000000000000000002, 1);
        bytes32 d = AutoEvolveRegistry(payable(fixedRegistry)).evaluatorDigest(
            1, 0x2000000000000000000000000000000000000002, p, SUITE
        );
        assertEq(d, 0xa4c400893398378dd7e68e1653c58dca0286a10f3eefc5d57257dddc526da6c5);
    }

    function test_onlyOwnerCanRegisterTask() public {
        vm.prank(stranger);
        vm.expectRevert();
        reg.registerTask(5, SUITE);
    }

    function test_fund_andReceive() public {
        vm.deal(stranger, 1 ether);
        vm.startPrank(stranger);
        reg.fund{value: 0.1 ether}();
        (bool ok,) = address(reg).call{value: 0.2 ether}("");
        vm.stopPrank();
        assertTrue(ok);
        assertEq(address(reg).balance, 0.31 ether);
    }

    // Agent wallet that can't receive ETH: whole tx reverts, nothing is marked claimed.
    function test_payFailed_rollsBack() public {
        Rejecter rej = new Rejecter();
        uint256[16] memory p = _pub(address(rej), TASK);
        mock.setExpected(p);
        bytes memory sig = _sign(reg, EVAL_KEY, address(rej), TASK, p);
        vm.expectRevert(bytes("PAY_FAILED"));
        rej.go(reg, TASK, pA, pB, pC, p, sig);
        assertFalse(reg.claimed(TASK, address(rej)));
        assertEq(reg.recordCount(), 0);
    }

    // Checks-effects-interactions: when the reward arrives the agent tries to re-enter; it finds claimed == true.
    function test_reentrancyBlocked() public {
        Reenterer evil = new Reenterer();
        uint256[16] memory p = _pub(address(evil), TASK);
        mock.setExpected(p);
        bytes memory sig = _sign(reg, EVAL_KEY, address(evil), TASK, p);
        evil.go(reg, TASK, p, sig);
        assertTrue(evil.triedReentry());
        assertFalse(evil.reentrySucceeded());
        assertEq(evil.lastError(), "ALREADY_CLAIMED");
        assertEq(reg.recordCount(), 1);
        assertEq(address(evil).balance, REWARD); // paid exactly once
    }
}
