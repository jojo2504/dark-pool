# Dark Pool — Complete Security & Compliance Implementation Prompt

# Scaffold-ETH 2 + ADI Chain + Institutional RWA Sealed-Bid Auctions

---

## PROJECT CONTEXT

This is a Scaffold-ETH 2 monorepo (NextJS + Hardhat + Wagmi/Viem + TypeScript)
implementing a sealed-bid RWA auction protocol called `ShadowBidVault`, targeting
institutional participants (funds, family offices, sovereign entities) and deployed
on ADI Chain (EVM-compatible, Abu Dhabi institutional blockchain backed by IHC,
licensed by UAE Central Bank).

**Current state of the repo:**

- Working commit-reveal mechanism for bid privacy during auction
- ETH deposit forfeiture on non-reveal
- Sniping protection (anti-snipe time extension)
- Invite-only whitelist (address-based only, no identity verification)
- Immutable vault parameters at creation
- Deterministic winner selection

**Stack:**

- `packages/hardhat/contracts/` — Solidity smart contracts
- `packages/hardhat/deploy/` — Hardhat deploy scripts
- `packages/nextjs/app/` — NextJS App Router frontend
- `packages/nextjs/app/api/` — NextJS API routes (backend)
- Settlement currency: ETH now, DDSC (ADI Chain dirham stablecoin) later
- Identity: EIP-712 signed credentials from platform admin wallet
- KYB vendor: Sumsub (Business verification tier)

---

## PART 1 — SMART CONTRACT CHANGES

### File: `packages/hardhat/contracts/ShadowBidVault.sol`

### 1.1 New State Variables to Add

```solidity
// ─── IDENTITY & ACCESS ───────────────────────────────────────────────────────
address public platformAdmin;
mapping(address => bool) public verified;
mapping(address => bool) public isAccredited;
mapping(address => address) public affiliatedWith; // bidder => creator they're affiliated with

// ─── CREATOR BOND (anti-fraud for auction opener) ────────────────────────────
uint256 public creatorBond;
uint256 public bondReleaseTime;       // block.timestamp + 72 hours post-settlement
bool public bondSlashed;

// ─── REAL-WORLD DELIVERY ORACLE ──────────────────────────────────────────────
address public oracle;               // notary / custodian / platform multisig
bool public delivered;
uint256 public oracleTimeout;        // default 30 days from settlementTime
uint256 public settlementTime;       // timestamp when winner was selected

// ─── BUYER DEFAULT / SYMMETRIC SLASHING ──────────────────────────────────────
address public secondBidder;
uint256 public secondBidAmount;
uint256 public settlementDeadline;   // settlementTime + settlementWindow
uint256 public settlementWindow;     // configurable at creation, default 48 hours
bool public paymentSubmitted;

// ─── ASSET PROOF ──────────────────────────────────────────────────────────────
bytes32 public assetProofHash;       // keccak256 of legal doc / title deed
uint256 public biddingStartTime;     // block.timestamp + 48 hours (review window)
address public assetTokenContract;  // optional: ERC-721 contract if tokenized RWA
uint256 public assetTokenId;         // optional: token ID if tokenized RWA
bool public assetTokenEscrowed;

// ─── ACCREDITATION & JURISDICTION ────────────────────────────────────────────
bool public requiresAccreditation;
string[] public allowedJurisdictions; // e.g. ["UAE", "KSA", "UK"]

// ─── SETTLEMENT CURRENCY ──────────────────────────────────────────────────────
address public settlementToken;      // address(0) = ETH, else ERC-20 (DDSC)

// ─── CONFLICT OF INTEREST ────────────────────────────────────────────────────
mapping(address => bool) public conflictAttestationSubmitted;

// ─── SECURITY ─────────────────────────────────────────────────────────────────
bool public paused;
```

---

### 1.2 New Modifiers

```solidity
modifier onlyAdmin() {
    require(msg.sender == platformAdmin, "Not admin");
    _;
}

modifier onlyVerified() {
    require(verified[msg.sender], "Institution not verified");
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
    require(block.timestamp >= biddingStartTime, "Bidding not started yet");
    require(block.timestamp < auctionEndTime, "Auction closed");
    _;
}

modifier onlyAccreditedIfRequired() {
    if (requiresAccreditation) {
        require(isAccredited[msg.sender], "Accreditation required");
    }
    _;
}
```

---

### 1.3 Constructor Changes

