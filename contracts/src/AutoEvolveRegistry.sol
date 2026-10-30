// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// The generated Groth16 verifier (zk/out/Verifier.sol) takes the 16 public signals of PLAN.md 3.5.
interface IVerifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[16] calldata pubSignals
    ) external view returns (bool);
}

/// The referee and the piggy bank: pays an agent only for a verified, signed, unclaimed improvement,
/// and records the IPFS CID + snapshot hash publicly so other agents can inherit the memory.
contract AutoEvolveRegistry is Ownable {
    struct Record {
        uint256 taskId;
        address agent;
        string cid;
        uint256 snapshotHash;
        uint256 promptCommitment;
        uint256[3] scores;
        uint64 timestamp;
    }

    IVerifier public immutable verifier;
    address public immutable evaluator; // address(0) = signature check skipped (documented fallback mode)
    uint256 public immutable rewardWei;

    // Fixed scoring formula, same weights as inside the circuit: [tests_passed, edge_cases, lint, simplicity]
    uint256 internal constant W0 = 50;
    uint256 internal constant W1 = 20;
    uint256 internal constant W2 = 15;
    uint256 internal constant W3 = 15;

    mapping(uint256 => bytes32) public testSuiteHash; // taskId => keccak(raw tests.json)
    mapping(uint256 => mapping(address => bool)) public claimed; // taskId => agent => paid already?
    Record[] internal records;

    event TaskRegistered(uint256 indexed taskId, bytes32 testSuiteHash);
    event Funded(address indexed from, uint256 amount);
    event ImprovementVerified(
        uint256 indexed recordId,
        uint256 indexed taskId,
        address indexed agent,
        string cid,
        uint256 snapshotHash,
        uint256[3] scores,
        uint256 rewardWei
    );

    constructor(address verifier_, address evaluator_, uint256 rewardWei_) Ownable(msg.sender) {
        verifier = IVerifier(verifier_);
        evaluator = evaluator_;
        rewardWei = rewardWei_;
    }

    /// Owner pins which hidden test suite counts for a task. May overwrite.
    function registerTask(uint256 taskId, bytes32 testSuiteHash_) external onlyOwner {
        testSuiteHash[taskId] = testSuiteHash_;
        emit TaskRegistered(taskId, testSuiteHash_);
    }

    /// Top up the reward escrow.
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function submit(
        uint256 taskId,
        string calldata cid,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[16] calldata pub,
        bytes calldata evaluatorSig
    ) external returns (uint256 recordId) {
        // 1. Only tasks the owner registered (with a pinned hidden test suite) can pay out.
        bytes32 suite = testSuiteHash[taskId];
        require(suite != bytes32(0), "UNKNOWN_TASK");
        // 2. The proof must be about THIS task, not a proof for an easier one.
        require(pub[15] == taskId, "TASK_MISMATCH");
        // 3. The proof is bound to the wallet inside it: a copied proof sent from another wallet fails (anti front-running).
        require(pub[14] == uint256(uint160(msg.sender)), "NOT_AGENT");
        // 4. One reward per agent per task (anti replay).
        require(!claimed[taskId][msg.sender], "ALREADY_CLAIMED");
        // 5. The ZK proof: metrics in range, fixed weights, S1 < S2 < S3, prover knows the secret prompt.
        require(verifier.verifyProof(pA, pB, pC, pub), "BAD_PROOF");
        // 6. The named evaluator signed these exact metrics (the agent cannot invent its own scores).
        if (evaluator != address(0)) {
            require(_evaluatorOk(taskId, pub, suite, evaluatorSig), "BAD_EVALUATOR_SIG");
        }
        // 7. Make sure the escrow can pay.
        require(address(this).balance >= rewardWei, "ESCROW_EMPTY");

        // Effects BEFORE interaction (checks-effects-interactions): a re-entering agent finds claimed == true.
        claimed[taskId][msg.sender] = true;
        recordId = records.length;
        uint256[3] memory scores = _scores(pub);
        records.push(
            Record({
                taskId: taskId,
                agent: msg.sender,
                cid: cid,
                snapshotHash: pub[13],
                promptCommitment: pub[12],
                scores: scores,
                timestamp: uint64(block.timestamp)
            })
        );
        emit ImprovementVerified(recordId, taskId, msg.sender, cid, pub[13], scores, rewardWei);

        (bool ok,) = msg.sender.call{value: rewardWei}("");
        require(ok, "PAY_FAILED");
    }

    function recordCount() external view returns (uint256) {
        return records.length;
    }

    function getRecord(uint256 id) external view returns (Record memory) {
        return records[id];
    }

    /// Exactly the digest PLAN.md 3.6 / attest/sign.py build:
    /// keccak256(abi.encode(chainId, registry, taskId, agent, uint256[12] metrics, snapshotHash, testSuiteHash))
    function evaluatorDigest(uint256 taskId, address agent, uint256[16] calldata pub, bytes32 suite)
        public
        view
        returns (bytes32)
    {
        uint256[12] memory metrics;
        for (uint256 i = 0; i < 12; i++) {
            metrics[i] = pub[i];
        }
        return keccak256(abi.encode(block.chainid, address(this), taskId, agent, metrics, pub[13], suite));
    }

    function _evaluatorOk(uint256 taskId, uint256[16] calldata pub, bytes32 suite, bytes calldata sig)
        internal
        view
        returns (bool)
    {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(evaluatorDigest(taskId, msg.sender, pub, suite));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
        return err == ECDSA.RecoverError.NoError && signer == evaluator;
    }

    function _scores(uint256[16] calldata pub) internal pure returns (uint256[3] memory s) {
        for (uint256 v = 0; v < 3; v++) {
            uint256 o = v * 4;
            s[v] = W0 * pub[o] + W1 * pub[o + 1] + W2 * pub[o + 2] + W3 * pub[o + 3];
        }
    }
}
