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

const STATUS_LABEL: Record<string, string> = {
  open: "OPEN",
  reveal: "REVEAL",
  settled: "SETTLED",
  cancelled: "CANCELLED",
};

export function VaultCard({ address, index = 0, statusFilter = "all" }: VaultCardProps) {
  const contract = { address, abi: VAULT_ABI } as const;

  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      { ...contract, functionName: "title" },
      { ...contract, functionName: "closeTime" },
      { ...contract, functionName: "depositRequired" },
      { ...contract, functionName: "getBidCount" },
      { ...contract, functionName: "getCurrentPhase" },
    ],
  });

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.03 }}
        className="border border-white p-6 font-mono text-xs text-white opacity-30"
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
        className="border border-white p-6 font-mono text-xs text-white opacity-30"
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
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-40 group-hover:opacity-60">
              {STATUS_LABEL[status]}
            </span>
            {isOpen && (
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase">{formatTimeLeft(secsLeft)}</span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-mono text-sm font-bold uppercase tracking-[0.02em] mb-1">{title}</h3>
          <p className="font-mono text-[10px] opacity-30 mb-6 truncate">{address}</p>

          {/* Bottom row */}
          <div className="flex items-center justify-between font-mono text-xs">
            <span>
              <span className="opacity-40">DEPOSIT: </span>
              <span className="font-bold">{formatWei(depositRequired)}</span>
            </span>
            <span>
              <span className="opacity-40">BIDS: </span>
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
