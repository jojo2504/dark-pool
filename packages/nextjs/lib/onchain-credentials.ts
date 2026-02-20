/**
 * Server-side viem wallet client for on-chain KYB credentialing.
 * Calls ShadowBidFactory.verifyInstitution / revokeInstitution using the
 * platform admin private key stored in PLATFORM_ADMIN_PRIVATE_KEY.
 */
import { FACTORY_ABI } from "./contracts";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ADI Chain definition (not in the viem/chains registry yet)
const adiChain = {
  id: 99999,
  name: "ADI Chain Testnet",
  nativeCurrency: { name: "ADI", symbol: "ADI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ab.testnet.adifoundation.ai/"] },
    public: { http: ["https://rpc.ab.testnet.adifoundation.ai/"] },
  },
} as const;

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
    chain: adiChain,
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
    chain: adiChain,
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
    chain: adiChain,
    transport: http(),
  });
  return publicClient.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: "verified",
    args: [walletAddress],
  }) as Promise<boolean>;
}
