import { defineChain } from "viem";
import * as chains from "viem/chains";

// ── ADI Chain (not yet in viem/chains) ────────────────────────────────────────
export const adiTestnet = defineChain({
  id: 99999,
  name: "ADI Testnet",
  nativeCurrency: { name: "ADI", symbol: "ADI", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ADI_TESTNET_RPC ?? "https://rpc.ab.testnet.adifoundation.ai/"] },
  },
  blockExplorers: {
    default: { name: "ADI Explorer", url: "https://explorer.ab.testnet.adifoundation.ai" },
  },
  testnet: true,
});

// ── 0G Galileo Testnet ────────────────────────────────────────────────────────
export const ogGalileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "cR4WnXePioePZ5fFrnSiR";

const scaffoldConfig = {
  // The networks on which your DApp is live
  // Contracts are deployed on ADI Chain — gas fees paid in ADI
  //targetNetworks: [chains.sepolia, chains.hardhat],
  //targetNetworks: [ogGalileo],
  targetNetworks: [adiTestnet],
  // The interval at which your front-end polls the RPC servers for new data
  pollingInterval: 4000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL.
  //
  // MEV / FRONT-RUNNING PROTECTION:
  // For mainnet bid commits, route through Flashbots Protect to avoid mempool sniping.
  // For ADI Chain, use the native private mempool RPC (check ADI Foundation docs).
  // Uncomment the relevant line when deploying to live networks.
  rpcOverrides: {
    // Flashbots Protect — hides pending txs from searchers on Ethereum mainnet
    // [chains.mainnet.id]: "https://rpc.flashbots.net",
    // ADI Chain Testnet (chain ID 99999) — explicit override so wagmi doesn't fall back to a blank http() transport
    [adiTestnet.id]: process.env.NEXT_PUBLIC_ADI_TESTNET_RPC ?? "https://rpc.ab.testnet.adifoundation.ai/",
    // ADI Chain Mainnet (chain ID 36900)
    // [36900]: process.env.NEXT_PUBLIC_ADI_MAINNET_RPC ?? "https://rpc.adifoundation.ai/",
    // 0G Galileo Testnet (data availability layer only — not for gas)
    // [ogGalileo.id]: process.env.NEXT_PUBLIC_OG_GALILEO_RPC ?? "https://evmrpc-testnet.0g.ai",
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  onlyLocalBurnerWallet: true,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
