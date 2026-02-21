// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ShadowBidVault
 * @notice Manages complete lifecycle of a confidential auction on ADI Chain
 * @dev Commit-Reveal mechanism with deposits and non-reveal penalties
 *
 * PHASES:
 * 1. OPEN      - Suppliers submit commits (encrypted hash + 0G Storage rootHash)
 * 2. REVEAL    - Suppliers reveal price (verified against commit hash)
 * 3. SETTLED   - Atomic settlement, winner designated, deposits redistributed
 * 4. CANCELLED - Auction cancelled by buyer, all deposits refunded
 */
contract ShadowBidVault is AccessControl, ReentrancyGuard {
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");
    bytes32 public constant SUPPLIER_ROLE = keccak256("SUPPLIER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // ── Metadata ─────────────────────────────────────────────────────
    address public immutable buyer;
    string public title;
    string public description;
    string public buyerECIESPubKey;
    uint256 public immutable closeTime;
    uint256 public immutable revealDeadline;
    uint256 public immutable depositRequired;

    // ── State ─────────────────────────────────────────────────────────
    enum Phase { OPEN, REVEAL, SETTLED, CANCELLED }
    Phase public phase;

    struct Bid {
        bytes32 commitHash;
        string storageRoot;
        uint256 revealedPrice;
        bool revealed;
        bool depositPaid;
        bool depositReturned;
    }

    address[] public suppliers;
    mapping(address => Bid) public bids;

    address public winner;
    uint256 public winningPrice;

    // ── Events ────────────────────────────────────────────────────────
    event BidCommitted(address indexed supplier, bytes32 commitHash, string storageRoot);
    event BidUpdated(address indexed supplier, bytes32 newCommitHash, string newStorageRoot);
    event PhaseChanged(Phase newPhase);
    event BidRevealed(address indexed supplier, uint256 price);
    event BidDisqualified(address indexed supplier, string reason);
    event DepositSlashed(address indexed supplier, uint256 amount, address recipient);
    event DepositReturned(address indexed supplier, uint256 amount);
    event WinnerSelected(address indexed winner, uint256 price, uint256 totalBids);
    event AuctionCancelled(uint256 refundCount);

    constructor(
        address _buyer,
        string memory _title,
        string memory _description,
        uint256 _closeTime,
        uint256 _revealWindow,
        uint256 _depositRequired,
        address[] memory _allowedSuppliers,
        address _auditor,
        string memory _buyerECIESPubKey
    ) {
        buyer = _buyer;
        title = _title;
        description = _description;
        closeTime = _closeTime;
        revealDeadline = _closeTime + _revealWindow;
        depositRequired = _depositRequired;
        buyerECIESPubKey = _buyerECIESPubKey;
        phase = Phase.OPEN;

        _grantRole(DEFAULT_ADMIN_ROLE, _buyer);
        _grantRole(BUYER_ROLE, _buyer);

        for (uint i = 0; i < _allowedSuppliers.length; i++) {
            _grantRole(SUPPLIER_ROLE, _allowedSuppliers[i]);
        }
        if (_auditor != address(0)) {
            _grantRole(AUDITOR_ROLE, _auditor);
        }
    }

    // ── PHASE OPEN: COMMIT ────────────────────────────────────────────

    /**
     * @param _commitHash  keccak256(abi.encodePacked(price, salt, msg.sender))
     * @param _storageRoot Merkle rootHash from 0G Storage of the encrypted ECIES offer
     */
    function commitBid(bytes32 _commitHash, string calldata _storageRoot)
        external
        payable
        onlyRole(SUPPLIER_ROLE)
    {
        require(phase == Phase.OPEN, "Not in OPEN phase");
        require(block.timestamp < closeTime, "Auction has closed");
        require(msg.value == depositRequired, "Incorrect deposit amount");
        require(bids[msg.sender].commitHash == 0, "Already committed");
        require(_commitHash != bytes32(0), "Invalid commit hash");
        require(bytes(_storageRoot).length > 0, "Storage root required");

        bids[msg.sender] = Bid({
            commitHash: _commitHash,
            storageRoot: _storageRoot,
            revealedPrice: 0,
            revealed: false,
            depositPaid: true,
            depositReturned: false
        });
        suppliers.push(msg.sender);

        emit BidCommitted(msg.sender, _commitHash, _storageRoot);
    }

    /**
     * @notice Update an existing committed bid while the auction is still open
     * @param _newCommitHash  New keccak256(abi.encodePacked(price, salt, msg.sender))
     * @param _newStorageRoot New Merkle root from 0G Storage
     */
    function updateBid(bytes32 _newCommitHash, string calldata _newStorageRoot)
        external
        onlyRole(SUPPLIER_ROLE)
    {
        require(phase == Phase.OPEN, "Not in OPEN phase");
        require(block.timestamp < closeTime, "Auction has closed");
        Bid storage bid = bids[msg.sender];
        require(bid.commitHash != bytes32(0), "No existing bid to update");
        require(!bid.revealed, "Cannot update revealed bid");
        require(_newCommitHash != bytes32(0), "Invalid commit hash");
        require(bytes(_newStorageRoot).length > 0, "Storage root required");

        bid.commitHash = _newCommitHash;
        bid.storageRoot = _newStorageRoot;
        emit BidUpdated(msg.sender, _newCommitHash, _newStorageRoot);
    }

    // ── TRANSITION OPEN → REVEAL ──────────────────────────────────────

    /**
     * @notice Can be called by anyone after closeTime
     */
    function triggerRevealPhase() external {
        require(block.timestamp >= closeTime, "Auction still open");
        require(phase == Phase.OPEN, "Not in OPEN phase");
        phase = Phase.REVEAL;
        emit PhaseChanged(Phase.REVEAL);
    }

    // ── PHASE REVEAL ─────────────────────────────────────────────────

    /**
     * @param _price Price in wei (EUR represented in wei for demo)
     * @param _salt  Random bytes32 value used during commit
     */
    function revealBid(uint256 _price, bytes32 _salt)
        external
        onlyRole(SUPPLIER_ROLE)
    {
        require(phase == Phase.REVEAL, "Not in REVEAL phase");
        require(block.timestamp <= revealDeadline, "Reveal window closed");
        Bid storage bid = bids[msg.sender];
        require(bid.commitHash != bytes32(0), "No commit found");
        require(!bid.revealed, "Already revealed");

        bytes32 expectedHash = keccak256(abi.encodePacked(_price, _salt, msg.sender));
        require(expectedHash == bid.commitHash, "Hash mismatch: invalid reveal");

        bid.revealedPrice = _price;
        bid.revealed = true;

        emit BidRevealed(msg.sender, _price);
    }

    // ── SETTLEMENT ────────────────────────────────────────────────────

    function settle() external nonReentrant {
        require(msg.sender == buyer, "Only buyer can settle");
        require(block.timestamp > revealDeadline, "Reveal window not closed");
        require(phase == Phase.REVEAL, "Not in REVEAL phase");
        require(suppliers.length > 0, "No bidders");

        phase = Phase.SETTLED;
        emit PhaseChanged(Phase.SETTLED);

        address bestSupplier = address(0);
        uint256 bestPrice = type(uint256).max;
        uint256 validCount = 0;

        // Step 1: Slash non-revealers + find best price
        for (uint i = 0; i < suppliers.length; i++) {
            address s = suppliers[i];
            Bid storage bid = bids[s];

            if (!bid.revealed) {
                bid.depositReturned = true;
                (bool ok,) = payable(buyer).call{value: depositRequired}("");
                require(ok, "Slash transfer failed");
                emit DepositSlashed(s, depositRequired, buyer);
                emit BidDisqualified(s, "Did not reveal within window");
                continue;
            }

            validCount++;
            if (bid.revealedPrice < bestPrice) {
                bestPrice = bid.revealedPrice;
                bestSupplier = s;
            }
        }

        require(bestSupplier != address(0), "No valid bids after reveal");

        winner = bestSupplier;
        winningPrice = bestPrice;

        // Step 2: Refund losers who revealed
        for (uint i = 0; i < suppliers.length; i++) {
            address s = suppliers[i];
            Bid storage bid = bids[s];
            if (s != bestSupplier && bid.revealed && !bid.depositReturned) {
                bid.depositReturned = true;
                (bool ok,) = payable(s).call{value: depositRequired}("");
                require(ok, "Refund transfer failed");
                emit DepositReturned(s, depositRequired);
            }
        }

        // Refund winner's deposit too
        Bid storage winnerBid = bids[bestSupplier];
        if (!winnerBid.depositReturned) {
            winnerBid.depositReturned = true;
            (bool ok,) = payable(bestSupplier).call{value: depositRequired}("");
            require(ok, "Winner deposit refund failed");
            emit DepositReturned(bestSupplier, depositRequired);
        }

        emit WinnerSelected(bestSupplier, bestPrice, validCount);
    }

    // ── CANCELLATION ──────────────────────────────────────────────────

    function cancel() external nonReentrant {
        require(msg.sender == buyer, "Only buyer can cancel");
        require(phase == Phase.OPEN, "Can only cancel in OPEN phase");

        phase = Phase.CANCELLED;
        emit PhaseChanged(Phase.CANCELLED);

        uint256 refunded = 0;
        for (uint i = 0; i < suppliers.length; i++) {
            address s = suppliers[i];
            if (bids[s].depositPaid && !bids[s].depositReturned) {
                bids[s].depositReturned = true;
                (bool ok,) = payable(s).call{value: depositRequired}("");
                require(ok, "Cancel refund failed");
                refunded++;
                emit DepositReturned(s, depositRequired);
            }
        }
        emit AuctionCancelled(refunded);
    }

    // ── AUDIT (read-only, AUDITOR_ROLE only) ──────────────────────────

    function getAuditData() external view onlyRole(AUDITOR_ROLE) returns (
        address[] memory _suppliers,
        bytes32[] memory _hashes,
        string[] memory _storageRoots,
        uint256[] memory _prices,
        bool[] memory _revealed
    ) {
        uint256 n = suppliers.length;
        _suppliers = suppliers;
        _hashes = new bytes32[](n);
        _storageRoots = new string[](n);
        _prices = new uint256[](n);
        _revealed = new bool[](n);

        for (uint i = 0; i < n; i++) {
            Bid storage b = bids[suppliers[i]];
            _hashes[i] = b.commitHash;
            _storageRoots[i] = b.storageRoot;
            _prices[i] = b.revealedPrice;
            _revealed[i] = b.revealed;
        }
    }

    // ── VIEW HELPERS ──────────────────────────────────────────────────

    function getSuppliers() external view returns (address[] memory) {
        return suppliers;
    }

    function getBidCount() external view returns (uint256) {
        return suppliers.length;
    }

    function getCurrentPhase() external view returns (Phase) {
        if (phase == Phase.OPEN && block.timestamp >= closeTime) return Phase.REVEAL;
        return phase;
    }

    function getTimeToClose() external view returns (uint256) {
        if (block.timestamp >= closeTime) return 0;
        return closeTime - block.timestamp;
    }

    receive() external payable {}
}
