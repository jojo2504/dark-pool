"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertCircle, ArrowRight, Clock, Lock, Users } from "lucide-react";
import { useReadContracts } from "wagmi";
import { VAULT_ABI } from "~~/lib/contracts";
import { VaultPhase, phaseToStatus } from "~~/lib/types";
import { formatTimeLeft, formatWei } from "~~/lib/utils";

interface VaultCardProps {
    address: `0x${string}`;
    index?: number;
    statusFilter?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    open: {
        label: "Open",
        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        dot: "bg-emerald-400",
    },
    reveal: {
        label: "Reveal",
        color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
        dot: "bg-cyan-400",
    },
    settled: {
        label: "Settled",
        color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
        dot: "bg-zinc-400",
    },
    cancelled: {
        label: "Cancelled",
        color: "text-red-400 bg-red-400/10 border-red-400/20",
        dot: "bg-red-400",
    },
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
            { ...contract, functionName: "buyer" },
        ],
    });

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse h-44"
            />
        );
    }

    if (isError || !data) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-2xl border border-red-500/20 bg-white/[0.02] p-5 flex items-center gap-2 text-red-400 text-xs"
            >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Failed to load vault {address.slice(0, 8)}…
            </motion.div>
        );
    }

    const title = (data[0].result ?? "Unnamed Vault") as string;
    const closeTime = (data[1].result ?? 0n) as bigint;
    const depositRequired = (data[2].result ?? 0n) as bigint;
    const bidCount = (data[3].result ?? 0n) as bigint;
    const phaseRaw = (data[4].result ?? 0) as number;

    const phase = phaseRaw as VaultPhase;
    const status = phaseToStatus(phase, closeTime);

    if (statusFilter !== "all" && status !== statusFilter) return null;

    const cfg = STATUS_CONFIG[status];
    const nowSec = Math.floor(Date.now() / 1000);
    const secsLeft = Math.max(0, Number(closeTime) - nowSec);
    const isOpen = status === "open";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
        >
            <Link href={`/auctions/${address}`}>
                <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200 overflow-hidden cursor-pointer">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/0 to-transparent group-hover:via-cyan-500/40 transition-all duration-300" />

                    {isOpen && (
                        <span className="absolute top-4 right-4 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                        </span>
                    )}

                    <div className="p-5">
                        <div className="mb-3 pr-4">
                            <h3 className="text-white font-medium text-sm truncate group-hover:text-cyan-300 transition-colors">
                                {title}
                            </h3>
                            <p className="text-zinc-600 font-mono text-[10px] mt-0.5 truncate">{address}</p>
                        </div>

                        <div className="mb-4">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cfg.color}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                            </span>
                        </div>

                        <div className="bg-white/[0.03] rounded-xl p-3 mb-3 border border-white/[0.04]">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Required Deposit</p>
                            <p className="text-white font-mono font-semibold text-base">{formatWei(depositRequired)}</p>
                        </div>

                        <div className="flex items-center justify-between text-xs text-zinc-500">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {isOpen ? formatTimeLeft(secsLeft) : cfg.label}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {Number(bidCount)} bids
                                </span>
                            </div>
                            <Lock className="w-3 h-3" />
                        </div>

                        <div className="absolute bottom-4 right-4 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all">
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