```solidity
constructor(
    address _platformAdmin,
    address _oracle,
    bytes32 _assetProofHash,
    uint256 _settlementWindow,       // seconds, e.g. 172800 = 48 hours
    uint256 _oracleTimeout,          // seconds, e.g. 2592000 = 30 days
    bool _requiresAccreditation,
    string[] memory _allowedJurisdictions,
    address _settlementToken,        // address(0) for ETH
    address _assetTokenContract,     // address(0) if not tokenized
    uint256 _assetTokenId,
    // ... existing params (duration, deposit, allowed suppliers, etc.)
) payable {
    // Validate creator bond
    uint256 requiredBond = declaredAssetValue * 5 / 1000; // 0.5%
    if (requiredBond < 1 ether) requiredBond = 1 ether;
    require(msg.value >= requiredBond, "Insufficient creator bond");

    platformAdmin = _platformAdmin;
    oracle = _oracle;
    assetProofHash = _assetProofHash;
    settlementWindow = _settlementWindow;
    oracleTimeout = _oracleTimeout;
    requiresAccreditation = _requiresAccreditation;
    allowedJurisdictions = _allowedJurisdictions;
    settlementToken = _settlementToken;
    creatorBond = msg.value;
    biddingStartTime = block.timestamp + 48 hours; // review window

    // If tokenized RWA: escrow the asset token
    if (_assetTokenContract != address(0)) {
        assetTokenContract = _assetTokenContract;
        assetTokenId = _assetTokenId;
        IERC721(_assetTokenContract).transferFrom(msg.sender, address(this), _assetTokenId);
        assetTokenEscrowed = true;
    }
}
```

---

### 1.4 New Functions to Add

