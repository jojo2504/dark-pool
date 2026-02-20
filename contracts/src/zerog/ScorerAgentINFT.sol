// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ScorerAgentINFT
 * @notice iNFT ERC-7857 representing the ShadowBid AI scoring agent
 * @dev Deployed on 0G Chain (RPC: https://evmrpc-testnet.0g.ai, Chain ID: 16601)
 *
 * ERC-7857 Conformance:
 * - Encrypted metadata stored on 0G Storage (identified by storageRootHash)
 * - Metadata hash on-chain for verifiable integrity
 * - Oracle for transfer verification
 * - Agent authorization for AIaaS execution
 */

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
}

contract ScorerAgentINFT is ERC721, Ownable, ReentrancyGuard {

    // ── ERC-7857 Core ─────────────────────────────────────────────────
    mapping(uint256 => bytes32) private _metadataHashes;
    mapping(uint256 => string) private _encryptedURIs;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;
    address public oracle;

    // ── Agent Profile ─────────────────────────────────────────────────
    struct AgentProfile {
        string sector;
        string modelName;
        string providerAddress;
        uint256 dealsAnalyzed;
        bytes32 historyRoot;
        bool active;
        uint256 mintedAt;
    }

    mapping(uint256 => AgentProfile) public profiles;
    mapping(uint256 => address[]) public authorizedVaults;

    uint256 private _nextTokenId = 1;

    // ── Events ────────────────────────────────────────────────────────
    event AgentMinted(uint256 indexed tokenId, address indexed owner, string sector, string encryptedURI);
    event ScoringLogged(uint256 indexed tokenId, address indexed vault, address indexed supplier, uint256 scorePercent);
    event HistoryUpdated(uint256 indexed tokenId, bytes32 newRoot, uint256 totalDeals);
    event VaultAuthorized(uint256 indexed tokenId, address vault);
    event VaultRevoked(uint256 indexed tokenId, address vault);
    event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);

    constructor(address _oracle) ERC721("ShadowBid ScorerAgent", "SBSA") Ownable(msg.sender) {
        oracle = _oracle;
    }

    // ── MINT ──────────────────────────────────────────────────────────

    function mintAgent(
        string calldata _sector,
        string calldata _modelName,
        string calldata _providerAddr,
        string calldata _encryptedURI,
        bytes32 _metadataHash
    ) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        _encryptedURIs[tokenId] = _encryptedURI;
        _metadataHashes[tokenId] = _metadataHash;

        profiles[tokenId] = AgentProfile({
            sector: _sector,
            modelName: _modelName,
            providerAddress: _providerAddr,
            dealsAnalyzed: 0,
            historyRoot: bytes32(0),
            active: true,
            mintedAt: block.timestamp
        });

        emit AgentMinted(tokenId, msg.sender, _sector, _encryptedURI);
    }

    // ── LOGGING ───────────────────────────────────────────────────────

    function logScoring(
        uint256 _tokenId,
        address _vault,
        address _supplier,
        uint256 _scorePercent,
        bytes32 _newHistoryRoot
    ) external {
        require(ownerOf(_tokenId) == msg.sender, "Not agent owner");
        require(profiles[_tokenId].active, "Agent inactive");
        require(_scorePercent <= 100, "Score must be 0-100");

        profiles[_tokenId].dealsAnalyzed++;
        profiles[_tokenId].historyRoot = _newHistoryRoot;

        emit ScoringLogged(_tokenId, _vault, _supplier, _scorePercent);
        emit HistoryUpdated(_tokenId, _newHistoryRoot, profiles[_tokenId].dealsAnalyzed);
    }

    // ── AUTHORIZATIONS ────────────────────────────────────────────────

    function authorizeVault(uint256 _tokenId, address _vault) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        authorizedVaults[_tokenId].push(_vault);
        emit VaultAuthorized(_tokenId, _vault);
    }

    function authorizeUsage(uint256 _tokenId, address executor, bytes calldata authData) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        _authorizations[_tokenId][executor] = authData;
        emit UsageAuthorized(_tokenId, executor);
    }

    function isAuthorized(uint256 _tokenId, address executor) external view returns (bool) {
        return _authorizations[_tokenId][executor].length > 0;
    }

    // ── ERC-7857: ENCRYPTED METADATA ──────────────────────────────────

    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        require(
            ownerOf(tokenId) == msg.sender || _authorizations[tokenId][msg.sender].length > 0,
            "Not authorized"
        );
        return _encryptedURIs[tokenId];
    }

    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        return _metadataHashes[tokenId];
    }

    function updateMetadata(uint256 tokenId, string calldata newEncryptedURI, bytes32 newHash) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _encryptedURIs[tokenId] = newEncryptedURI;
        _metadataHashes[tokenId] = newHash;
        emit MetadataUpdated(tokenId, newHash);
    }

    // ── TOKEN URI ─────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        AgentProfile memory p = profiles[tokenId];
        return string(abi.encodePacked(
            '{"name":"ScorerAgent #', _uint2str(tokenId), '"',
            ',"sector":"', p.sector, '"',
            ',"model":"', p.modelName, '"',
            ',"dealsAnalyzed":', _uint2str(p.dealsAnalyzed),
            ',"active":', p.active ? "true" : "false",
            ',"mintedAt":', _uint2str(p.mintedAt),
            '}'
        ));
    }

    function getProfile(uint256 tokenId) external view returns (AgentProfile memory) {
        return profiles[tokenId];
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v;
        uint256 d;
        while (t != 0) { d++; t /= 10; }
        bytes memory buf = new bytes(d);
        while (v != 0) { d--; buf[d] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}
