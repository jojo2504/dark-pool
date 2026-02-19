// ─── Canton Network configuration ────────────────────────────────────────────

export const CANTON_CONFIG = {
  /** Canton participant HTTP JSON API endpoint */
  ledgerUrl:
    process.env.NEXT_PUBLIC_CANTON_LEDGER_URL ?? "http://localhost:7575",
  /** Canton participant WebSocket endpoint */
  wsUrl:
    process.env.NEXT_PUBLIC_CANTON_WS_URL ?? "ws://localhost:7575",
  /** Human-readable network name */
  networkName: process.env.NEXT_PUBLIC_CANTON_NETWORK_NAME ?? "Canton Network",
  /** Daml application ID — must match the one in daml.yaml */
  appId: process.env.NEXT_PUBLIC_CANTON_APP_ID ?? "dark-pool",
} as const;

// ─── Canton wallet definitions ────────────────────────────────────────────────

export type CantonWalletId =
  | "nightly"
  | "digital-asset"
  | "splice"
  | "jwt-manual";

export interface CantonWallet {
  id: CantonWalletId;
  name: string;
  description: string;
  /** SVG icon path or emoji fallback */
  icon: string;
  /** True when a browser extension / native app is detected */
  available: boolean;
  institutional: boolean;
  /** URL to install if not available */
  installUrl?: string;
}

/**
 * Detect Canton-aware wallets injected into the browser global.
 * Each wallet SDK injects itself under `window.canton.<walletId>`.
 */
function detect(walletKey: string): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any)?.[walletKey];
}

export function getCantonWallets(): CantonWallet[] {
  return [
    {
      id: "nightly",
      name: "Nightly Wallet",
      description: "Multi-chain non-custodial wallet with Canton support",
      icon: "/wallets/nightly.svg",
      available: detect("nightly"),
      institutional: false,
      installUrl: "https://nightly.app",
    },
    {
      id: "digital-asset",
      name: "Digital Asset Wallet",
      description: "Official Canton wallet by Digital Asset",
      icon: "/wallets/digital-asset.svg",
      available: detect("daWallet"),
      institutional: true,
      installUrl: "https://www.digitalasset.com/canton",
    },
    {
      id: "splice",
      name: "Splice Wallet",
      description: "Open-source Canton ecosystem wallet",
      icon: "/wallets/splice.svg",
      available: detect("spliceWallet"),
      institutional: false,
      installUrl: "https://canton.network/splice",
    },
    {
      id: "jwt-manual",
      name: "JWT / API Key",
      description: "Paste a JWT token issued by your Canton participant node",
      icon: "/wallets/jwt.svg",
      available: true, // always available — user provides the token
      institutional: true,
    },
  ];
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/** Decode the `sub` and `aud` from a JWT payload (no signature verification). */
export function decodeJwtParty(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    // Daml JWT convention: "sub" holds the party ID, or check "https://daml.com/ledger-api"
    return (
      decoded?.sub ??
      decoded?.["https://daml.com/ledger-api"]?.actAs?.[0] ??
      decoded?.party ??
      null
    );
  } catch {
    return null;
  }
}

/** Shorten a Canton party ID for display.
 * "Alice::122036abcd...ef" → "Alice::1220…cdef"
 */
export function formatPartyId(party: string): string {
  if (!party) return "";
  const sep = party.indexOf("::");
  if (sep === -1) return party.length > 16 ? `${party.slice(0, 8)}…${party.slice(-6)}` : party;
  const display = party.slice(0, sep);
  const hash = party.slice(sep + 2);
  const shortHash = `${hash.slice(0, 4)}…${hash.slice(-4)}`;
  return `${display}::${shortHash}`;
}
