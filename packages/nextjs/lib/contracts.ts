// ─── ShadowBidFactory ABI ─────────────────────────────────────────────────────

export const FACTORY_ABI = [
    // createVault
    {
        type: "function",
        name: "createVault",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_title", type: "string" },
            { name: "_description", type: "string" },
            { name: "_closeTime", type: "uint256" },
            { name: "_revealWindow", type: "uint256" },
            { name: "_depositRequired", type: "uint256" },
            { name: "_allowedSuppliers", type: "address[]" },
            { name: "_auditor", type: "address" },
            { name: "_buyerECIESPubKey", type: "string" },
        ],
        outputs: [{ name: "vaultAddr", type: "address" }],
    },
    // getAllVaults
    {
        type: "function",
        name: "getAllVaults",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }],
    },
    // getVaultsByBuyer
    {
        type: "function",
        name: "getVaultsByBuyer",
        stateMutability: "view",
        inputs: [{ name: "b", type: "address" }],
        outputs: [{ name: "", type: "address[]" }],
    },
    // isVault
    {
        type: "function",
        name: "isVault",
        stateMutability: "view",
        inputs: [{ name: "", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    // grantBuyerRole (admin only)
    {
        type: "function",
        name: "grantBuyerRole",
        stateMutability: "nonpayable",
        inputs: [{ name: "account", type: "address" }],
        outputs: [],
    },
    // VaultCreated event
    {
        type: "event",
        name: "VaultCreated",
        inputs: [
            { name: "vault", type: "address", indexed: true },
            { name: "buyer", type: "address", indexed: true },
            { name: "title", type: "string", indexed: false },
            { name: "closeTime", type: "uint256", indexed: false },
            { name: "depositRequired", type: "uint256", indexed: false },
        ],
    },
] as const;

// ─── ShadowBidVault ABI ───────────────────────────────────────────────────────

export const VAULT_ABI = [
    // ── Public state variables ────────────────────────────────────────────────
    {
        type: "function",
        name: "buyer",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        type: "function",
        name: "title",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "description",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "buyerECIESPubKey",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "closeTime",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "revealDeadline",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "depositRequired",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "phase",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        type: "function",
        name: "winner",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        type: "function",
        name: "winningPrice",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    // bids(address) → Bid struct
    {
        type: "function",
        name: "bids",
        stateMutability: "view",
        inputs: [{ name: "", type: "address" }],
        outputs: [
            { name: "commitHash", type: "bytes32" },
            { name: "storageRoot", type: "string" },
            { name: "revealedPrice", type: "uint256" },
            { name: "revealed", type: "bool" },
            { name: "depositPaid", type: "bool" },
            { name: "depositReturned", type: "bool" },
        ],
    },
    // ── View helpers ──────────────────────────────────────────────────────────
    {
        type: "function",
        name: "getSuppliers",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }],
    },
    {
        type: "function",
        name: "getBidCount",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "getCurrentPhase",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        type: "function",
        name: "getTimeToClose",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    // hasRole
    {
        type: "function",
        name: "hasRole",
        stateMutability: "view",
        inputs: [
            { name: "role", type: "bytes32" },
            { name: "account", type: "address" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    // ── Write functions ───────────────────────────────────────────────────────
    {
        type: "function",
        name: "commitBid",
        stateMutability: "payable",
        inputs: [
            { name: "_commitHash", type: "bytes32" },
            { name: "_storageRoot", type: "string" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "triggerRevealPhase",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    {
        type: "function",
        name: "revealBid",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_price", type: "uint256" },
            { name: "_salt", type: "bytes32" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "settle",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    {
        type: "function",
        name: "cancel",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    // ── Events ────────────────────────────────────────────────────────────────
    {
        type: "event",
        name: "BidCommitted",
        inputs: [
            { name: "supplier", type: "address", indexed: true },
            { name: "commitHash", type: "bytes32", indexed: false },
            { name: "storageRoot", type: "string", indexed: false },
        ],
    },
    {
        type: "event",
        name: "PhaseChanged",
        inputs: [{ name: "newPhase", type: "uint8", indexed: false }],
    },
    {
        type: "event",
        name: "BidRevealed",
        inputs: [
            { name: "supplier", type: "address", indexed: true },
            { name: "price", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "WinnerSelected",
        inputs: [
            { name: "winner", type: "address", indexed: true },
            { name: "price", type: "uint256", indexed: false },
            { name: "totalBids", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "AuctionCancelled",
        inputs: [{ name: "refundCount", type: "uint256", indexed: false }],
    },
    {
        type: "event",
        name: "DepositSlashed",
        inputs: [
            { name: "supplier", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
            { name: "recipient", type: "address", indexed: false },
        ],
    },
    {
        type: "event",
        name: "DepositReturned",
        inputs: [
            { name: "supplier", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
] as const;

// ─── SUPPLIER_ROLE keccak256 hash ─────────────────────────────────────────────
export const SUPPLIER_ROLE =
    "0x40a2660836340c432d68c4c8e5b09fe5afc2ca38f53c3ff42ab81b2e1c48a3e5" as `0x${string}`;

export const BUYER_ROLE =
    "0x35f8e1a1a5b5ad4e8a94d3b08b6a67b8df8d62f3bed5e0f742c5d5c0f31e85c0" as `0x${string}`;