```solidity
// ─── IDENTITY ────────────────────────────────────────────────────────────────

/// Called by platformAdmin after off-chain KYB approval
function verifyInstitution(
    address inst,
    bool accredited,
    bytes calldata sig
) external onlyAdmin {
    // Recover EIP-712 signature to ensure it was legitimately issued
    bytes32 hash = _hashVerificationCredential(inst, accredited);
    address signer = ECDSA.recover(hash, sig);
    require(signer == platformAdmin, "Invalid credential signature");
    verified[inst] = true;
    isAccredited[inst] = accredited;
    emit InstitutionVerified(inst, accredited);
}

function revokeInstitution(address inst) external onlyAdmin {
    verified[inst] = false;
    isAccredited[inst] = false;
    emit InstitutionRevoked(inst);
}

function setAffiliated(address bidder, address withCreator) external onlyAdmin {
    affiliatedWith[bidder] = withCreator;
}

// ─── CONFLICT ATTESTATION ────────────────────────────────────────────────────

/// Bidder must call this before commitBid(), signing EIP-712 conflict declaration
function submitConflictAttestation(bytes calldata sig) external {
    bytes32 hash = _hashConflictAttestation(msg.sender, address(this));
    address signer = ECDSA.recover(hash, sig);
    require(signer == msg.sender, "Invalid attestation signature");
    conflictAttestationSubmitted[msg.sender] = true;
    emit ConflictAttestationSubmitted(msg.sender);
}

// ─── COMMIT BID (modify existing) ────────────────────────────────────────────

function commitBid(bytes32 commitment) external payable
    notPaused
    biddingOpen
    onlyVerified
    onlyAccreditedIfRequired
{
    require(msg.sender != creator, "Creator cannot bid");
    require(affiliatedWith[msg.sender] != creator, "Affiliated address cannot bid");
    require(conflictAttestationSubmitted[msg.sender], "Submit conflict attestation first");
    require(msg.value >= requiredDeposit, "Insufficient deposit");
    // ... rest of existing commit logic
}

// ─── PAYMENT SUBMISSION (new — full escrow) ───────────────────────────────────

/// Winner calls this after being selected, locks full payment in escrow
function submitPayment() external payable notPaused {
    require(msg.sender == winner, "Not the winner");
    require(!paymentSubmitted, "Already submitted");
    require(block.timestamp <= settlementDeadline, "Settlement window expired");

    if (settlementToken == address(0)) {
        require(msg.value == winningBidAmount, "Wrong ETH amount");
    } else {
        require(msg.value == 0, "Use ERC-20 token");
        IERC20(settlementToken).transferFrom(msg.sender, address(this), winningBidAmount);
    }

    paymentSubmitted = true;
    emit PaymentSubmitted(msg.sender, winningBidAmount);
}

// ─── ORACLE DELIVERY CONFIRMATION ────────────────────────────────────────────

/// Oracle calls this after confirming real-world asset transfer
function confirmDelivery() external onlyOracle {
    require(paymentSubmitted, "Payment not submitted");
    require(!delivered, "Already confirmed");
    delivered = true;
    settlementTime = block.timestamp;
    bondReleaseTime = block.timestamp + 72 hours;

    // Release payment to creator
    _releasePaymentToCreator();
    emit DeliveryConfirmed(oracle, block.timestamp);
}

function disputeDelivery() external {
    require(msg.sender == winner, "Not winner");
    require(block.timestamp <= settlementTime + 72 hours, "Dispute window expired");
    // Freeze contract pending admin resolution
    paused = true;
    emit DeliveryDisputed(winner, block.timestamp);
}

/// If oracle never confirms within oracleTimeout, winner can reclaim payment
function claimOracleTimeout() external {
    require(msg.sender == winner, "Not winner");
    require(paymentSubmitted, "No payment to return");
    require(!delivered, "Already delivered");
    require(block.timestamp > settlementTime + oracleTimeout, "Timeout not reached");
    _refundWinner();
    emit OracleTimedOut(block.timestamp);
}

// ─── BUYER DEFAULT ────────────────────────────────────────────────────────────

/// Seller calls this if winner didn't submit payment in time
function claimBuyerDefault() external {
    require(msg.sender == creator, "Not creator");
    require(!paymentSubmitted, "Payment was submitted");
    require(block.timestamp > settlementDeadline, "Window still open");

    // Slash winner's reveal deposit to seller
    _slashDeposit(winner, creator);

    // Activate fallback to second bidder
    if (secondBidder != address(0)) {
        emit FallbackActivated(secondBidder, secondBidAmount);
        // Open new settlement window for second bidder
        winner = secondBidder;
        winningBidAmount = secondBidAmount;
        settlementDeadline = block.timestamp + settlementWindow;
    }
}

// ─── CREATOR BOND ─────────────────────────────────────────────────────────────

/// Admin slashes creator bond on confirmed fraud
function slashCreatorBond(address victim) external onlyAdmin {
    require(!bondSlashed, "Already slashed");
    bondSlashed = true;
    uint256 bond = creatorBond;
    creatorBond = 0;
    uint256 victimShare = bond * 80 / 100;
    uint256 burnShare = bond - victimShare;
    payable(victim).transfer(victimShare);
    payable(address(0xdead)).transfer(burnShare); // burn
    emit CreatorBondSlashed(victim, victimShare, burnShare);
}

/// Creator reclaims bond after dispute window + delivery confirmation
function releaseCreatorBond() external {
    require(msg.sender == creator, "Not creator");
    require(delivered, "Delivery not confirmed");
    require(block.timestamp >= bondReleaseTime, "Bond still locked");
    require(!bondSlashed, "Bond was slashed");
    uint256 bond = creatorBond;
    creatorBond = 0;
    payable(creator).transfer(bond);
    emit CreatorBondReleased(creator, bond);
}

// ─── ADMIN SECURITY ───────────────────────────────────────────────────────────

function pause() external onlyAdmin { paused = true; }
function unpause() external onlyAdmin { paused = false; }

function updateOracle(address newOracle) external onlyAdmin {
    oracle = newOracle;
    emit OracleUpdated(newOracle);
}
```

---

### 1.5 Events to Add

```solidity
event InstitutionVerified(address indexed inst, bool accredited);
event InstitutionRevoked(address indexed inst);
event ConflictAttestationSubmitted(address indexed bidder);
event PaymentSubmitted(address indexed winner, uint256 amount);
event DeliveryConfirmed(address indexed oracle, uint256 timestamp);
event DeliveryDisputed(address indexed winner, uint256 timestamp);
event OracleTimedOut(uint256 timestamp);
event FallbackActivated(address indexed secondBidder, uint256 amount);
event CreatorBondSlashed(address indexed victim, uint256 victimShare, uint256 burned);
event CreatorBondReleased(address indexed creator, uint256 amount);
event OracleUpdated(address indexed newOracle);
```

---

### 1.6 OpenZeppelin Imports to Add

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ShadowBidVault is ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;
    // ...
}
```

Add to `packages/hardhat/package.json`:

```json
"@openzeppelin/contracts": "^5.0.0"
```

---

## PART 2 — KYB BACKEND

### Files: `packages/nextjs/app/api/kyb/`

### 2.1 Environment Variables

Add to `packages/nextjs/.env.local`:

```env
# Sumsub KYB
SUMSUB_APP_TOKEN=your_sumsub_app_token
SUMSUB_SECRET_KEY=your_sumsub_secret_key
SUMSUB_BASE_URL=https://api.sumsub.com

