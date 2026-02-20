// ─── Contract addresses ───────────────────────────────────────────────────────

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
// DDSC: UAE Central Bank-licensed dirham stablecoin on ADI Chain
// https://adifoundation.ai/ddsc
export const DDSC_ADDRESS = (process.env.NEXT_PUBLIC_DDSC_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Convenience map of settlement tokens shown in the Create Vault form
export const SETTLEMENT_TOKENS: Record<string, { label: string; address: `0x${string}` }> = {
  ETH: { label: "ETH (Native)", address: "0x0000000000000000000000000000000000000000" },
  DDSC: { label: "DDSC (AED Stablecoin)", address: DDSC_ADDRESS },
};
