// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ShadowBidVault.sol";

/**
 * @title ShadowBidFactory
 * @notice Deployed on ADI Chain (Chain ID 36900 mainnet / 99999 testnet)
 * @dev Factory that creates ShadowBidVault instances and manages global registry
 */
contract ShadowBidFactory is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");

    address[] public allVaults;
    mapping(address => bool) public isVault;
    mapping(address => address[]) public vaultsByBuyer;

    event VaultCreated(
        address indexed vault,
        address indexed buyer,
        string title,
        uint256 closeTime,
        uint256 depositRequired
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BUYER_ROLE, msg.sender);
    }

    /**
     * @param _title            Auction title
     * @param _description      Full description
     * @param _closeTime        Unix timestamp for close (must be > block.timestamp + 300)
     * @param _revealWindow     Reveal window duration in seconds (min: 3600)
     * @param _depositRequired  Deposit amount in wei (native ADI)
     * @param _allowedSuppliers Whitelisted supplier addresses
     * @param _auditor          Auditor address (0x0 if none)
     * @param _buyerECIESPubKey ECIES public key hex for supplier encryption
     */
    function createVault(
        string calldata _title,
        string calldata _description,
        uint256 _closeTime,
        uint256 _revealWindow,
        uint256 _depositRequired,
        address[] calldata _allowedSuppliers,
        address _auditor,
        string calldata _buyerECIESPubKey
    ) external onlyRole(BUYER_ROLE) returns (address vaultAddr) {
        require(_closeTime > block.timestamp + 300, "closeTime must be > now + 5min");
        require(_revealWindow >= 3600, "revealWindow must be >= 1h");
        require(_allowedSuppliers.length >= 1, "At least 1 supplier required");

        ShadowBidVault vault = new ShadowBidVault(
            msg.sender,
            _title,
            _description,
            _closeTime,
            _revealWindow,
            _depositRequired,
            _allowedSuppliers,
            _auditor,
            _buyerECIESPubKey
        );

        vaultAddr = address(vault);
        allVaults.push(vaultAddr);
        isVault[vaultAddr] = true;
        vaultsByBuyer[msg.sender].push(vaultAddr);

        emit VaultCreated(vaultAddr, msg.sender, _title, _closeTime, _depositRequired);
    }

    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }

    function getVaultsByBuyer(address b) external view returns (address[] memory) {
        return vaultsByBuyer[b];
    }

    function grantBuyerRole(address account) external onlyRole(ADMIN_ROLE) {
        _grantRole(BUYER_ROLE, account);
    }

    function revokeBuyerRole(address account) external onlyRole(ADMIN_ROLE) {
        _revokeRole(BUYER_ROLE, account);
    }
}
