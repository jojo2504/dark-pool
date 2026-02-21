"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { Countdown } from "~~/components/darkpool/Countdown";
import { VAULT_ABI } from "~~/lib/contracts";
import { ZERO_ADDRESS } from "~~/lib/darkpool-config";
import { VaultPhase, phaseToStatus } from "~~/lib/types";
import { formatWei } from "~~/lib/utils";

interface VaultCardProps {
  address: `0x${string}`;
  index?: number;
  statusFilter?: string;
}

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function VaultCard({ address, index = 0, statusFilter = "all" }: VaultCardProps) {
  const contract = { address, abi: VAULT_ABI } as const;
  const { address: userAddress } = useAccount();

  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      { ...contract, functionName: "title" },
      { ...contract, functionName: "closeTime" },
      { ...contract, functionName: "depositRequired" },
      { ...contract, functionName: "getCurrentPhase" },
      { ...contract, functionName: "requiresAccreditation" },
      { ...contract, functionName: "paused" },
      { ...contract, functionName: "oracle" },
      { ...contract, functionName: "buyer" },
    ],
  });

  // Check if the connected user has bid on this vault
  const { data: userBid } = useReadContract({
    address,
    abi: VAULT_ABI,
    functionName: "bids",
    args: [userAddress ?? ZERO_ADDRESS],
    query: { enabled: !!userAddress, refetchInterval: 8_000 },
  });

  const userHasBid = userBid && (userBid as any)[0] !== ZERO_HASH;
  const userBidRevealed = userHasBid && (userBid as any)[3] === true;
  const userRevealedPrice = userBidRevealed ? ((userBid as any)[2] as bigint) : null;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.03 }}
        className="border border-white p-6 font-mono text-xs text-white opacity-100"
      >
        LOADING...
      </motion.div>
    );
  }

  if (isError || !data) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border border-white p-6 font-mono text-xs text-white opacity-100"
      >
        ERROR: {address.slice(0, 10)}...
      </motion.div>
    );
  }

  const title = (data[0].result ?? "UNNAMED") as string;
  const closeTime = (data[1].result ?? 0n) as bigint;
  const depositRequired = (data[2].result ?? 0n) as bigint;
  const phaseRaw = (data[3].result ?? 0) as number;
  const requiresAccreditation = (data[4].result ?? false) as boolean;
  const isPaused = (data[5].result ?? false) as boolean;
  const oracle = (data[6].result ?? "0x0") as string;
  const hasOracle = oracle !== "0x0000000000000000000000000000000000000000";
  const buyer = (data[7].result ?? ZERO_ADDRESS) as string;
  const isCreator = !!userAddress && buyer.toLowerCase() === userAddress.toLowerCase();

  const phase = phaseRaw as VaultPhase;
  const status = phaseToStatus(phase, closeTime);
  if (statusFilter === "mybids") {
    if (!userHasBid) return null;
  } else if (statusFilter !== "all" && status !== statusFilter) {
    return null;
  }

  const isOpen = status === "open";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }}>
      <Link href={`/auctions/${address}`}>
        <div className="group border border-white/30 hover:border-white p-6 transition-all duration-150 cursor-pointer relative">
          {/* Creator indicator */}
          {isCreator && (
            <div className="absolute top-0 right-0 font-mono text-[8px] uppercase tracking-[0.15em] bg-white text-black px-2 py-0.5">
              YOUR AUCTION
            </div>
          )}
          {/* Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100">
                {status.toUpperCase()}
              </span>
              {isPaused && (
                <span className="font-mono text-[9px] uppercase border border-red-400 text-red-400 px-1 py-0.5">
                  PAUSED
                </span>
              )}
              {requiresAccreditation && (
                <span className="font-mono text-[9px] uppercase border border-yellow-400/60 text-yellow-400/80 px-1 py-0.5">
                  ACCREDITED
                </span>
              )}
              {hasOracle && (
                <span className="font-mono text-[9px] uppercase border border-current/20 px-1 py-0.5">ORACLE</span>
              )}
              {userHasBid && (
                <span className="font-mono text-[9px] uppercase border border-green-400/60 text-green-400 px-1 py-0.5">
                  YOUR BID
                </span>
              )}
            </div>
            {isOpen && (
              <Countdown
                closeTimestamp={Number(closeTime)}
                className="font-mono text-[10px] tracking-[0.1em] uppercase"
              />
            )}
          </div>

          {/* Title */}
          <h3 className="font-mono text-sm font-bold uppercase tracking-[0.02em] mb-1">{title}</h3>
          <p className="font-mono text-[10px] opacity-60 mb-6 truncate">{address}</p>

          {/* Bottom row */}
          <div className="flex items-center justify-between font-mono text-xs">
            <span>
              <span className="opacity-60">DEPOSIT: </span>
              <span className="font-bold">{formatWei(depositRequired)}</span>
            </span>
          </div>

          {/* My bid info */}
          {userHasBid && (
            <div className="mt-3 border-t border-white/10 pt-3 flex items-center justify-between font-mono text-[10px]">
              <span className="opacity-60">YOUR BID</span>
              {userRevealedPrice !== null ? (
                <span className="font-bold text-green-400">{formatWei(userRevealedPrice, "DDSC")}</span>
              ) : (
                <span className="text-white/50 tracking-widest">● ● ● SEALED</span>
              )}
            </div>
          )}

          {/* Arrow */}
          <div className="mt-4 text-right font-mono text-xs opacity-0 group-hover:opacity-60 transition-opacity">→</div>
        </div>
      </Link>
    </motion.div>
  );
}
