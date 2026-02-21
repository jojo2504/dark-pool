"use client";

import { useCallback, useEffect } from "react";
import { useTargetNetwork } from "./useTargetNetwork";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

/**
 * LocalStorage keys used by RainbowKit/Wagmi that can cause stale connections
 */
const WALLET_STORAGE_KEYS = [
  "walletconnect-wallets",
  "walletconnect",
  "@rainbow-me/rainbowkit/connectors",
  "wagmi.connector",
  "wagmi.store",
];

/**
 * Clear all wallet connection data from localStorage
 * This prevents stale connections when a wallet becomes unavailable
 */
export const clearWalletStorage = () => {
  if (typeof window === "undefined") return;

  WALLET_STORAGE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  });
};

/**
 * Hook that fixes wallet localStorage sync issues by:
 * - Clearing stale storage on connection errors
 * - Detecting unavailable connectors
 * - Providing a manual reset function
 */
export const useWalletStorageFix = () => {
  const { isConnected, connector, isReconnecting } = useAccount();
  const { error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  /**
   * Check if the current connector is still available
   * Some wallets may have been uninstalled or are no longer accessible
   */
  const isConnectorAvailable = useCallback(async () => {
    if (!connector) return false;

    try {
      // Check if the connector can get accounts
      const accounts = await connector.getAccounts();
      return accounts.length > 0 || connector.id === "walletConnect";
    } catch {
      return false;
    }
  }, [connector]);

  /**
   * Handle connection errors by clearing storage and disconnecting
   */
  const handleConnectionError = useCallback(() => {
    console.warn("[Wallet Sync Fix] Connection error detected, clearing stale storage");
    clearWalletStorage();
    disconnect();
  }, [disconnect]);

  /**
   * Validate current connection state and fix if stale
   */
  const validateAndFixConnection = useCallback(async () => {
    if (!isConnected || !connector) return;

    const available = await isConnectorAvailable();
    if (!available) {
      console.warn("[Wallet Sync Fix] Connector unavailable, clearing storage");
      clearWalletStorage();
      disconnect();
    }
  }, [isConnected, connector, isConnectorAvailable, disconnect]);

  /**
   * Setup error listeners on mount
   */
  useEffect(() => {
    // Clear any stale storage on initial mount (development cleanup)
    // Only in development or if we're in a weird state
    const hasStaleData = WALLET_STORAGE_KEYS.some(key => localStorage.getItem(key));

    // If there's storage but no connected wallet, clear it
    if (hasStaleData && !isConnected && !isReconnecting) {
      console.log("[Wallet Sync Fix] Found stale storage with no connection, clearing");
      clearWalletStorage();
    }
  }, [isConnected, isReconnecting]);

  /**
   * Monitor connection state changes
   */
  useEffect(() => {
    // If we have a connect error, clear storage
    if (connectError) {
      handleConnectionError();
    }
  }, [connectError, handleConnectionError]);

  /**
   * Validate connection when connector changes
   */
  useEffect(() => {
    if (isConnected && connector) {
      // Small delay to let connection stabilize
      const timer = setTimeout(() => {
        validateAndFixConnection();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, connector, validateAndFixConnection]);

  return {
    clearWalletStorage,
    validateAndFixConnection,
    isConnectorAvailable,
  };
};

/**
 * Hook to force reconnection to the target network
 * Shows a clean "Connect" button without random addresses
 */
export const useCleanConnect = () => {
  const { connect, connectors, error: connectError } = useConnect();
  const { switchChain } = useSwitchChain();
  const { targetNetwork } = useTargetNetwork();
  const { clearWalletStorage } = useWalletStorageFix();
  const { isConnected } = useAccount();

  const cleanConnect = useCallback(async () => {
    // Clear any stale storage first
    clearWalletStorage();

    // Connect using the first available connector
    const firstConnector = connectors[0];
    if (!firstConnector) {
      console.error("No connectors available");
      return;
    }

    try {
      await connect({ connector: firstConnector, chainId: targetNetwork.id });
    } catch (err) {
      console.error("Connection failed:", err);
      // Storage already cleared, let user retry
      throw err;
    }
  }, [connect, connectors, targetNetwork.id, clearWalletStorage]);

  const switchToTargetNetwork = useCallback(() => {
    try {
      switchChain({ chainId: targetNetwork.id });
    } catch (err) {
      console.error("Network switch failed:", err);
    }
  }, [switchChain, targetNetwork.id]);

  return {
    cleanConnect,
    switchToTargetNetwork,
    isConnected,
    hasError: !!connectError,
  };
};

// Re-export useTargetNetwork for convenience
export { useTargetNetwork } from "./useTargetNetwork";
