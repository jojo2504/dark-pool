"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Ledger from "@daml/ledger";
import { CANTON_CONFIG, CantonWalletId, decodeJwtParty } from "@/lib/canton";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface CantonIdentity {
  /** Canton party ID, e.g. "Alice::122036abcd…" */
  party: string;
  /** JWT bearer token for the Daml HTTP JSON API */
  token: string;
  /** Which wallet was used to connect */
  walletId: CantonWalletId;
  /** Human-readable display name extracted from token / wallet */
  displayName: string;
}

interface CantonContextValue {
  status: ConnectionStatus;
  identity: CantonIdentity | null;
  /** Initialised Ledger instance from @daml/ledger — null when disconnected */
  ledger: Ledger | null;
  error: string | null;
  connect: (walletId: CantonWalletId, jwtOverride?: string) => Promise<void>;
  disconnect: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CantonContext = createContext<CantonContextValue>({
  status: "disconnected",
  identity: null,
  ledger: null,
  error: null,
  connect: async () => {},
  disconnect: () => {},
});

const STORAGE_KEY = "canton:identity";

// ─── Wallet adapters ──────────────────────────────────────────────────────────

/**
 * Try to obtain a JWT from the selected wallet.
 * Each adapter calls into the wallet's injected browser API.
 * Returns { party, token } or throws.
 */
async function requestWalletAuth(
  walletId: CantonWalletId,
  jwtOverride?: string
): Promise<{ party: string; token: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;

  switch (walletId) {
    case "jwt-manual": {
      if (!jwtOverride) throw new Error("No JWT token provided.");
      const party = decodeJwtParty(jwtOverride);
      if (!party) throw new Error("Could not extract party ID from JWT.");
      return { party, token: jwtOverride };
    }

    case "nightly": {
      // Nightly injects window.nightly — Canton adapter follows their chain-agnostic API
      if (!win.nightly?.canton) {
        throw new Error("Nightly wallet not detected. Install from nightly.app");
      }
      const result = await win.nightly.canton.connect({
        appName: CANTON_CONFIG.appId,
        network: CANTON_CONFIG.networkName,
      });
      if (!result?.token) throw new Error("Nightly did not return a token.");
      const party = decodeJwtParty(result.token) ?? result.party;
      if (!party) throw new Error("Could not resolve party from Nightly.");
      return { party, token: result.token };
    }

    case "digital-asset": {
      if (!win.daWallet) {
        throw new Error(
          "Digital Asset Wallet not detected. Install from digitalasset.com"
        );
      }
      const result = await win.daWallet.requestAccess({
        appId: CANTON_CONFIG.appId,
      });
      return { party: result.party, token: result.token };
    }

    case "splice": {
      if (!win.spliceWallet) {
        throw new Error("Splice Wallet not detected.");
      }
      const result = await win.spliceWallet.connect();
      return { party: result.party, token: result.token };
    }

    default:
      throw new Error(`Unknown wallet: ${walletId}`);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CantonProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [identity, setIdentity] = useState<CantonIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: CantonIdentity = JSON.parse(raw);
        // TODO: verify token expiry here
        setIdentity(saved);
        setStatus("connected");
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const connect = useCallback(
    async (walletId: CantonWalletId, jwtOverride?: string) => {
      setStatus("connecting");
      setError(null);
      try {
        const { party, token } = await requestWalletAuth(walletId, jwtOverride);
        const displayName = party.includes("::")
          ? party.split("::")[0]
          : party;
        const id: CantonIdentity = { party, token, walletId, displayName };
        setIdentity(id);
        setStatus("connected");
        localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus("error");
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    setIdentity(null);
    setStatus("disconnected");
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const ledger = useMemo<Ledger | null>(() => {
    if (!identity) return null;
    return new Ledger({
      token: identity.token,
      httpBaseUrl: CANTON_CONFIG.ledgerUrl,
      wsBaseUrl: CANTON_CONFIG.wsUrl,
    });
  }, [identity]);

  return (
    <CantonContext.Provider
      value={{ status, identity, ledger, error, connect, disconnect }}
    >
      {children}
    </CantonContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCanton(): CantonContextValue {
  return useContext(CantonContext);
}