# Platform admin wallet (signs on-chain credentials)
PLATFORM_ADMIN_PRIVATE_KEY=0x...
PLATFORM_ADMIN_ADDRESS=0x...

# Contract
SHADOW_BID_VAULT_FACTORY_ADDRESS=0x...
ADI_CHAIN_RPC_URL=https://rpc.adi.foundation

# Sanctions screening (Chainalysis or Comply Advantage)
COMPLY_ADVANTAGE_API_KEY=your_key
COMPLY_ADVANTAGE_CLIENT_ID=your_client_id

# Internal DB (Postgres recommended)
DATABASE_URL=postgresql://...

# Webhook secret (Sumsub signs webhooks — verify this)
SUMSUB_WEBHOOK_SECRET=your_webhook_secret
```

---

### 2.2 Sumsub Client

### File: `packages/nextjs/lib/sumsub.ts`

```typescript
import crypto from "crypto";

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN!;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY!;
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL!;

function createSignature(
  method: string,
  url: string,
  body: string | null,
  ts: number,
): string {
  const data = ts + method.toUpperCase() + url + (body || "");
  return crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(data)
    .digest("hex");
}

async function sumsubRequest(
  method: string,
  endpoint: string,
  body?: object | FormData,
  isFormData = false,
): Promise<Response> {
  const ts = Math.floor(Date.now() / 1000);
  const bodyStr = body && !isFormData ? JSON.stringify(body) : null;

  const sig = createSignature(method, endpoint, bodyStr, ts);

  const headers: Record<string, string> = {
    "X-App-Token": SUMSUB_APP_TOKEN,
    "X-App-Access-Sig": sig,
    "X-App-Access-Ts": ts.toString(),
  };

  if (!isFormData && body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${SUMSUB_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body
        ? JSON.stringify(body)
        : undefined,
  });
}

export async function createApplicant(
  externalUserId: string, // your internal institution ID
  levelName = "business-kyb",
) {
  const res = await sumsubRequest("POST", "/resources/applicants", {
    externalUserId,
    type: "company",
  });
  return res.json();
}

export async function getApplicantStatus(applicantId: string) {
  const res = await sumsubRequest(
    "GET",
    `/resources/applicants/${applicantId}/requiredIdDocsStatus`,
  );
  return res.json();
}

export async function generateAccessToken(
  externalUserId: string,
  levelName = "business-kyb",
  ttlInSecs = 3600,
) {
  const res = await sumsubRequest(
    "POST",
    `/resources/accessTokens?userId=${externalUserId}&levelName=${levelName}&ttlInSecs=${ttlInSecs}`,
  );
  return res.json();
}

export async function verifyWebhookSignature(
  payload: string,
  receivedSig: string,
): Promise<boolean> {
  const expectedSig = crypto
    .createHmac("sha256", process.env.SUMSUB_WEBHOOK_SECRET!)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(receivedSig),
  );
}
```

---

### 2.3 Sanctions Screening Client

### File: `packages/nextjs/lib/sanctions.ts`

```typescript
// Using Comply Advantage API
// Screens entity name against OFAC, UN, EU, UAE Central Bank watchlists

export async function screenEntity(params: {
  entityName: string;
  countryOfIncorporation: string;
  registrationNumber: string;
  ubos: Array<{ firstName: string; lastName: string; dateOfBirth: string }>;
}): Promise<{
  passed: boolean;
  matchCount: number;
  searchId: string;
  details: object;
}> {
  const res = await fetch("https://api.complyadvantage.com/searches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.COMPLY_ADVANTAGE_API_KEY}`,
    },
    body: JSON.stringify({
      search_term: params.entityName,
      client_ref: params.registrationNumber,
      fuzziness: 0.6,
      filters: {
        types: ["sanction", "warning", "pep", "adverse-media"],
        entity_type: "company",
        countries: [params.countryOfIncorporation],
      },
      tags: ["dark-pool-kyb"],
    }),
  });

  const data = await res.json();
  const matchCount = data.content?.data?.total_hits ?? 0;

  return {
    passed: matchCount === 0,
    matchCount,
    searchId: data.content?.data?.id ?? "",
    details: data,
  };
}

