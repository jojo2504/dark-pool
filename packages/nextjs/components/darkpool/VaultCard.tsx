"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useReadContracts } from "wagmi";
import { VAULT_ABI } from "~~/lib/contracts";
import { VaultPhase, phaseToStatus } from "~~/lib/types";
import { formatTimeLeft, formatWei } from "~~/lib/utils";

interface VaultCardProps {
  address: `0x${string}`;
  index?: number;
  statusFilter?: string;
}

export function VaultCard({ address, index = 0, statusFilter = "all" }: VaultCardProps) {
  const contract = { address, abi: VAULT_ABI } as const;

  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      { ...contract, functionName: "title" },
      { ...contract, functionName: "closeTime" },
      { ...contract, functionName: "depositRequired" },
      { ...contract, functionName: "getBidCount" },
      { ...contract, functionName: "getCurrentPhase" },
      { ...contract, functionName: "requiresAccreditation" },
      { ...contract, functionName: "paused" },
      { ...contract, functionName: "oracle" },
    ],
  });

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
  const bidCount = (data[3].result ?? 0n) as bigint;
  const phaseRaw = (data[4].result ?? 0) as number;
  const requiresAccreditation = (data[5].result ?? false) as boolean;
  const isPaused = (data[6].result ?? false) as boolean;
  const oracle = (data[7].result ?? "0x0") as string;
  const hasOracle = oracle !== "0x0000000000000000000000000000000000000000";

  const phase = phaseRaw as VaultPhase;
  const status = phaseToStatus(phase, closeTime);
  if (statusFilter !== "all" && status !== statusFilter) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const secsLeft = Math.max(0, Number(closeTime) - nowSec);
  const isOpen = status === "open";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }}>
      <Link href={`/auctions/${address}`}>
        <div className="group border border-white p-6 hover:opacity-60 transition-all duration-100 cursor-pointer">
          {/* Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 group-hover:opacity-60">
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
                <span className="font-mono text-[9px] uppercase border border-white/20 text-white px-1 py-0.5">
                  ORACLE
                </span>
              )}
            </div>
            {isOpen && (
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase">{formatTimeLeft(secsLeft)}</span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-mono text-sm font-bold uppercase tracking-[0.02em] mb-1">{title}</h3>
          <p className="font-mono text-[10px] opacity-100 mb-6 truncate">{address}</p>

          {/* Bottom row */}
          <div className="flex items-center justify-between font-mono text-xs">
            <span>
              <span className="opacity-100">DEPOSIT: </span>
              <span className="font-bold">{formatWei(depositRequired)}</span>
            </span>
            <span>
              <span className="opacity-100">BIDS: </span>
              <span className="font-bold">{Number(bidCount)}</span>
            </span>
          </div>

          {/* Arrow */}
          <div className="mt-4 text-right font-mono text-xs opacity-0 group-hover:opacity-60 transition-opacity">→</div>
        </div>
      </Link>
    </motion.div>
  );
}
