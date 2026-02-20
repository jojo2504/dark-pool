/**
 * Server-side viem wallet client for on-chain KYB credentialing.
 * Calls ShadowBidFactory.verifyInstitution / revokeInstitution using the
 * platform admin private key stored in PLATFORM_ADMIN_PRIVATE_KEY.
 */
import { FACTORY_ABI } from "./contracts";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { adiTestnet } from "~~/scaffold.config";

// Explicit RPC URL — never falls back to a blank transport on ADI
const ADI_RPC = process.env.FACTORY_ADI_RPC ?? "https://rpc.ab.testnet.adifoundation.ai/";

function getAdminAccount() {
  const pk = process.env.PLATFORM_ADMIN_PRIVATE_KEY;
  if (!pk) throw new Error("PLATFORM_ADMIN_PRIVATE_KEY not set");
  return privateKeyToAccount(`0x${pk.replace(/^0x/, "")}` as `0x${string}`);
}

function getFactoryAddress(): `0x${string}` {
  const addr = process.env.FACTORY_CONTRACT_ADDRESS;
  if (!addr) throw new Error("FACTORY_CONTRACT_ADDRESS not set");
  return addr as `0x${string}`;
}

export async function onChainVerifyInstitution(
  walletAddress: `0x${string}`,
  isAccredited: boolean,
  jurisdiction = "",
): Promise<`0x${string}`> {
  const account = getAdminAccount();
  const factoryAddress = getFactoryAddress();

  const walletClient = createWalletClient({
    account,
    chain: adiTestnet,
    transport: http(ADI_RPC),
  });

  const publicClient = createPublicClient({
    chain: adiTestnet,
    transport: http(ADI_RPC),
  });

  // Step 1: KYB-verify the institution on-chain (sets verified[wallet] = true)
  const verifyHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "verifyInstitution",
    args: [walletAddress, isAccredited, jurisdiction, "0x" as `0x${string}`],
  });

  // Must mine before the next tx (nonce ordering + role check requires verify first)
  await publicClient.waitForTransactionReceipt({ hash: verifyHash });

  // Step 2: Grant BUYER_ROLE so the institution can call createVault()
  // Without this, createVault reverts with "AccessControl: missing role" which
  // ZKSync-based chains (like ADI) surface to MetaMask as "insufficient funds".
  const grantHash = await walletClient.writeContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "grantBuyerRole",
    args: [walletAddress],
  });

  return grantHash;
}

/**
 * Grant BUYER_ROLE to a wallet that already passed KYB but was verified
 * before this grantBuyerRole step was added to onChainVerifyInstitution.
 * Call this once for existing verified wallets that can't create auctions.
 */
export async function onChainGrantBuyerRole(walletAddress: `0x${string}`): Promise<`0x${string}`> {
  const account = getAdminAccount();
  const factoryAddress = getFactoryAddress();
  const walletClient = createWalletClient({
    account,
    chain: adiTestnet,
    transport: http(ADI_RPC),
  });
  return walletClient.writeContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "grantBuyerRole",
    args: [walletAddress],
  });
}

export async function onChainRevokeInstitution(walletAddress: `0x${string}`): Promise<`0x${string}`> {
  const account = getAdminAccount();
  const factoryAddress = getFactoryAddress();

  const walletClient = createWalletClient({
    account,
    chain: adiTestnet,
    transport: http(ADI_RPC),
  });

  // Use revokeInstitution ABI fragment directly
  const hash = await walletClient.writeContract({
    address: factoryAddress,
    abi: parseAbi(["function revokeInstitution(address inst) nonpayable"]),
    functionName: "revokeInstitution",
    args: [walletAddress],
  });

  return hash;
}

export async function isVerifiedOnChain(walletAddress: `0x${string}`): Promise<boolean> {
  const factoryAddress = getFactoryAddress();
  const publicClient = createPublicClient({
    chain: adiTestnet,
    transport: http(ADI_RPC),
  });
  return publicClient.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "verified",
    args: [walletAddress],
  }) as Promise<boolean>;
}
