import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@matterlabs/hardhat-zksync";
import * as dotenv from "dotenv";
dotenv.config();

const DEPLOYER_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0x" + "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    // ── ADI Chain Testnet (ZKsync-based) ──
    adiTestnet: {
      url:
        process.env.ADI_TESTNET_RPC ||
        "https://rpc.ab.testnet.adifoundation.ai/",
      chainId: 99999,
      accounts: [DEPLOYER_KEY],
      zksync: true,
      ethNetwork: "sepolia",
    },
    // ── ADI Chain Mainnet ──
    adiMainnet: {
      url: process.env.ADI_MAINNET_RPC || "https://rpc.adifoundation.ai",
      chainId: 36900,
      accounts: [DEPLOYER_KEY],
      zksync: true,
      ethNetwork: "mainnet",
    },
    // ── 0G Chain Testnet (EVM standard) ──
    zerogTestnet: {
      url: process.env.ZG_RPC || "https://evmrpc-testnet.0g.ai",
      chainId: 16601,
      accounts: [DEPLOYER_KEY],
    },
  },
  zksolc: {
    version: "latest",
    settings: {},
  },
};

export default config;
