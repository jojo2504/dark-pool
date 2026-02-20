"use client";
import { use, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Loader2,
    RefreshCw,
    Share2,
    Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BidPanel } from "~~/components/darkpool/BidPanel";
import { VAULT_ABI } from "~~/lib/contracts";
import { PHASE_LABEL, VaultPhase, phaseToStatus } from "~~/lib/types";
import { formatAddress, formatTimestamp, formatWei } from "~~/lib/utils";

const PHASE_COLOR: Record<string, string> = {
    open: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    reveal: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    settled: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const vaultAddress = id as `0x${string}`;
    const { address: userAddress } = useAccount();

    const contract = { address: vaultAddress, abi: VAULT_ABI } as const;

    const { data, isLoading, isError, refetch } = useReadContracts({
        contracts: [
            { ...contract, functionName: "title" },
            { ...contract, functionName: "description" },
            { ...contract, functionName: "buyer" },
            { ...contract, functionName: "closeTime" },
            { ...contract, functionName: "revealDeadline" },
            { ...contract, functionName: "depositRequired" },
            { ...contract, functionName: "getCurrentPhase" },
            { ...contract, functionName: "getBidCount" },
            { ...contract, functionName: "winner" },
            { ...contract, functionName: "winningPrice" },
            { ...contract, functionName: "buyerECIESPubKey" },
        ],
    });

    // trigger reveal phase
    const { writeContractAsync: triggerReveal, isPending: isTriggerPending } = useWriteContract();
    const [triggerHash, setTriggerHash] = useState<`0x${string}` | undefined>();
    const { isSuccess: isTriggerSuccess } = useWaitForTransactionReceipt({ hash: triggerHash });

    // settle
    const { writeContractAsync: settle, isPending: isSettlePending } = useWriteContract();
    const [settleHash, setSettleHash] = useState<`0x${string}` | undefined>();
    const { isSuccess: isSettleSuccess } = useWaitForTransactionReceipt({ hash: settleHash });

    // cancel
    const { writeContractAsync: cancel, isPending: isCancelPending } = useWriteContract();
    const [cancelHash, setCancelHash] = useState<`0x${string}` | undefined>();
    const { isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });

    if (isTriggerSuccess || isSettleSuccess || isCancelSuccess) {
        refetch();
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading vault…
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 text-sm">Failed to load vault {vaultAddress}</p>
                    <Link href="/auctions" className="text-zinc-500 text-xs hover:underline mt-2 block">
                        Back to auctions
                    </Link>
                </div>
            </div>
        );
    }

    const title = (data[0].result ?? "Unnamed Vault") as string;
    const description = (data[1].result ?? "") as string;
    const buyer = (data[2].result ?? "0x0") as `0x${string}`;
    const closeTime = (data[3].result ?? 0n) as bigint;
    const revealDeadline = (data[4].result ?? 0n) as bigint;
    const depositRequired = (data[5].result ?? 0n) as bigint;
    const phaseRaw = (data[6].result ?? 0) as number;
    const bidCount = (data[7].result ?? 0n) as bigint;
    const winner = (data[8].result ?? "0x0") as `0x${string}`;
    const winningPrice = (data[9].result ?? 0n) as bigint;
    const eciesKey = (data[10].result ?? "") as string;

    const phase = phaseRaw as VaultPhase;
    const status = phaseToStatus(phase, closeTime);
    const statusColor = PHASE_COLOR[status];
    const isBuyer = userAddress?.toLowerCase() === buyer.toLowerCase();
    const nowSec = Math.floor(Date.now() / 1000);
    const secsToClose = Math.max(0, Number(closeTime) - nowSec);
    const canTriggerReveal = status === "open" && secsToClose === 0;
    const canSettle = phase === VaultPhase.REVEAL && nowSec > Number(revealDeadline) && isBuyer;
    const canCancel = phase === VaultPhase.OPEN && isBuyer;

    async function handleTriggerReveal() {
        try {
            const hash = await triggerReveal({
                address: vaultAddress,
                abi: VAULT_ABI,
                functionName: "triggerRevealPhase",
            });
            setTriggerHash(hash);
            toast.success("Reveal phase triggered!");
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed");
        }
    }

    async function handleSettle() {
        try {
            const hash = await settle({ address: vaultAddress, abi: VAULT_ABI, functionName: "settle" });
            setSettleHash(hash);
            toast.success("Settlement submitted!");
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed");
        }
    }

    async function handleCancel() {
        try {
            const hash = await cancel({ address: vaultAddress, abi: VAULT_ABI, functionName: "cancel" });
            setCancelHash(hash);
            toast.success("Cancellation submitted!");
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed");
        }
    }

    return (
        <div className="min-h-screen bg-[#050505] pt-28 pb-24 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Back */}
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
                    <Link
                        href="/auctions"
                        className="inline-flex items-center gap-1.5 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        All Auctions
                    </Link>
                </motion.div>

                {/* Title bar */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8"
                >
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusColor}`}
                            >
                                {status === "open" && (
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                    </span>
                                )}
                                {PHASE_LABEL[phase]}
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
                        <p className="text-zinc-500 text-sm mt-1">
                            Buyer: <span className="font-mono text-zinc-400">{formatAddress(buyer)}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                        <button
                            onClick={() => refetch()}
                            className="p-2 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-all"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => navigator.clipboard?.writeText(window.location.href)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-zinc-400 text-sm hover:bg-white/[0.04] transition-all"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            Share
                        </button>
                    </div>
                </motion.div>

                {/* Stats bar */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
                >
                    {[
                        { icon: CheckCircle2, label: "Deposit Required", value: formatWei(depositRequired), highlight: true },
                        { icon: Clock, label: "Close Time", value: formatTimestamp(closeTime) },
                        { icon: Users, label: "Sealed Bids", value: String(Number(bidCount)) },
                        { icon: Clock, label: "Reveal Deadline", value: formatTimestamp(revealDeadline) },
                    ].map((s, i) => (
                        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1">
                                <s.icon className="w-3 h-3" />
                                {s.label}
                            </p>
                            <p className={`font-mono text-sm font-semibold ${s.highlight ? "text-cyan-400" : "text-zinc-200"}`}>
                                {s.value}
                            </p>
                        </div>
                    ))}
                </motion.div>

                {/* Main content */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-3 space-y-4"
                    >
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                            <h2 className="text-white text-sm font-semibold mb-3">About this Auction</h2>
                            <p className="text-zinc-400 text-sm leading-relaxed">{description || "No description provided."}</p>
                        </div>

                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                            <h2 className="text-white text-sm font-semibold mb-4">Vault Details</h2>
                            <div className="space-y-2 text-xs text-zinc-500">
                                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                                    <span>Contract</span>
                                    <span className="font-mono text-zinc-300">{vaultAddress}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                                    <span>Buyer</span>
                                    <span className="font-mono text-zinc-300">{formatAddress(buyer)}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                                    <span>Phase</span>
                                    <span className={`font-medium ${statusColor.split(" ")[0]}`}>{PHASE_LABEL[phase]}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                                    <span>Bid Count</span>
                                    <span className="text-zinc-300">{Number(bidCount)}</span>
                                </div>
                                {phase === VaultPhase.SETTLED && (
                                    <>
                                        <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                                            <span>Winner</span>
                                            <span className="font-mono text-emerald-400">{formatAddress(winner)}</span>
                                        </div>
                                        <div className="flex justify-between py-1.5">
                                            <span>Winning Price</span>
                                            <span className="font-mono text-emerald-400">{formatWei(winningPrice)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {eciesKey && (
                            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                                <h2 className="text-white text-sm font-semibold mb-2">Buyer ECIES Public Key</h2>
                                <p className="text-zinc-500 font-mono text-[11px] break-all">{eciesKey}</p>
                            </div>
                        )}

                        {isBuyer && (canTriggerReveal || canSettle || canCancel) && (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
                                <h2 className="text-amber-400 text-sm font-semibold mb-3">Buyer Actions</h2>
                                <div className="flex flex-wrap gap-2">
                                    {canTriggerReveal && (
                                        <button
                                            onClick={handleTriggerReveal}
                                            disabled={isTriggerPending}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all disabled:opacity-50"
                                        >
                                            {isTriggerPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                            Trigger Reveal Phase
                                        </button>
                                    )}
                                    {canSettle && (
                                        <button
                                            onClick={handleSettle}
                                            disabled={isSettlePending}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50"
                                        >
                                            {isSettlePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                            Settle Auction
                                        </button>
                                    )}
                                    {canCancel && (
                                        <button
                                            onClick={handleCancel}
                                            disabled={isCancelPending}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50"
                                        >
                                            {isCancelPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                            Cancel Auction
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Right: Bid panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="lg:col-span-2"
                    >
                        <div className="lg:sticky lg:top-28 space-y-4">
                            <BidPanel
                                vaultAddress={vaultAddress}
                                phase={phase}
                                closeTime={closeTime}
                                revealDeadline={revealDeadline}
                                depositRequired={depositRequired}
                                bidCount={bidCount}
                                eciesKey={eciesKey}
                            />

                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <p className="text-zinc-500 text-xs leading-relaxed">
                                    <span className="text-zinc-300 font-medium">Sealed-bid guarantee:</span> Your bid is committed as a
                                    hash. The price stays hidden until reveal phase. Non-revealers lose their deposit to the buyer.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
