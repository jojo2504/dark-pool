/**
 * Server-side viem wallet client for on-chain KYB credentialing.
 * Calls ShadowBidFactory.verifyInstitution / revokeInstitution using the
 * platform admin private key stored in PLATFORM_ADMIN_PRIVATE_KEY.
 */
import { FACTORY_ABI } from "./contracts";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { adiTestnet } from "~~/scaffold.config";

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
    transport: http(),
  });

  const hash = await walletClient.writeContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "verifyInstitution",
    args: [walletAddress, isAccredited, jurisdiction, "0x" as `0x${string}`],
  });

  return hash;
}

export async function onChainRevokeInstitution(walletAddress: `0x${string}`): Promise<`0x${string}`> {
  const account = getAdminAccount();
  const factoryAddress = getFactoryAddress();

  const walletClient = createWalletClient({
    account,
    chain: adiTestnet,
    transport: http(),
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
    transport: http(),
  });
  return publicClient.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "verified",
    args: [walletAddress],
  }) as Promise<boolean>;
}
