// ─── ShadowBidFactory ABI ─────────────────────────────────────────────────────

export const FACTORY_ABI = [
  // createVault (new signature with compliance params)
  {
    type: "function",
    name: "createVault",
    stateMutability: "payable",
    inputs: [
      { name: "_title", type: "string" },
      { name: "_description", type: "string" },
      { name: "_closeTime", type: "uint256" },
      { name: "_revealWindow", type: "uint256" },
      { name: "_depositRequired", type: "uint256" },
      { name: "_allowedSuppliers", type: "address[]" },
      { name: "_buyerECIESPubKey", type: "string" },
      { name: "_oracle", type: "address" },
      { name: "_assetProofHash", type: "bytes32" },
      { name: "_settlementWindow", type: "uint256" },
      { name: "_oracleTimeout", type: "uint256" },
      { name: "_requiresAccreditation", type: "bool" },
      { name: "_allowedJurisdictions", type: "string[]" },
      { name: "_settlementToken", type: "address" },
      { name: "_declaredAssetValue", type: "uint256" },
      { name: "_reviewWindowSeconds", type: "uint256" },
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
  // verified (global KYB state)
  {
    type: "function",
    name: "verified",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // isAccredited
  {
    type: "function",
    name: "isAccredited",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // verifyInstitution (admin only)
  {
    type: "function",
    name: "verifyInstitution",
    stateMutability: "nonpayable",
    inputs: [
      { name: "inst", type: "address" },
      { name: "accredited", type: "bool" },
      { name: "_jurisdiction", type: "string" },
      { name: "", type: "bytes" },
    ],
    outputs: [],
  },
  // institutionJurisdiction (view)
  {
    type: "function",
    name: "institutionJurisdiction",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  // revokeInstitution (admin only)
  {
    type: "function",
    name: "revokeInstitution",
    stateMutability: "nonpayable",
    inputs: [{ name: "inst", type: "address" }],
    outputs: [],
  },
  // grantBuyerRole (admin only)
  {
    type: "function",
    name: "grantBuyerRole",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
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
  // Events
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
  {
    type: "event",
    name: "InstitutionVerified",
    inputs: [
      { name: "inst", type: "address", indexed: true },
      { name: "accredited", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InstitutionRevoked",
    inputs: [{ name: "inst", type: "address", indexed: true }],
  },
] as const;

// ─── ShadowBidVault ABI ───────────────────────────────────────────────────────

export const VAULT_ABI = [
  // ── Immutable state ───────────────────────────────────────────────────────
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "buyer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
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
  // ── Mutable state ─────────────────────────────────────────────────────────
  { type: "function", name: "title", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
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
    name: "assetProofHash",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "declaredAssetValue",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "phase", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "winner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  {
    type: "function",
    name: "winningPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "winningBidAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "secondBidder",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "secondBidAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "platformAdmin",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "delivered", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  {
    type: "function",
    name: "paymentSubmitted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "creatorBond",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "bondReleaseTime",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "bondSlashed", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  {
    type: "function",
    name: "settlementDeadline",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "settlementWindow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "biddingStartTime",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "requiresAccreditation",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "settlementToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // conflictAttestationSubmitted(address)
  {
    type: "function",
    name: "conflictAttestationSubmitted",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // isAllowedSupplier(address)
  {
    type: "function",
    name: "isAllowedSupplier",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
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
  // ── View Helpers ──────────────────────────────────────────────────────────
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
  {
    type: "function",
    name: "getAllowedJurisdictions",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string[]" }],
  },
  {
    type: "function",
    name: "getDomainSeparator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  // ── Write Functions ───────────────────────────────────────────────────────
  // submitConflictAttestation
  {
    type: "function",
    name: "submitConflictAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "timestamp", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  // commitBid
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
  // triggerRevealPhase
  { type: "function", name: "triggerRevealPhase", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // revealBid
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
  // settle
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // cancel
  { type: "function", name: "cancel", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // submitPayment
  { type: "function", name: "submitPayment", stateMutability: "payable", inputs: [], outputs: [] },
  // confirmDelivery (oracle only)
  { type: "function", name: "confirmDelivery", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // disputeDelivery (winner only)
  { type: "function", name: "disputeDelivery", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // claimOracleTimeout (winner only)
  { type: "function", name: "claimOracleTimeout", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // claimBuyerDefault (buyer only)
  { type: "function", name: "claimBuyerDefault", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // releaseCreatorBond (buyer only)
  { type: "function", name: "releaseCreatorBond", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // slashCreatorBond (admin only)
  {
    type: "function",
    name: "slashCreatorBond",
    stateMutability: "nonpayable",
    inputs: [{ name: "victim", type: "address" }],
    outputs: [],
  },
  // pause / unpause (admin only)
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // updateOracle (admin only)
  {
    type: "function",
    name: "updateOracle",
    stateMutability: "nonpayable",
    inputs: [{ name: "newOracle", type: "address" }],
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
  { type: "event", name: "PhaseChanged", inputs: [{ name: "newPhase", type: "uint8", indexed: false }] },
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
    name: "SecondBidderTracked",
    inputs: [
      { name: "secondBidder", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "AuctionCancelled", inputs: [{ name: "refundCount", type: "uint256", indexed: false }] },
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
  {
    type: "event",
    name: "ConflictAttestationSubmitted",
    inputs: [{ name: "bidder", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "PaymentSubmitted",
    inputs: [
      { name: "winner", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DeliveryConfirmed",
    inputs: [
      { name: "oracle", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DeliveryDisputed",
    inputs: [
      { name: "winner", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FallbackActivated",
    inputs: [
      { name: "secondBidder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CreatorBondSlashed",
    inputs: [
      { name: "victim", type: "address", indexed: true },
      { name: "victimShare", type: "uint256", indexed: false },
      { name: "burned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CreatorBondReleased",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── Role hashes ──────────────────────────────────────────────────────────────
export const BUYER_ROLE_HASH = "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848" as `0x${string}`;
export const ADMIN_ROLE_HASH = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775" as `0x${string}`;
