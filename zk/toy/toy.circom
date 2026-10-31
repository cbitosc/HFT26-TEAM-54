pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";

// Toy circuit: proves a < b, where both are 8-bit numbers (0..255).
template Toy() {
    signal input a;
    signal input b;

    component lt = LessThan(8);
    lt.in[0] <== a;
    lt.in[1] <== b;

    // LessThan outputs 1 when a < b, else 0. This forces it to be 1.
    lt.out === 1;
}

component main {public [a, b]} = Toy();
