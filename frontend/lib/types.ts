// ─── Primitives ───────────────────────────────────────────────────────────────

/** Auction lifecycle state */
export type AuctionStatus = "active" | "pending" | "closed" | "settled" | "cancelled";

export type AuctionVisibility = "public" | "private";

/** Sealed = hidden bids; Dutch = descending price; Vickrey = pay 2nd price */
export type AuctionType = "sealed" | "dutch" | "vickrey";

// ─── Params (immutable after creation) ────────────────────────────────────────

/**
 * All amounts are raw USDCx strings (6 decimals, e.g. "10000000" = 10 USDCx).
 * All fields are locked on-chain at creation — never mutated.
 */
export interface AuctionParams {
  // ── Pricing (raw USDCx strings) ──────────────────────────────
  startingBid: string;
  reservePrice?: string;
  minBidIncrement: string;
  buyNowPrice?: string;
  showReservePrice: boolean;

  // ── Timing ───────────────────────────────────────────────────
  durationHours: number;
  antiSnipingWindowMinutes: number;
  antiSnipingExtensionMinutes: number;

  // ── Access control ───────────────────────────────────────────
  visibility: AuctionVisibility;
  auctionType: AuctionType;
  maxBidders: number;
  bidDepositPercent: number;
}

// ─── Auction state (live, mutable) ────────────────────────────────────────────

export interface AuctionState {
  id: string;
  title: string;
  category: string;
  status: AuctionStatus;

  /** Immutable rules locked at creation */
  params: AuctionParams;

  /** Current highest bid (raw USDCx string). Undefined before first bid. */
  currentBid?: string;
  bidCount: number;

  /** Unix ms timestamp */
  endsAt?: number;
  createdAt?: number;
  createdBy?: string;
  winner?: string;
}

// ─── Bid ──────────────────────────────────────────────────────────────────────

export interface Bid {
  id: string;
  auctionId: string;
  bidder: string;
  /** Raw USDCx string */
  amount: string;
  lockedAmount: string;
  timestamp: number;
  isWinning?: boolean;
  revealed?: boolean;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export interface CreateAuctionFormData {
  title: string;
  description: string;
  category: string;
  startingBid: number;
  reservePrice?: number;
  minBidIncrement: number;
  buyNowPrice?: number;
  showReservePrice: boolean;
  durationHours: number;
  antiSnipingWindowMinutes: number;
  antiSnipingExtensionMinutes: number;
  visibility: AuctionVisibility;
  auctionType: AuctionType;
  maxBidders: number;
  bidDepositPercent: number;
}
