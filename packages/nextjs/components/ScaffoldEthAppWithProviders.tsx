"use client";

import { useEffect, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { toast } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { useAccount, useSwitchChain } from "wagmi";
import { Header } from "~~/components/Header";
import { FooterSection } from "~~/components/darkpool/FooterSection";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useWalletStorageFix } from "~~/hooks/scaffold-eth/useWalletStorageFix";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

// Polyfill localStorage for SSR — RainbowKit calls localStorage.getItem()
// during server render (getRecentWalletIds). This no-op prevents the crash.
if (typeof window === "undefined") {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  };
}

// Suppress WalletConnect/RainbowKit Analytics SDK errors
// These are non-critical telemetry errors that don't affect functionality
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args) => {
    // Filter out WalletConnect Analytics SDK errors
    const message = args[0];
    if (typeof message === "string" && (message.includes("Analytics SDK") || message.includes("Failed to fetch"))) {
      return; // Suppress
    }
    originalError.apply(console, args);
  };
}

/**
 * Component that monitors wallet connection state and fixes sync issues
 */
const WalletConnectionMonitor = ({ children }: { children: React.ReactNode }) => {
  const { targetNetwork } = useTargetNetwork();
  const { isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { validateAndFixConnection } = useWalletStorageFix();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    // Validate connection after a short delay on mount
    const timer = setTimeout(() => {
      validateAndFixConnection();
    }, 1500);

    return () => clearTimeout(timer);
  }, [validateAndFixConnection]);

  useEffect(() => {
    // If connected but on wrong network, offer to switch
    if (isConnected && chain && chain.id !== targetNetwork.id) {
      if (!hasShownToast) {
        toast(
          (t: string) => (
            <div className="flex items-center gap-2">
              <span>Wrong network detected. Switch to {targetNetwork.name}?</span>
              <button
                className="btn btn-xs btn-primary"
                onClick={() => {
                  try {
                    switchChain({ chainId: targetNetwork.id });
                    toast.dismiss(t);
                  } catch {
                    toast.error("Failed to switch network");
                  }
                }}
              >
                Switch
              </button>
              <button className="btn btn-xs btn-ghost" onClick={() => toast.dismiss(t)}>
                Dismiss
              </button>
            </div>
          ),
          { duration: 10000 },
        );
        setHasShownToast(true);
      }
    }
  }, [isConnected, chain, targetNetwork, switchChain, hasShownToast]);

  // Reset toast shown flag when network changes
  useEffect(() => {
    if (chain?.id === targetNetwork.id) {
      setHasShownToast(false);
    }
  }, [chain?.id, targetNetwork.id]);

  return children;
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div className="flex flex-col min-h-screen bg-black">
        <Header />
        <main className="relative flex flex-col flex-1">{children}</main>
        <FooterSection />
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#000000",
            color: "#ffffff",
            border: "1px solid #ffffff",
            borderRadius: "0",
            fontSize: "11px",
            fontFamily: "monospace",
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
          },
        }}
      />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          avatar={BlockieAvatar}
          theme={mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()}
        >
          <ProgressBar height="3px" color="#2299dd" />
          <WalletConnectionMonitor>
            <ScaffoldEthApp>{children}</ScaffoldEthApp>
          </WalletConnectionMonitor>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
