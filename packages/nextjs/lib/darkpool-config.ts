// ─── Contract addresses ───────────────────────────────────────────────────────
// Primary: NEXT_PUBLIC_FACTORY_ADDRESS env var (set in .env after deploy).
// Fallback: hardcoded address from the last deployment — avoids a circular
// import that would occur if we imported deployedContracts.ts here
// (deployedContracts → contract.ts → deployedContracts again).
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "0x01D63639b43985e7201120208F35E2DD6C128d94") as `0x${string}`;

// DDSC: UAE Central Bank-licensed dirham stablecoin on ADI Chain
// https://adifoundation.ai/ddsc
export const DDSC_ADDRESS = (process.env.NEXT_PUBLIC_DDSC_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Optional ERC-20 token addresses — empty string / unset = feature disabled.
// Set these in .env once the tokens are deployed/bridged to ADI testnet.
export const WETH_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_WETH_ADDRESS || undefined;
export const ADI_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ADI_TOKEN_ADDRESS || undefined;
export const USDC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || undefined;

// Convenience map of settlement tokens shown in the Create Vault form
export const SETTLEMENT_TOKENS: Record<string, { label: string; address: `0x${string}` }> = {
  ETH: { label: "ADI (Native)", address: "0x0000000000000000000000000000000000000000" },
  DDSC: { label: "DDSC (AED Stablecoin)", address: DDSC_ADDRESS },
};

// ─── Zero address ─────────────────────────────────────────────────────────────
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
