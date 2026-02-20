"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Copy,
    Eye,
    Loader2,
    Lock,
    Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { encodeAbiParameters, keccak256, parseAbiParameters, parseEther, toHex } from "viem";
import {
    useAccount,
    useReadContract,
    useWaitForTransactionReceipt,
    useWriteContract,
} from "wagmi";
import { VAULT_ABI } from "~~/lib/contracts";
import { VaultPhase } from "~~/lib/types";
import { formatTimeLeft, formatWei } from "~~/lib/utils";

interface BidPanelProps {
    vaultAddress: `0x${string}`;
    phase: VaultPhase;
    closeTime: bigint;
    revealDeadline: bigint;
    depositRequired: bigint;
    bidCount: bigint;
    eciesKey: string;
}

function randomBytes32(): `0x${string}` {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return toHex(arr) as `0x${string}`;
}

export function BidPanel({
    vaultAddress,
    phase,
    closeTime,
    revealDeadline,
    depositRequired,
    bidCount,
    eciesKey,
}: BidPanelProps) {
    const { address: userAddress, isConnected } = useAccount();

    // Commit state
    const [priceEth, setPriceEth] = useState("");
    const [storageRoot, setStorageRoot] = useState("");
    const [salt, setSalt] = useState<`0x${string}`>(() => randomBytes32());
    const [commitHash, setCommitHash] = useState<`0x${string}` | null>(null);

    // Reveal state
    const [revealPrice, setRevealPrice] = useState("");
    const [revealSalt, setRevealSalt] = useState<`0x${string}` | "">("");

    // Timing
    const nowSec = Math.floor(Date.now() / 1000);
    const secsToClose = Math.max(0, Number(closeTime) - nowSec);
    const secsToRevealEnd = Math.max(0, Number(revealDeadline) - nowSec);

    // Read user's bid
    const { data: userBid } = useReadContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "bids",
        args: [userAddress ?? "0x0000000000000000000000000000000000000000"],
        query: { enabled: !!userAddress },
    });

    const userHasCommitted =
        userBid && userBid[0] !== "0x0000000000000000000000000000000000000000000000000000000000000000";
    const userHasRevealed = userBid && userBid[3] === true;

    // Commit tx
    const { writeContractAsync: doCommit, isPending: isCommitPending } = useWriteContract();
    const [commitTxHash, setCommitTxHash] = useState<`0x${string}` | undefined>();
    const { isSuccess: isCommitSuccess } = useWaitForTransactionReceipt({ hash: commitTxHash });

    // Reveal tx
    const { writeContractAsync: doReveal, isPending: isRevealPending } = useWriteContract();
    const [revealTxHash, setRevealTxHash] = useState<`0x${string}` | undefined>();
    const { isSuccess: isRevealSuccess } = useWaitForTransactionReceipt({ hash: revealTxHash });

    function computeCommitHash(price: bigint, s: `0x${string}`, sender: `0x${string}`): `0x${string}` {
        return keccak256(
            encodeAbiParameters(parseAbiParameters("uint256 price, bytes32 salt, address sender"), [price, s, sender]),
        );
    }

    async function handleCommit() {
        if (!isConnected || !userAddress) {
            toast.error("Connect your wallet first");
            return;
        }
        const priceWei = parseEther(priceEth || "0");
        if (priceWei <= 0n) {
            toast.error("Enter a valid price");
            return;
        }
        if (!storageRoot) {
            toast.error("Enter the 0G Storage root hash");
            return;
        }

        const hash = computeCommitHash(priceWei, salt, userAddress);
        setCommitHash(hash);

        try {
            const txHash = await doCommit({
                address: vaultAddress,
                abi: VAULT_ABI,
                functionName: "commitBid",
                args: [hash, storageRoot],
                value: depositRequired,
            });
            setCommitTxHash(txHash);
            toast.success("Bid committed! Save your price & salt to reveal later.", { icon: "🔒", duration: 8000 });
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Commit failed");
        }
    }

    async function handleReveal() {
        if (!isConnected || !userAddress) {
            toast.error("Connect your wallet first");
            return;
        }
        const priceWei = parseEther(revealPrice || "0");
        if (priceWei <= 0n) {
            toast.error("Enter the price you committed");
            return;
        }
        if (!revealSalt || revealSalt.length !== 66 || !revealSalt.startsWith("0x")) {
            toast.error("Enter the 32-byte salt (0x…64 hex chars)");
            return;
        }
        try {
            const txHash = await doReveal({
                address: vaultAddress,
                abi: VAULT_ABI,
                functionName: "revealBid",
                args: [priceWei, revealSalt as `0x${string}`],
            });
            setRevealTxHash(txHash);
            toast.success("Bid revealed!", { icon: "👁️" });
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Reveal failed");
        }
    }

    const isOpen = phase === VaultPhase.OPEN && secsToClose > 0;
    const isReveal = phase === VaultPhase.REVEAL && secsToRevealEnd > 0;

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-white text-sm font-semibold">
                        {isOpen ? "Submit Bid" : isReveal ? "Reveal Bid" : "Bidding Closed"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Clock className="w-3 h-3" />
                    {isOpen ? formatTimeLeft(secsToClose) : isReveal ? `Reveal: ${formatTimeLeft(secsToRevealEnd)}` : "—"}
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Stats */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Required Deposit</p>
                            <p className="text-white font-mono font-bold text-xl">{formatWei(depositRequired)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Bids</p>
                            <p className="text-zinc-200 font-mono font-semibold text-xl">{Number(bidCount)}</p>
                        </div>
                    </div>
                </div>

                {/* COMMIT PHASE */}
                {isOpen && !userHasCommitted && !isCommitSuccess && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Your Bid Price (ETH)</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={priceEth}
                                onChange={e => setPriceEth(e.target.value)}
                                placeholder="e.g. 0.5"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-zinc-300 text-sm font-medium block mb-1.5">0G Storage Root Hash</label>
                            <input
                                type="text"
                                value={storageRoot}
                                onChange={e => setStorageRoot(e.target.value)}
                                placeholder="Merkle root of your encrypted offer on 0G"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                        </div>

                        {/* Salt */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-zinc-300 text-sm font-medium">Salt (auto-generated)</label>
                                <button
                                    onClick={() => setSalt(randomBytes32())}
                                    className="text-zinc-500 text-[11px] hover:text-zinc-300 transition-colors"
                                >
                                    Regenerate
                                </button>
                            </div>
                            <div
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer group"
                                onClick={() => {
                                    navigator.clipboard.writeText(salt);
                                    toast.success("Salt copied — save it for reveal!");
                                }}
                            >
                                <p className="text-zinc-500 font-mono text-[10px] flex-1 truncate">{salt}</p>
                                <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 flex-shrink-0" />
                            </div>
                            <p className="text-yellow-400/80 text-[11px] mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Copy & save this salt — you need it to reveal!
                            </p>
                        </div>

                        <button
                            onClick={handleCommit}
                            disabled={isCommitPending || !isConnected}
                            className="w-full py-3.5 rounded-xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2"
                        >
                            {isCommitPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Committing bid…
                                </>
                            ) : (
                                <>
                                    <Lock className="w-4 h-4" />
                                    Commit Sealed Bid · Send {formatWei(depositRequired)}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* COMMITTED CONFIRMATION */}
                {(isCommitSuccess || (isOpen && userHasCommitted)) && !isReveal && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <p className="text-emerald-400 font-semibold text-sm">Bid Committed!</p>
                        <p className="text-zinc-500 text-xs mt-1">Deposit locked. Reveal your price after the auction closes.</p>
                    </motion.div>
                )}

                {/* REVEAL PHASE */}
                {isReveal && userHasCommitted && !userHasRevealed && !isRevealSuccess && (
                    <div className="space-y-3">
                        <div className="bg-cyan-500/[0.06] border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-300">
                            <div className="flex items-start gap-2">
                                <Eye className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                Reveal phase is open. Enter the exact price and salt you used to commit.
                            </div>
                        </div>

                        <div>
                            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Your Committed Price (ETH)</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={revealPrice}
                                onChange={e => setRevealPrice(e.target.value)}
                                placeholder="e.g. 0.5"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-zinc-300 text-sm font-medium block mb-1.5">Salt (bytes32)</label>
                            <input
                                type="text"
                                value={revealSalt}
                                onChange={e => setRevealSalt(e.target.value as `0x${string}`)}
                                placeholder="0x…"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                        </div>

                        <button
                            onClick={handleReveal}
                            disabled={isRevealPending || !isConnected}
                            className="w-full py-3.5 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                        >
                            {isRevealPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Revealing bid…
                                </>
                            ) : (
                                <>
                                    <Eye className="w-4 h-4" />
                                    Reveal Bid
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* REVEALED */}
                {(isRevealSuccess || (isReveal && userHasRevealed)) && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <p className="text-emerald-400 font-semibold text-sm">Bid Revealed!</p>
                        <p className="text-zinc-500 text-xs mt-1">Waiting for buyer to settle the auction.</p>
                    </motion.div>
                )}

                {/* NOT CONNECTED */}
                {!isConnected && (isOpen || isReveal) && (
                    <p className="text-center text-zinc-500 text-sm py-2">Connect your wallet to participate</p>
                )}

                {/* CLOSED / SETTLED */}
                {!isOpen && !isReveal && (
                    <div className="text-center py-4 text-zinc-500 text-sm">
                        {phase === VaultPhase.SETTLED
                            ? "Auction settled — winner selected"
                            : phase === VaultPhase.CANCELLED
                                ? "Auction cancelled — deposits refunded"
                                : phase === VaultPhase.REVEAL
                                    ? "Reveal window closed — awaiting settlement"
                                    : "Auction has closed"}
                    </div>
                )}

                {/* ECIES hint */}
                {isOpen && eciesKey && (
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-[11px] text-zinc-500">
                        Encrypt your offer documents with the buyer&apos;s ECIES key before uploading to 0G Storage.
                    </div>
                )}
            </div>
        </div>
    );
}
