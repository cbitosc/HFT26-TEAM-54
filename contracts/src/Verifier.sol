// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 11501561821079267160235675367192716095934568123846444725446596400659612510061;
    uint256 constant alphay  = 21630973719986041556329138250959445083759803719231285444376194521594940168992;
    uint256 constant betax1  = 1244286090301671608815750024644564550200265641853276123170625965973081378225;
    uint256 constant betax2  = 11272186600540544804877052265486663615144760561954997748990374745086366854835;
    uint256 constant betay1  = 16399389500664039245342213353514952105640269475187261885544007918599568202887;
    uint256 constant betay2  = 16906580235785873234854985877685170706582244842405653180152419476152153118088;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 9499010022270509360050061763841841046598655527786541446390435251153476605260;
    uint256 constant deltax2 = 3935152364741960191174881125022771668494351984214084205742818044690043228072;
    uint256 constant deltay1 = 10916703847598658188710746598711278228343571841471479032627167400168594847460;
    uint256 constant deltay2 = 9374654520520532422078862913730932430801258555085812963408228454943647349253;

    
    uint256 constant IC0x = 19339601455215369682692690527035151399332968141364949975747059529698030697763;
    uint256 constant IC0y = 12454149295917084318654209534766874166810361718212050300325940704392253159985;
    
    uint256 constant IC1x = 11562717329533895367302335146907162890366854236732583837590552655234501777964;
    uint256 constant IC1y = 16085257834559056689154192786405850562953719230052362481033749730256558943297;
    
    uint256 constant IC2x = 11128565782940870716425513355365779502299021588748550511347463458456490734499;
    uint256 constant IC2y = 8483970549369441232669380263919423176430517274239848900944849637505316989623;
    
    uint256 constant IC3x = 16420540317441408970566326314862665444833963472536856127790813248232967118272;
    uint256 constant IC3y = 19098649655935921336392287365133732831244521299489399843913183963851823023903;
    
    uint256 constant IC4x = 4876580538027459583035319839169259318190923936138658120276380011857385348131;
    uint256 constant IC4y = 2741923923711529769325457266981517993527342386894850737992882374082853106720;
    
    uint256 constant IC5x = 1085948573619597519154081704612499258378201345414055447950339835095421827311;
    uint256 constant IC5y = 20786684838834948636158786394946808518697600802026614401161974016609787370026;
    
    uint256 constant IC6x = 19989035747713892768090117581458804802989022468339318848609548115862314415252;
    uint256 constant IC6y = 9447936171425213821409339197153382142049296459728010891972695009517279779009;
    
    uint256 constant IC7x = 12854741840240834290015742292228176307756529448030323883449999434467209544915;
    uint256 constant IC7y = 8567573884340309966860090946271135711721795150545369266334460658593471000436;
    
    uint256 constant IC8x = 14404162671935015456470819749799112828961991338181145799746047076489347291294;
    uint256 constant IC8y = 4998092144634721556780595366463497544987072205655823402023275230477657114588;
    
    uint256 constant IC9x = 20948827237570834924472341632842126205767217002947937380548029287458355020631;
    uint256 constant IC9y = 5275211011226009079722546457553066941541890218236516259800391151487634779862;
    
    uint256 constant IC10x = 1139793801097623866413734272657358952748215812995757908418416711758594429468;
    uint256 constant IC10y = 10373439645232183124609859147107812852977768509291041407005105288746274956228;
    
    uint256 constant IC11x = 16787310125367282712358800358584057969737473699602015637946682310448630163305;
    uint256 constant IC11y = 13064825001308061986544260115138684621374252344724115379092258033207909734821;
    
    uint256 constant IC12x = 12594049230553734418351760713782684569633880269678748747093831319617166278403;
    uint256 constant IC12y = 18613593473955549333963740653826895007349029545302740558974001133653482350115;
    
    uint256 constant IC13x = 11243155434066364781761827360832945193414313004101270138369350611006361858971;
    uint256 constant IC13y = 16107576035029778549895606182321955584987457795743506046219898040873866250647;
    
    uint256 constant IC14x = 7439686277969214051095764092352537533597025169554385608914902763997123619993;
    uint256 constant IC14y = 1223101711468822988877109201117411959124177023874289240020440548476346256874;
    
    uint256 constant IC15x = 8884048398811778581169314449907387283893069776638500888649252089910569637452;
    uint256 constant IC15y = 19658510181462658273730763432758982909285299919095895733228810758471188955722;
    
    uint256 constant IC16x = 6051957549419281714930100995793015383689085276098604778754387376720067660682;
    uint256 constant IC16y = 15716050438803560140070982469891384816006681762343629428975077348845575009441;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[16] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
