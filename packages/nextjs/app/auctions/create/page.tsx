"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { FACTORY_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS } from "~~/lib/darkpool-config";

/* ─── Zod schema ─────────────────────────────────────────── */
const schema = z.object({
    title: z.string().min(5, "At least 5 characters").max(80),
    description: z.string().min(10, "At least 10 characters").max(500),
    durationHours: z.coerce.number().min(1, "Min 1h").max(8760, "Max 1 year"),
    revealWindowHours: z.coerce.number().min(1, "Min 1h").max(720),
    depositEth: z.string().min(1, "Required"),
    allowedSuppliersRaw: z.string().min(1, "At least 1 supplier address"),
    auditor: z.string().optional(),
    buyerECIESPubKey: z.string().min(1, "ECIES public key required"),
});
type FormData = z.infer<typeof schema>;

/* ─── Field helpers ──────────────────────────────────────── */
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
    return (
        <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-zinc-300 text-sm font-medium">{children}</label>
            {hint && (
                <span className="group relative">
                    <Info className="w-3 h-3 text-zinc-600 cursor-help" />
                    <span className="absolute left-4 -top-1 hidden group-hover:block z-50 w-52 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 text-[11px] text-zinc-400 shadow-xl">
                        {hint}
                    </span>
                </span>
            )}
        </div>
    );
}