// Re-screen on a schedule (call this from a cron job)
export async function rescreenAllInstitutions(
  institutions: Array<{
    id: string;
    entityName: string;
    countryOfIncorporation: string;
    registrationNumber: string;
  }>,
) {
  const results = [];
  for (const inst of institutions) {
    const result = await screenEntity({
      entityName: inst.entityName,
      countryOfIncorporation: inst.countryOfIncorporation,
      registrationNumber: inst.registrationNumber,
      ubos: [], // fetch from DB
    });
    results.push({ id: inst.id, ...result });
  }
  return results;
}
```

---

### 2.4 On-Chain Credential Issuer

### File: `packages/nextjs/lib/onchain-credentials.ts`

```typescript
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(
  process.env.PLATFORM_ADMIN_PRIVATE_KEY as `0x${string}`,
);

const walletClient = createWalletClient({
  account,
  transport: http(process.env.ADI_CHAIN_RPC_URL),
});

const publicClient = createPublicClient({
  transport: http(process.env.ADI_CHAIN_RPC_URL),
});

const VAULT_FACTORY_ABI = parseAbi([
  "function verifyInstitution(address inst, bool accredited, bytes calldata sig) external",
  "function revokeInstitution(address inst) external",
]);

// Signs the EIP-712 credential that the smart contract will verify
export async function signVerificationCredential(
  institutionAddress: `0x${string}`,
  isAccredited: boolean,
): Promise<`0x${string}`> {
  const domain = {
    name: "DarkPool",
    version: "1",
    chainId: BigInt(process.env.ADI_CHAIN_ID ?? "1"),
    verifyingContract: process.env
      .SHADOW_BID_VAULT_FACTORY_ADDRESS as `0x${string}`,
  };

  const types = {
    VerificationCredential: [
      { name: "institution", type: "address" },
      { name: "accredited", type: "bool" },
      { name: "issuedAt", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
    ],
  };

  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const expiresAt = issuedAt + BigInt(365 * 24 * 60 * 60); // 1 year

  const sig = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType: "VerificationCredential",
    message: {
      institution: institutionAddress,
      accredited: isAccredited,
      issuedAt,
      expiresAt,
    },
  });

  return sig;
}

// Calls verifyInstitution() on the ShadowBidVaultFactory contract
export async function verifyInstitutionOnChain(
  vaultFactoryAddress: `0x${string}`,
  institutionAddress: `0x${string}`,
  isAccredited: boolean,
): Promise<`0x${string}`> {
  const sig = await signVerificationCredential(
    institutionAddress,
    isAccredited,
  );

  const txHash = await walletClient.writeContract({
    address: vaultFactoryAddress,
    abi: VAULT_FACTORY_ABI,
    functionName: "verifyInstitution",
    args: [institutionAddress, isAccredited, sig],
  });

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}

