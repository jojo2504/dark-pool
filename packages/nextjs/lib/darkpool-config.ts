// ─── Contract addresses ───────────────────────────────────────────────────────
// Primary: NEXT_PUBLIC_FACTORY_ADDRESS env var (set in .env after deploy).
// Fallback: hardcoded address from the last deployment — avoids a circular
// import that would occur if we imported deployedContracts.ts here
// (deployedContracts → contract.ts → deployedContracts again).
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "0xbF8F2953af175aDb72e51B95e9C8157fA2398622") as `0x${string}`;

// DDSC: UAE Central Bank-licensed dirham stablecoin on ADI Chain.
// Settlement is always DDSC — ADI (native) is used only for gas fees and bid deposits.
// https://adifoundation.ai/ddsc
export const DDSC_ADDRESS = (process.env.NEXT_PUBLIC_DDSC_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Optional ERC-20 token addresses for the wallet balance widget.
// Set these in .env once the tokens are deployed on ADI testnet.
export const ADI_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ADI_TOKEN_ADDRESS || undefined;
export const DDSC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DDSC_ADDRESS || undefined;

// Settlement is always DDSC on this platform.
// ADI (native) is used only for gas fees and bid security deposits — never for settlement.
export const SETTLEMENT_TOKENS: Record<string, { label: string; address: `0x${string}` }> = {
  DDSC: { label: "DDSC (AED Stablecoin)", address: DDSC_ADDRESS },
};

// ─── Zero address ─────────────────────────────────────────────────────────────
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
