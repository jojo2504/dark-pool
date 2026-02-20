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