function Input({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
    return (
        <div>
            <input
                {...props}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:bg-white/[0.06] transition-all ${error ? "border-red-500/50 focus:border-red-500" : "border-white/[0.08] focus:border-cyan-500/50"
                    }`}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
    );
}

function Textarea({ error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
    return (
        <div>
            <textarea
                {...props}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:bg-white/[0.06] transition-all resize-none ${error ? "border-red-500/50 focus:border-red-500" : "border-white/[0.08] focus:border-cyan-500/50"
                    }`}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-4">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5 pb-3 border-b border-white/[0.06]">
                {title}
            </h3>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

/* ─── Confirm modal ──────────────────────────────────────── */
function ConfirmModal({
    data,
    onConfirm,
    onCancel,
    isPending,
}: {
    data: FormData;
    onConfirm: () => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#0d0d0d] p-6"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold">Deploy Vault On-Chain</h3>
                        <p className="text-zinc-500 text-xs">This cannot be undone</p>
                    </div>
                </div>

                <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-4 mb-5">
                    <div className="flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300 leading-relaxed">
                            A new <strong>ShadowBidVault</strong> contract will be deployed on-chain. Parameters are{" "}
                            <strong>immutable</strong> after creation.
                        </p>
                    </div>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-4 mb-5 text-xs text-zinc-400 space-y-1.5">
                    <div className="flex justify-between">
                        <span>Title</span>
                        <span className="text-zinc-200 font-medium truncate ml-4 max-w-[200px]">{data.title}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Duration</span>
                        <span className="text-zinc-200">
                            {data.durationHours}h commit + {data.revealWindowHours}h reveal
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Deposit Required</span>
                        <span className="text-zinc-200 font-mono">{data.depositEth} ETH</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Suppliers</span>
                        <span className="text-zinc-200">
                            {data.allowedSuppliersRaw.split(",").filter(Boolean).length} address(es)
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isPending}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition-all disabled:opacity-40"
                    >
                        Go back
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deploying…
                            </>
                        ) : (
                            "Deploy Vault"
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function CreateAuctionPage() {
    const router = useRouter();
    const { isConnected } = useAccount();
    const [showModal, setShowModal] = useState(false);
    const [pendingData, setPendingData] = useState<FormData | null>(null);

    const { writeContractAsync, isPending: isTxPending } = useWriteContract();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

    const { isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            durationHours: 24,
            revealWindowHours: 4,
            depositEth: "0.01",
            auditor: "",
        },
    });

    const onSubmit = (data: FormData) => {
        if (!isConnected) {
            toast.error("Connect your wallet first");
            return;
        }
        setPendingData(data);
        setShowModal(true);
    };

    const handleConfirm = async () => {
        if (!pendingData) return;
        try {
            const now = Math.floor(Date.now() / 1000);
            const closeTime = BigInt(now + pendingData.durationHours * 3600);
            const revealWindow = BigInt(pendingData.revealWindowHours * 3600);
            const depositWei = parseEther(pendingData.depositEth);
            const suppliers = pendingData.allowedSuppliersRaw
                .split(",")
                .map(s => s.trim())
                .filter(s => s.startsWith("0x")) as `0x${string}`[];
            const auditor = (
                pendingData.auditor?.startsWith("0x") ? pendingData.auditor : "0x0000000000000000000000000000000000000000"
            ) as `0x${string}`;

            const hash = await writeContractAsync({
                address: FACTORY_ADDRESS,
                abi: FACTORY_ABI,
                functionName: "createVault",
                args: [
                    pendingData.title,
                    pendingData.description,
                    closeTime,
                    revealWindow,
                    depositWei,
                    suppliers,
                    auditor,
                    pendingData.buyerECIESPubKey,
                ],
            });

            setTxHash(hash);
            setShowModal(false);
            toast.success("Transaction submitted — waiting for confirmation…", {
                icon: "⏳",
                duration: 6000,
            });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Transaction failed");
        }
    };

    if (isTxSuccess) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="text-white text-xl font-semibold mb-2">Vault Deployed!</h2>
                    <p className="text-zinc-500 text-sm mb-4">Your ShadowBidVault is live on-chain.</p>
                    {txHash && <p className="text-zinc-600 font-mono text-xs mb-4">Tx: {txHash.slice(0, 20)}…</p>}
                    <button
                        onClick={() => router.push("/auctions")}
                        className="px-6 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-all"
                    >
                        View All Auctions
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            <AnimatePresence>
                {showModal && pendingData && (
                    <ConfirmModal
                        data={pendingData}
                        onConfirm={handleConfirm}
                        onCancel={() => setShowModal(false)}
                        isPending={isTxPending}
                    />
                )}
            </AnimatePresence>

            <div className="min-h-screen bg-[#050505] pt-28 pb-24 px-4">
                <div className="max-w-2xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium mb-4">
                            <Lock className="w-3 h-3" />
                            Parameters immutable after deployment
                        </div>
                        <h1 className="text-3xl font-bold text-white">Create Vault</h1>
                        <p className="text-zinc-500 text-sm mt-2">
                            Deploys a new <span className="text-cyan-400 font-mono">ShadowBidVault</span> contract on-chain. Commit-reveal
                            sealed bids with ETH deposit.
                        </p>
                        {!isConnected && (
                            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/[0.08] border border-yellow-500/20 rounded-xl px-3 py-2">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                Connect your wallet to deploy
                            </div>
                        )}
                    </motion.div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                            <Section title="📋 Auction Info">
                                <div>
                                    <Label>Title</Label>
                                    <Input {...register("title")} placeholder="e.g. Enterprise Cloud Infrastructure Q3" error={errors.title?.message} />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Textarea
                                        {...register("description")}
                                        rows={3}
                                        placeholder="Describe what is being procured, requirements, scope…"
                                        error={errors.description?.message}
                                    />
                                </div>
                            </Section>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Section title="⏱ Timing">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label hint="How many hours suppliers have to submit sealed bids (commit phase)">Commit Duration (h)</Label>
                                        <Input {...register("durationHours")} type="number" min={1} placeholder="24" error={errors.durationHours?.message} />
                                    </div>
                                    <div>
                                        <Label hint="How many hours after close suppliers have to reveal their bid (min 1h)">Reveal Window (h)</Label>
                                        <Input {...register("revealWindowHours")} type="number" min={1} placeholder="4" error={errors.revealWindowHours?.message} />
                                    </div>
                                </div>
                            </Section>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                            <Section title="💎 Deposit">
                                <div>
                                    <Label hint="Amount in ETH each supplier must send with their commit. Slashed if they don't reveal.">
                                        Required Deposit (ETH)
                                    </Label>
                                    <Input {...register("depositEth")} type="number" step="0.0001" min="0" placeholder="0.01" error={errors.depositEth?.message} />
                                </div>
                            </Section>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                            <Section title="🔐 Access Control">
                                <div>
                                    <Label hint="Comma-separated Ethereum addresses of whitelisted suppliers. Only these can bid.">Allowed Suppliers</Label>
                                    <Textarea
                                        {...register("allowedSuppliersRaw")}
                                        rows={2}
                                        placeholder="0xAbc…123, 0xDef…456"
                                        error={errors.allowedSuppliersRaw?.message}
                                    />
                                </div>
                                <div>
                                    <Label hint="Optional auditor address that can call getAuditData() after settlement.">
                                        Auditor Address <span className="text-zinc-600 font-normal">(optional)</span>
                                    </Label>
                                    <Input {...register("auditor")} placeholder="0x0000…0000" error={errors.auditor?.message} />
                                </div>
                            </Section>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                            <Section title="🔑 ECIES Public Key">
                                <div>
                                    <Label hint="Your ECIES public key hex. Suppliers use this to encrypt their offer documents on 0G Storage.">
                                        Buyer ECIES Public Key
                                    </Label>
                                    <Input {...register("buyerECIESPubKey")} placeholder="04a1b2c3d4e5f6…" error={errors.buyerECIESPubKey?.message} />
                                </div>
                            </Section>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                            <button
                                type="submit"
                                disabled={!isConnected}
                                className="w-full py-4 rounded-2xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Lock className="w-4 h-4" />
                                Review & Deploy Vault
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                            <p className="text-zinc-600 text-xs text-center mt-3">
                                You will confirm in your wallet before anything is sent on-chain.
                            </p>
                        </motion.div>
                    </form>
                </div>
            </div>
        </>
    );
}
