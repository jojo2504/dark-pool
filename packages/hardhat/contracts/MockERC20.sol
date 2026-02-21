// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC-20 used only in Hardhat tests as a stand-in for DDSC.
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock DDSC", "mDDSC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
