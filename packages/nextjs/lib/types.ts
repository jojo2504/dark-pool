// ─── On-chain vault phase (mirrors ShadowBidVault.Phase enum) ─────────────────

export enum VaultPhase {
  OPEN = 0,
  REVEAL = 1,
  SETTLED = 2,
  CANCELLED = 3,
}

export const PHASE_LABEL: Record<VaultPhase, string> = {
  [VaultPhase.OPEN]: "Open",
  [VaultPhase.REVEAL]: "Reveal",
  [VaultPhase.SETTLED]: "Settled",
  [VaultPhase.CANCELLED]: "Cancelled",
};

// ─── KYB Status ───────────────────────────────────────────────────────────────

export type KYBStatus = "not_found" | "pending" | "under_review" | "verified" | "rejected" | "suspended";

export const KYB_STATUS_LABEL: Record<KYBStatus, string> = {
  not_found: "Not Registered",
  pending: "Pending Review",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const KYB_STATUS_COLOR: Record<KYBStatus, string> = {
  not_found: "text-white/40",
  pending: "text-yellow-400",
  under_review: "text-blue-400",
  verified: "text-green-400",
  rejected: "text-red-400",
  suspended: "text-orange-400",
};

// ─── Vault info (read from ShadowBidVault) ────────────────────────────────────

export interface VaultInfo {
  address: `0x${string}`;
  buyer: `0x${string}`;
  title: string;
  description: string;
  buyerECIESPubKey: string;
  closeTime: bigint;
  revealDeadline: bigint;
  depositRequired: bigint;
  phase: VaultPhase;
  winner: `0x${string}`;
  winningPrice: bigint;
  bidCount: bigint;
  // New fields
  assetProofHash: `0x${string}`;
  declaredAssetValue: bigint;
  creatorBond: bigint;
  oracle: `0x${string}`;
  delivered: boolean;
  paymentSubmitted: boolean;
  settlementDeadline: bigint;
  biddingStartTime: bigint;
  requiresAccreditation: boolean;
  paused: boolean;
}

// ─── Bid info (read from bids(address)) ──────────────────────────────────────

export interface BidInfo {
  commitHash: `0x${string}`;
  storageRoot: string;
  revealedPrice: bigint;
  revealed: boolean;
  depositPaid: boolean;
  depositReturned: boolean;
}

// ─── Create vault form ────────────────────────────────────────────────────────

export interface CreateVaultFormData {
  title: string;
  description: string;
  durationHours: number;
  revealWindowHours: number;
  depositEth: string;
  allowedSuppliersRaw: string;
  buyerECIESPubKey: string;
  // New compliance fields
  oracleAddress: string;
  assetDocumentHash: string; // keccak256 of legal doc
  declaredAssetValueEth: string;
  settlementWindowHours: number;
  oracleTimeoutDays: number;
  requiresAccreditation: boolean;
  allowedJurisdictionsRaw: string; // comma-separated, e.g. "UAE,KSA,UK"
  reviewWindowHours: number;
  creatorBondEth: string; // auto-calculated but user can override
}

// ─── Commit bid form ──────────────────────────────────────────────────────────

export interface CommitBidFormData {
  priceEth: string;
  storageRoot: string;
}

// ─── Reveal bid form ─────────────────────────────────────────────────────────

export interface RevealBidFormData {
  priceEth: string;
  salt: `0x${string}`;
}

// ─── Phase helpers ────────────────────────────────────────────────────────────

export function phaseToStatus(phase: VaultPhase, closeTime: bigint): "open" | "reveal" | "settled" | "cancelled" {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (phase === VaultPhase.OPEN && now >= closeTime) return "reveal";
  switch (phase) {
    case VaultPhase.OPEN:
      return "open";
    case VaultPhase.REVEAL:
      return "reveal";
    case VaultPhase.SETTLED:
      return "settled";
    case VaultPhase.CANCELLED:
      return "cancelled";
  }
}
