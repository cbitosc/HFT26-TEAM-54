pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";

// AutoEvolve circuit (PLAN.md section 3.5).
// Public signals, in order: m[0][0..3], m[1][0..3], m[2][0..3] (0-11),
// promptCommitment (12), snapshotHash (13), agentWallet (14), taskId (15).
// Private: promptHash, salt.
template AutoEvolve() {
    // ---- public inputs ----
    signal input m[3][4];
    signal input promptCommitment;
    signal input snapshotHash;
    signal input agentWallet;
    signal input taskId;

    // ---- private inputs ----
    signal input promptHash;
    signal input salt;

    // (1) every metric is an integer in 0..100.
    // Num2Bits(7) forces 0..127 (and so rules out "negative" field values);
    // LessEqThan(7) then forces <= 100.
    component bits[3][4];
    component le[3][4];
    for (var k = 0; k < 3; k++) {
        for (var j = 0; j < 4; j++) {
            bits[k][j] = Num2Bits(7);
            bits[k][j].in <== m[k][j];

            le[k][j] = LessEqThan(7);
            le[k][j].in[0] <== m[k][j];
            le[k][j].in[1] <== 100;
            le[k][j].out === 1;
        }
    }

    // (2) score = 50*m0 + 20*m1 + 15*m2 + 15*m3, weights are constants.
    var W[4] = [50, 20, 15, 15];
    signal S[3];
    for (var k = 0; k < 3; k++) {
        S[k] <== W[0] * m[k][0] + W[1] * m[k][1] + W[2] * m[k][2] + W[3] * m[k][3];
    }

    // (3) scores strictly increase: S1 < S2 < S3.
    // Max score is 100*100 = 10000 < 2^14, as LessThan(14) requires.
    component lt[2];
    for (var k = 0; k < 2; k++) {
        lt[k] = LessThan(14);
        lt[k].in[0] <== S[k];
        lt[k].in[1] <== S[k + 1];
        lt[k].out === 1;
    }

    // (4) we know the secret prompt behind the public commitment.
    component pos = Poseidon(2);
    pos.inputs[0] <== promptHash;
    pos.inputs[1] <== salt;
    pos.out === promptCommitment;

    // (5) bind snapshotHash, agentWallet, taskId to the proof.
    // A public input that appears in no constraint is not tied to the proof,
    // so each one goes into a (dummy) quadratic constraint.
    signal snapshotSq;
    signal walletSq;
    signal taskSq;
    snapshotSq <== snapshotHash * snapshotHash;
    walletSq <== agentWallet * agentWallet;
    taskSq <== taskId * taskId;
}

component main {public [m, promptCommitment, snapshotHash, agentWallet, taskId]} = AutoEvolve();
