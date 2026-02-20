// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockOracle
 * @notice Simplified oracle for testnet — accepts all proofs
 * @dev In production, use official 0G oracle with TEE/ZKP
 */
contract MockOracle {
    function verifyProof(bytes calldata) external pure returns (bool) {
        return true;
    }
}
