// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IShadowBidFactory {
    function verified(address) external view returns (bool);
    function isAccredited(address) external view returns (bool);
    function affiliatedWith(address) external view returns (address);
}

/**
 * @title ShadowBidVault
 * @notice Sealed-bid RWA auction with institutional compliance on ADI Chain
 *
 * SECURITY FEATURES:
 * - KYB/AML: All bidders must be factory-verified institutions
 * - Creator bond: Auction opener posts 0.5% of asset value as anti-fraud bond
 * - Conflict attestation: EIP-712 signed declaration before bidding
 * - Second-bidder fallback: If winner defaults, second-place takes over
 * - Oracle delivery: Real-world asset transfer confirmed by trusted oracle
 * - Payment escrow: Winner's full payment held until delivery confirmed
 * - Admin pause: Emergency halt for compliance incidents
 */
contract ShadowBidVault is ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // ─── Platform ─────────────────────────────────────────────────────────────
    IShadowBidFactory public immutable factory;
    address public platformAdmin;
    bool public paused;

    // ─── Auction Creator ──────────────────────────────────────────────────────
    address public immutable buyer;

    // ─── Metadata ─────────────────────────────────────────────────────────────
    string public title;
    string public description;
    string public buyerECIESPubKey;
    bytes32 public assetProofHash;
    uint256 public declaredAssetValue;

    // ─── Timing ───────────────────────────────────────────────────────────────
    uint256 public immutable closeTime;
    uint256 public immutable revealDeadline;
    uint256 public immutable depositRequired;
    uint256 public biddingStartTime;

    // ─── Jurisdiction & Accreditation ─────────────────────────────────────────
    bool public requiresAccreditation;
    string[] public allowedJurisdictions;

    // ─── Settlement ───────────────────────────────────────────────────────────
    address public settlementToken;
    uint256 public settlementWindow;
    uint256 public settlementDeadline;
    uint256 public settlementTime;
    bool public paymentSubmitted;

    // ─── Oracle ───────────────────────────────────────────────────────────────
    address public oracle;
    bool public delivered;
    uint256 public oracleTimeout;

    // ─── Creator Bond ─────────────────────────────────────────────────────────
    uint256 public creatorBond;
    uint256 public bondReleaseTime;
    bool public bondSlashed;

    // ─── Tokenized Asset ──────────────────────────────────────────────────────
    address public assetTokenContract;
    uint256 public assetTokenId;
    bool public assetTokenEscrowed;

    // ─── Auction State ────────────────────────────────────────────────────────
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
    mapping(address => bool) public isAllowedSupplier;
    mapping(address => Bid) public bids;
    mapping(address => bool) public conflictAttestationSubmitted;

    address public winner;
    uint256 public winningPrice;
    uint256 public winningBidAmount;
    address public secondBidder;
    uint256 public secondBidAmount;

    // ─── EIP-712 Type Hash ────────────────────────────────────────────────────
    bytes32 private constant CONFLICT_ATTESTATION_TYPEHASH =
        keccak256("ConflictAttestation(address bidder,address vault,string statement,uint256 timestamp)");

    // ─── Events ───────────────────────────────────────────────────────────────
    event BidCommitted(address indexed supplier, bytes32 commitHash, string storageRoot);
    event PhaseChanged(Phase newPhase);
    event BidRevealed(address indexed supplier, uint256 price);
    event BidDisqualified(address indexed supplier, string reason);
    event DepositSlashed(address indexed supplier, uint256 amount, address recipient);
    event DepositReturned(address indexed supplier, uint256 amount);
    event WinnerSelected(address indexed winner, uint256 price, uint256 totalBids);
    event SecondBidderTracked(address indexed secondBidder, uint256 price);
    event AuctionCancelled(uint256 refundCount);
    event ConflictAttestationSubmitted(address indexed bidder);
    event PaymentSubmitted(address indexed winner, uint256 amount);
    event DeliveryConfirmed(address indexed oracle, uint256 timestamp);
    event DeliveryDisputed(address indexed winner, uint256 timestamp);
    event OracleTimedOut(uint256 timestamp);
    event FallbackActivated(address indexed secondBidder, uint256 amount);
    event CreatorBondSlashed(address indexed victim, uint256 victimShare, uint256 burned);
    event CreatorBondReleased(address indexed creator, uint256 amount);
    event OracleUpdated(address indexed newOracle);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == platformAdmin, "Not admin");
        _;
    }

    modifier onlyVerified() {
        require(factory.verified(msg.sender), "Institution not KYB-verified");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier biddingOpen() {
        require(block.timestamp >= biddingStartTime, "Asset review window still active");
        require(block.timestamp < closeTime, "Auction has closed");
        _;
    }

    modifier onlyAccreditedIfRequired() {
        if (requiresAccreditation) {
            require(factory.isAccredited(msg.sender), "Accreditation required");
        }
        _;
    }

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Not the auction creator");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _factory,
        address _platformAdmin,
        address _oracle,
        bytes32 _assetProofHash,
        uint256 _declaredAssetValue,
        address _assetTokenContract,
        uint256 _assetTokenId,
        bool _requiresAccreditation,
        string[] memory _allowedJurisdictions,
        address _settlementToken,
        uint256 _settlementWindow,
        uint256 _oracleTimeout,
        address _buyer,
        string memory _title,
        string memory _description,
        uint256 _closeTime,
        uint256 _revealWindow,
        uint256 _depositRequired,
        address[] memory _allowedSuppliers,
        string memory _buyerECIESPubKey,
        uint256 _reviewWindowSeconds
    ) payable EIP712("DarkPool", "1") {
        if (_declaredAssetValue > 0) {
            uint256 requiredBond = (_declaredAssetValue * 5) / 1000;
            if (requiredBond < 0.01 ether) requiredBond = 0.01 ether;
            require(msg.value >= requiredBond, "Insufficient creator bond");
        }

        factory = IShadowBidFactory(_factory);
        platformAdmin = _platformAdmin;
        oracle = _oracle;
        assetProofHash = _assetProofHash;
        declaredAssetValue = _declaredAssetValue;
        requiresAccreditation = _requiresAccreditation;
        allowedJurisdictions = _allowedJurisdictions;
        settlementToken = _settlementToken;
        settlementWindow = _settlementWindow > 0 ? _settlementWindow : 48 hours;
        oracleTimeout = _oracleTimeout > 0 ? _oracleTimeout : 30 days;
        creatorBond = msg.value;
        buyer = _buyer;
        title = _title;
        description = _description;
        closeTime = _closeTime;
        revealDeadline = _closeTime + _revealWindow;
        depositRequired = _depositRequired;
        buyerECIESPubKey = _buyerECIESPubKey;
        biddingStartTime = block.timestamp + _reviewWindowSeconds;
        phase = Phase.OPEN;

        for (uint256 i = 0; i < _allowedSuppliers.length; i++) {
            isAllowedSupplier[_allowedSuppliers[i]] = true;
        }

        if (_assetTokenContract != address(0)) {
            assetTokenContract = _assetTokenContract;
            assetTokenId = _assetTokenId;
            IERC721(_assetTokenContract).transferFrom(_buyer, address(this), _assetTokenId);
            assetTokenEscrowed = true;
        }
    }

    // ─── Conflict Attestation ─────────────────────────────────────────────────

    function submitConflictAttestation(uint256 timestamp, bytes calldata sig) external {
        require(timestamp >= block.timestamp - 1 hours, "Attestation timestamp too old");
        bytes32 hash = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CONFLICT_ATTESTATION_TYPEHASH,
                    msg.sender,
                    address(this),
                    keccak256(bytes("I confirm I am not affiliated with the auction creator and have no conflict of interest.")),
                    timestamp
                )
            )
        );
        address signer = ECDSA.recover(hash, sig);
        require(signer == msg.sender, "Invalid attestation signature");
        conflictAttestationSubmitted[msg.sender] = true;
        emit ConflictAttestationSubmitted(msg.sender);
    }

    // ─── Phase OPEN: Commit ───────────────────────────────────────────────────

    function commitBid(bytes32 _commitHash, string calldata _storageRoot)
        external payable notPaused biddingOpen onlyVerified onlyAccreditedIfRequired nonReentrant
    {
        require(isAllowedSupplier[msg.sender], "Not a whitelisted supplier");
        require(msg.sender != buyer, "Auction creator cannot bid");
        require(factory.affiliatedWith(msg.sender) != buyer, "Affiliated address cannot bid");
        require(conflictAttestationSubmitted[msg.sender], "Conflict attestation required");
        require(phase == Phase.OPEN, "Not in OPEN phase");
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

    // ─── Transition OPEN -> REVEAL ────────────────────────────────────────────

    function triggerRevealPhase() external notPaused {
        require(block.timestamp >= closeTime, "Auction still open");
        require(phase == Phase.OPEN, "Not in OPEN phase");
        phase = Phase.REVEAL;
        emit PhaseChanged(Phase.REVEAL);
    }

    // ─── Phase REVEAL ─────────────────────────────────────────────────────────

    function revealBid(uint256 _price, bytes32 _salt) external notPaused nonReentrant {
        require(isAllowedSupplier[msg.sender], "Not a whitelisted supplier");
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

    // ─── Settlement ───────────────────────────────────────────────────────────

    function settle() external nonReentrant notPaused onlyBuyer {
        require(block.timestamp > revealDeadline, "Reveal window not closed");
        require(phase == Phase.REVEAL, "Not in REVEAL phase");
        require(suppliers.length > 0, "No bidders");

        phase = Phase.SETTLED;
        emit PhaseChanged(Phase.SETTLED);

        address bestSupplier = address(0);
        uint256 bestPrice = type(uint256).max;
        address _secondBidder = address(0);
        uint256 _secondPrice = type(uint256).max;
        uint256 validCount = 0;

        for (uint256 i = 0; i < suppliers.length; i++) {
            address s = suppliers[i];
            Bid storage bid = bids[s];
            if (!bid.revealed) {
                bid.depositReturned = true;
                (bool ok, ) = payable(buyer).call{ value: depositRequired }("");
                require(ok, "Slash transfer failed");
                emit DepositSlashed(s, depositRequired, buyer);
                emit BidDisqualified(s, "Did not reveal within window");
                continue;
            }
            validCount++;
            if (bid.revealedPrice < bestPrice) {
                if (bestSupplier != address(0)) {
                    _secondBidder = bestSupplier;
                    _secondPrice = bestPrice;
                }
                bestPrice = bid.revealedPrice;
                bestSupplier = s;
            } else if (bid.revealedPrice < _secondPrice) {
                _secondBidder = s;
                _secondPrice = bid.revealedPrice;
            }
        }

        require(bestSupplier != address(0), "No valid bids after reveal");

        winner = bestSupplier;
        winningPrice = bestPrice;
        winningBidAmount = bestPrice;

        if (_secondBidder != address(0)) {
            secondBidder = _secondBidder;
            secondBidAmount = _secondPrice;
            emit SecondBidderTracked(_secondBidder, _secondPrice);
        }

        settlementTime = block.timestamp;
        settlementDeadline = block.timestamp + settlementWindow;

        for (uint256 i = 0; i < suppliers.length; i++) {
            address s = suppliers[i];
            Bid storage bid = bids[s];
            if (bid.revealed && !bid.depositReturned) {
                bid.depositReturned = true;
                (bool ok, ) = payable(s).call{ value: depositRequired }("");
                require(ok, "Deposit refund failed");
                emit DepositReturned(s, depositRequired);
            }
        }

        emit WinnerSelected(bestSupplier, bestPrice, validCount);
    }

    // ─── Payment Submission ───────────────────────────────────────────────────

    function submitPayment() external payable nonReentrant notPaused {
        require(msg.sender == winner, "Not the winner");
        require(!paymentSubmitted, "Payment already submitted");
        require(block.timestamp <= settlementDeadline, "Settlement window expired");

        if (settlementToken == address(0)) {
            require(msg.value == winningBidAmount, "Wrong ETH amount");
        } else {
            require(msg.value == 0, "Send ERC-20, not ETH");
            IERC20(settlementToken).transferFrom(msg.sender, address(this), winningBidAmount);
        }

        paymentSubmitted = true;
        emit PaymentSubmitted(msg.sender, winningBidAmount);
    }

    // ─── Oracle Delivery Confirmation ─────────────────────────────────────────

    function confirmDelivery() external nonReentrant onlyOracle {
        require(paymentSubmitted, "Payment not in escrow");
        require(!delivered, "Delivery already confirmed");

        delivered = true;
        bondReleaseTime = block.timestamp + 72 hours;
        _releasePaymentToCreator();

        if (assetTokenEscrowed && assetTokenContract != address(0)) {
            IERC721(assetTokenContract).transferFrom(address(this), winner, assetTokenId);
            assetTokenEscrowed = false;
        }

        emit DeliveryConfirmed(msg.sender, block.timestamp);
    }

    function _releasePaymentToCreator() internal {
        uint256 amount = winningBidAmount;
        winningBidAmount = 0;
        if (settlementToken == address(0)) {
            (bool ok, ) = payable(buyer).call{ value: amount }("");
            require(ok, "Payment release failed");
        } else {
            IERC20(settlementToken).transfer(buyer, amount);
        }
    }

    function disputeDelivery() external {
        require(msg.sender == winner, "Not winner");
        require(!delivered, "Already confirmed as delivered");
        require(paymentSubmitted, "No payment in escrow");
        paused = true;
        emit DeliveryDisputed(winner, block.timestamp);
    }

    function claimOracleTimeout() external nonReentrant {
        require(msg.sender == winner, "Not winner");
        require(paymentSubmitted, "No payment to reclaim");
        require(!delivered, "Already delivered");
        require(block.timestamp > settlementTime + oracleTimeout, "Oracle timeout not reached");

        uint256 amount = winningBidAmount;
        winningBidAmount = 0;
        paymentSubmitted = false;

        if (settlementToken == address(0)) {
            (bool ok, ) = payable(winner).call{ value: amount }("");
            require(ok, "Reclaim failed");
        } else {
            IERC20(settlementToken).transfer(winner, amount);
        }

        emit OracleTimedOut(block.timestamp);
    }

    // ─── Buyer Default ────────────────────────────────────────────────────────

    function claimBuyerDefault() external onlyBuyer {
        require(!paymentSubmitted, "Payment was submitted");
        require(block.timestamp > settlementDeadline, "Settlement window still open");
        require(phase == Phase.SETTLED, "Not settled");
        emit DepositSlashed(winner, 0, buyer);
        if (secondBidder != address(0)) {
            winner = secondBidder;
            winningBidAmount = secondBidAmount;
            secondBidder = address(0);
            settlementDeadline = block.timestamp + settlementWindow;
            emit FallbackActivated(winner, winningBidAmount);
        }
    }

    // ─── Creator Bond ─────────────────────────────────────────────────────────

    function slashCreatorBond(address victim) external onlyAdmin {
        require(!bondSlashed, "Bond already slashed");
        bondSlashed = true;
        uint256 bond = creatorBond;
        creatorBond = 0;
        uint256 victimShare = (bond * 80) / 100;
        uint256 burnShare = bond - victimShare;
        (bool ok1, ) = payable(victim).call{ value: victimShare }("");
        require(ok1, "Victim transfer failed");
        (bool ok2, ) = payable(address(0xdead)).call{ value: burnShare }("");
        require(ok2, "Burn transfer failed");
        emit CreatorBondSlashed(victim, victimShare, burnShare);
    }

    function releaseCreatorBond() external onlyBuyer {
        require(delivered, "Delivery not confirmed");
        require(block.timestamp >= bondReleaseTime, "Bond release time not reached");
        require(!bondSlashed, "Bond was slashed");
        uint256 bond = creatorBond;
        creatorBond = 0;
        (bool ok, ) = payable(buyer).call{ value: bond }("");
        require(ok, "Bond release failed");
        emit CreatorBondReleased(buyer, bond);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function pause() external onlyAdmin { paused = true; }
    function unpause() external onlyAdmin { paused = false; }

    function updateOracle(address newOracle) external onlyAdmin {
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    // ─── Cancellation ─────────────────────────────────────────────────────────

    function cancel() external nonReentrant onlyBuyer {
        require(phase == Phase.OPEN, "Can only cancel in OPEN phase");
        phase = Phase.CANCELLED;
        emit PhaseChanged(Phase.CANCELLED);

        uint256 refunded = 0;
        for (uint256 i = 0; i < suppliers.length; i++) {
            address s = suppliers[i];
            if (bids[s].depositPaid && !bids[s].depositReturned) {
                bids[s].depositReturned = true;
                (bool ok, ) = payable(s).call{ value: depositRequired }("");
                require(ok, "Cancel refund failed");
                refunded++;
                emit DepositReturned(s, depositRequired);
            }
        }

        if (creatorBond > 0 && !bondSlashed) {
            uint256 bond = creatorBond;
            creatorBond = 0;
            (bool ok, ) = payable(buyer).call{ value: bond }("");
            require(ok, "Bond return failed");
        }

        emit AuctionCancelled(refunded);
    }

    // ─── Audit ────────────────────────────────────────────────────────────────

    function getAuditData() external view returns (
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
        for (uint256 i = 0; i < n; i++) {
            Bid storage b = bids[suppliers[i]];
            _hashes[i] = b.commitHash;
            _storageRoots[i] = b.storageRoot;
            _prices[i] = b.revealedPrice;
            _revealed[i] = b.revealed;
        }
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    function getSuppliers() external view returns (address[] memory) { return suppliers; }
    function getBidCount() external view returns (uint256) { return suppliers.length; }

    function getCurrentPhase() external view returns (Phase) {
        if (phase == Phase.OPEN && block.timestamp >= closeTime) return Phase.REVEAL;
        return phase;
    }

    function getTimeToClose() external view returns (uint256) {
        if (block.timestamp >= closeTime) return 0;
        return closeTime - block.timestamp;
    }

    function getAllowedJurisdictions() external view returns (string[] memory) {
        return allowedJurisdictions;
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    receive() external payable {}
}
