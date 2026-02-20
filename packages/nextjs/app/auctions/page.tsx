"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { VaultCard } from "~~/components/darkpool/VaultCard";
import { FACTORY_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS } from "~~/lib/darkpool-config";

type StatusFilter = "all" | "open" | "reveal" | "settled" | "cancelled";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "reveal", label: "Reveal" },
    { value: "settled", label: "Settled" },
    { value: "cancelled", label: "Cancelled" },
];

export default function AuctionsPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [showFilters, setShowFilters] = useState(false);

    const {
        data: vaultAddresses,
        isLoading,
        isError,
        refetch,
    } = useReadContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "getAllVaults",
    });

    const addresses = (vaultAddresses ?? []) as `0x${string}`[];

    return (
        <div className="min-h-screen bg-[#050505] pt-28 pb-20 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white">Auctions</h1>
                        <p className="text-zinc-500 text-sm mt-1">
                            Sealed-bid commit-reveal vaults on-chain
                            {addresses.length > 0 && (
                                <span className="text-emerald-400 font-medium ml-1">· {addresses.length} total</span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            onClick={() => refetch()}
                            className="p-2 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <Link
                            href="/auctions/create"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            New Auction
                        </Link>
                    </div>
                </motion.div>

                {/* Search + Filter bar */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex flex-col sm:flex-row gap-3 mb-6"
                >
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search by vault address or title…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all"
                        />
                    </div>

                    <button
                        onClick={() => setShowFilters(p => !p)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${showFilters
                                ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                                : "border-white/[0.08] text-zinc-400 bg-white/[0.04] hover:border-white/20"
                            }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters
                    </button>
                </motion.div>

                {/* Status filter pills */}
                {showFilters && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-2 mb-6">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${statusFilter === f.value
                                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                                        : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </motion.div>
                )}

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-24 text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Loading vaults from chain…
                    </div>
                ) : isError ? (
                    <div className="text-center py-24">
                        <p className="text-red-400 text-sm mb-2">Failed to load vaults. Check your wallet connection and network.</p>
                        <button onClick={() => refetch()} className="text-zinc-500 text-xs hover:text-zinc-300 underline">
                            Retry
                        </button>
                    </div>
                ) : addresses.length === 0 ? (
                    <div className="text-center py-24 text-zinc-600">
                        <p className="text-lg">No vaults deployed yet</p>
                        <p className="text-sm mt-1">
                            Be the first to{" "}
                            <Link href="/auctions/create" className="text-cyan-400 hover:underline">
                                create an auction
                            </Link>
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {addresses
                            .filter(addr => !search || addr.toLowerCase().includes(search.toLowerCase()))
                            .map((addr, i) => (
                                <VaultCard key={addr} address={addr} index={i} statusFilter={statusFilter} />
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}