// Revokes on-chain verification (triggered by re-screening hitting a sanction)
export async function revokeInstitutionOnChain(
  vaultFactoryAddress: `0x${string}`,
  institutionAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const txHash = await walletClient.writeContract({
    address: vaultFactoryAddress,
    abi: VAULT_FACTORY_ABI,
    functionName: "revokeInstitution",
    args: [institutionAddress],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
```

---

### 2.5 KYB Submission Route

### File: `packages/nextjs/app/api/kyb/submit/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createApplicant, generateAccessToken } from "@/lib/sumsub";
import { screenEntity } from "@/lib/sanctions";
import { db } from "@/lib/db"; // your Postgres client

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      entityName,
      registrationNumber,
      countryOfIncorporation,
      jurisdiction,
      isAccreditedInvestor,
      ubos, // [{ firstName, lastName, dateOfBirth, nationality }]
    } = body;

    // 1. Validate required fields
    if (!walletAddress || !entityName || !registrationNumber || !ubos?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 2. Check if already verified or pending
    const existing = await db.institution.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    if (existing?.status === "verified") {
      return NextResponse.json({ error: "Already verified" }, { status: 409 });
    }

    // 3. Initial sanctions screening
    const sanctionsResult = await screenEntity({
      entityName,
      countryOfIncorporation,
      registrationNumber,
      ubos,
    });

    if (!sanctionsResult.passed) {
      // Log and reject immediately
      await db.institution.upsert({
        where: { walletAddress: walletAddress.toLowerCase() },
        create: {
          walletAddress: walletAddress.toLowerCase(),
          entityName,
          registrationNumber,
          countryOfIncorporation,
          jurisdiction,
          isAccreditedInvestor,
          status: "rejected",
          rejectionReason: "sanctions_match",
          sanctionsSearchId: sanctionsResult.searchId,
        },
        update: {
          status: "rejected",
          rejectionReason: "sanctions_match",
        },
      });
      return NextResponse.json(
        { error: "Entity failed sanctions screening" },
        { status: 403 },
      );
    }

    // 4. Create Sumsub applicant
    const internalId = `dp_${walletAddress.toLowerCase()}_${Date.now()}`;
    const applicant = await createApplicant(internalId, "business-kyb");

    // 5. Generate access token for frontend SDK
    const accessToken = await generateAccessToken(internalId);

    // 6. Store in DB as pending
    await db.institution.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        entityName,
        registrationNumber,
        countryOfIncorporation,
        jurisdiction,
        isAccreditedInvestor,
        sumsubApplicantId: applicant.id,
        sumsubExternalId: internalId,
        status: "pending",
        sanctionsSearchId: sanctionsResult.searchId,
      },
      update: {
        sumsubApplicantId: applicant.id,
        sumsubExternalId: internalId,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      applicantId: applicant.id,
      sumsubToken: accessToken.token, // used by Sumsub WebSDK on frontend
    });
  } catch (err) {
    console.error("[KYB Submit]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

---

### 2.6 Sumsub Webhook Handler (triggers on-chain verification)

### File: `packages/nextjs/app/api/kyb/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/sumsub";
import {
  verifyInstitutionOnChain,
  revokeInstitutionOnChain,
} from "@/lib/onchain-credentials";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const receivedSig = req.headers.get("x-payload-digest") ?? "";

    // 1. Verify Sumsub webhook signature
    const isValid = await verifyWebhookSignature(rawBody, receivedSig);
    if (!isValid) {
      console.error("[KYB Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { type, externalUserId, reviewResult } = payload;

    // 2. Find institution by Sumsub external ID
    const institution = await db.institution.findUnique({
      where: { sumsubExternalId: externalUserId },
    });

    if (!institution) {
      return NextResponse.json(
        { error: "Institution not found" },
        { status: 404 },
      );
    }

    // 3. Handle different webhook types
    if (type === "applicantReviewed") {
      const reviewAnswer = reviewResult?.reviewAnswer; // GREEN = pass, RED = fail

      if (reviewAnswer === "GREEN") {
        // KYB PASSED

        // Trigger on-chain verification
        const txHash = await verifyInstitutionOnChain(
          process.env.SHADOW_BID_VAULT_FACTORY_ADDRESS as `0x${string}`,
          institution.walletAddress as `0x${string}`,
          institution.isAccreditedInvestor,
        );

        await db.institution.update({
          where: { id: institution.id },
          data: {
            status: "verified",
            verifiedAt: new Date(),
            onChainTxHash: txHash,
          },
        });

        // TODO: send email notification to institution
      } else if (reviewAnswer === "RED") {
        // KYB FAILED
        const rejectLabels = reviewResult?.rejectLabels ?? [];

        await db.institution.update({
          where: { id: institution.id },
          data: {
            status: "rejected",
            rejectionReason: rejectLabels.join(", "),
          },
        });
      }
    }

    if (type === "applicantPending") {
      await db.institution.update({
        where: { id: institution.id },
        data: { status: "under_review" },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[KYB Webhook]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

---

### 2.7 KYB Status Route

### File: `packages/nextjs/app/api/kyb/status/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get("address");

  if (!walletAddress) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  const institution = await db.institution.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: {
      status: true,
      verifiedAt: true,
      rejectionReason: true,
      entityName: true,
      jurisdiction: true,
      isAccreditedInvestor: true,
      onChainTxHash: true,
    },
  });

  if (!institution) {
    return NextResponse.json({ status: "not_found" });
  }

  return NextResponse.json(institution);
}
```

---

### 2.8 Sanctions Re-Screening Cron Job

### File: `packages/nextjs/app/api/cron/rescreen/route.ts`

```typescript
// Call this route via a cron job every 24 hours
// Vercel: add to vercel.json { "crons": [{ "path": "/api/cron/rescreen", "schedule": "0 2 * * *" }] }

import { NextRequest, NextResponse } from "next/server";
import { screenEntity } from "@/lib/sanctions";
import { revokeInstitutionOnChain } from "@/lib/onchain-credentials";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verified = await db.institution.findMany({
    where: { status: "verified" },
  });

  const results = [];
  for (const inst of verified) {
    const screen = await screenEntity({
      entityName: inst.entityName,
      countryOfIncorporation: inst.countryOfIncorporation,
      registrationNumber: inst.registrationNumber,
      ubos: [],
    });

    if (!screen.passed) {
      // NEW sanction hit — revoke immediately
      await revokeInstitutionOnChain(
        process.env.SHADOW_BID_VAULT_FACTORY_ADDRESS as `0x${string}`,
        inst.walletAddress as `0x${string}`,
      );

      await db.institution.update({
        where: { id: inst.id },
        data: {
          status: "suspended",
          rejectionReason: `sanctions_match_rescreen_${new Date().toISOString()}`,
        },
      });

      // TODO: alert compliance team
      results.push({ id: inst.id, action: "revoked" });
    } else {
      results.push({ id: inst.id, action: "clear" });
    }
  }

  return NextResponse.json({ screened: results.length, results });
}
```

---

### 2.9 Database Schema (Prisma)

### File: `packages/nextjs/prisma/schema.prisma`

```prisma
model Institution {
  id                    String    @id @default(cuid())
  walletAddress         String    @unique
  entityName            String
  registrationNumber    String
  countryOfIncorporation String
  jurisdiction          String
  isAccreditedInvestor  Boolean   @default(false)

  // Sumsub
  sumsubApplicantId     String?
  sumsubExternalId      String?   @unique

  // Sanctions
  sanctionsSearchId     String?

  // Status
  status                String    @default("pending")
  // pending | under_review | verified | rejected | suspended
  rejectionReason       String?
  verifiedAt            DateTime?
  onChainTxHash         String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

---

## PART 3 — FRONTEND ADDITIONS

### Files: `packages/nextjs/app/`

### 3.1 Sumsub WebSDK Integration

### File: `packages/nextjs/app/kyb/page.tsx`

```typescript
// Install: yarn add @sumsub/websdk-react
import SumsubWebSdk from "@sumsub/websdk-react";

// After calling /api/kyb/submit and receiving sumsubToken,
// render the Sumsub WebSDK for document upload:

<SumsubWebSdk
  accessToken={sumsubToken}
  expirationHandler={async () => {
    // Refresh token from your /api/kyb/refresh-token endpoint
    const res = await fetch("/api/kyb/refresh-token");
    const data = await res.json();
    return data.token;
  }}
  config={{ lang: "en" }}
  options={{ addViewportTag: false }}
  onMessage={(type, payload) => {
    if (type === "idCheck.onApplicantSubmitted") {
      // Documents submitted, awaiting review
      setStatus("under_review");
    }
  }}
  onError={(error) => console.error("Sumsub error:", error)}
/>
```

### 3.2 Verification Status Badge

Add to wallet connect component — poll `/api/kyb/status?address={walletAddress}`:

```typescript
type KYBStatus =
  | "not_found"
  | "pending"
  | "under_review"
  | "verified"
  | "rejected"
  | "suspended";

const statusColors: Record<KYBStatus, string> = {
  not_found: "gray",
  pending: "yellow",
  under_review: "blue",
  verified: "green",
  rejected: "red",
  suspended: "orange",
};
```

### 3.3 Conflict Attestation UI

Before `commitBid()` is callable, show an attestation modal where the user signs:

```typescript
const conflictMessage = {
  domain: { name: "DarkPool", version: "1", chainId, verifyingContract },
  types: {
    ConflictAttestation: [
      { name: "bidder", type: "address" },
      { name: "vault", type: "address" },
      { name: "statement", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  message: {
    bidder: address,
    vault: vaultAddress,
    statement:
      "I confirm I am not affiliated with the auction creator and have no conflict of interest.",
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
  },
};

const sig = await walletClient.signTypedData(conflictMessage);
// Then call submitConflictAttestation(sig) on the contract
```

---

## PART 4 — MEV PROTECTION

### File: `packages/nextjs/scaffold.config.ts`

```typescript
// For commit transactions, route through Flashbots Protect RPC
// to prevent validators from seeing and front-running bid commits

const chains = {
  mainnet: {
    rpcUrls: {
      default: { http: ["https://rpc.flashbots.net"] },
    },
  },
  adiChain: {
    // Check ADI Chain docs for their private mempool endpoint
    rpcUrls: {
      default: { http: [process.env.ADI_CHAIN_RPC_URL] },
    },
  },
};
```

---

## PART 5 — SECURITY HARDENING

### 5.1 Run Slither Static Analysis

```bash
cd packages/hardhat
pip install slither-analyzer --break-system-packages
slither contracts/ShadowBidVault.sol --print human-summary
```

Fix all HIGH and MEDIUM severity findings before deployment.

### 5.2 Add to `packages/hardhat/package.json`

```json
"devDependencies": {
  "hardhat-gas-reporter": "^1.0.9",
  "solidity-coverage": "^0.8.0",
  "@nomicfoundation/hardhat-verify": "^2.0.0"
}
```

### 5.3 Verify Contract on ADI Chain Explorer

```typescript
// packages/hardhat/hardhat.config.ts
etherscan: {
  apiKey: {
    adiChain: process.env.ADI_CHAIN_EXPLORER_API_KEY,
  },
  customChains: [{
    network: "adiChain",
    chainId: Number(process.env.ADI_CHAIN_ID),
    urls: {
      apiURL: "https://explorer.adi.foundation/api",
      browserURL: "https://explorer.adi.foundation",
    },
  }],
},
```

---

## COMPLETE EXTERNAL PARTIES SUMMARY

| Party                     | Role                                                      | Integration Point                              |
| ------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| **Sumsub**                | KYB document verification + UBO checks                    | `/api/kyb/submit`, `/api/kyb/webhook`, WebSDK  |
| **Comply Advantage**      | Sanctions screening (OFAC, UN, EU, UAE CB)                | `/lib/sanctions.ts`, daily cron                |
| **Platform Admin Wallet** | Signs EIP-712 credentials, triggers on-chain verification | `/lib/onchain-credentials.ts`                  |
| **Oracle**                | Confirms real-world asset delivery                        | `confirmDelivery()` on ShadowBidVault          |
| **ADI Chain**             | Deployment target, native compliance, DDSC stablecoin     | `hardhat.config.ts`, `scaffold.config.ts`      |
| **DDSC**                  | Dirham-backed stablecoin for settlement                   | `settlementToken` in vault, `IERC20` interface |
| **OpenZeppelin**          | ReentrancyGuard, Pausable, ECDSA, EIP712, AccessControl   | Contract imports                               |
| **Flashbots Protect**     | MEV/front-running protection for bid commits              | `scaffold.config.ts` RPC override              |
| **Prisma + Postgres**     | Store KYB state, verification records, audit trail        | `prisma/schema.prisma`                         |

## COMPLETE INTERNAL PARTIES SUMMARY

| Party              | Role                                                  | Where Defined                                                |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------ |
| **Creator**        | Opens auction, posts bond, delivers asset             | ShadowBidVault constructor                                   |
| **Bidder**         | Commits sealed bid + deposit, reveals, pays if winner | `commitBid()`, `revealBid()`, `submitPayment()`              |
| **Second Bidder**  | Fallback if winner defaults                           | Tracked in `revealBid()`, activated in `claimBuyerDefault()` |
| **Platform Admin** | KYB approver, emergency pause, bond slasher           | `onlyAdmin` modifier                                         |
| **Oracle**         | Real-world delivery confirmation                      | `onlyOracle` modifier, `confirmDelivery()`                   |

---

## IMPLEMENTATION ORDER (priority sequence)

1. Add OpenZeppelin dependencies and imports to ShadowBidVault.sol
2. Add all new state variables and events
3. Implement `verifyInstitution()` and identity modifiers
4. Add creator bond logic to constructor + `releaseCreatorBond()` + `slashCreatorBond()`
5. Implement `submitPayment()` + escrow for full bid amount
6. Implement `confirmDelivery()` + `claimOracleTimeout()` + `disputeDelivery()`
7. Implement `claimBuyerDefault()` + fallback to second bidder
8. Add asset proof hash + tokenized asset escrow to constructor
9. Add `submitConflictAttestation()` + modify `commitBid()` with all guards
10. Set up Prisma schema + Postgres
11. Build `/lib/sumsub.ts` + `/lib/sanctions.ts` + `/lib/onchain-credentials.ts`
12. Build `/api/kyb/submit`, `/api/kyb/webhook`, `/api/kyb/status`
13. Build sanctions re-screening cron job
14. Add Sumsub WebSDK to `/app/kyb/` frontend page
15. Add conflict attestation modal to bid UI
16. Configure Flashbots RPC in scaffold.config.ts
17. Run Slither, fix findings, verify contract on ADI Chain explorer
