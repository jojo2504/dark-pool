"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { z } from "zod";
import { FACTORY_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS } from "~~/lib/darkpool-config";

const schema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(10).max(500),
  durationHours: z.coerce.number().min(1).max(8760),
  revealWindowHours: z.coerce.number().min(1).max(720),
  depositEth: z.string().min(1),
  allowedSuppliersRaw: z.string().min(1),
  auditor: z.string().optional(),
  buyerECIESPubKey: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-4 py-3 bg-black border border-white font-mono text-xs text-white placeholder:text-white/20 focus:outline-none focus:bg-white focus:text-black transition-all duration-100";
const labelClass = "font-mono text-[10px] tracking-[0.15em] uppercase opacity-50 block mb-2";

export default function CreateAuctionPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  const { writeContractAsync, isPending: isTxPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { durationHours: 24, revealWindowHours: 4, depositEth: "0.01", auditor: "" },
  });

  const onSubmit = (data: FormData) => {
    if (!isConnected) {
      toast.error("Connect wallet");
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
      toast.success("Transaction submitted...");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (isTxSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="border border-white p-12 text-center max-w-sm">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] mb-2">VAULT DEPLOYED</p>
          <p className="font-mono text-[10px] uppercase opacity-40 mb-6">CONTRACT LIVE ON-CHAIN</p>
          {txHash && <p className="font-mono text-[10px] opacity-20 mb-6">{txHash.slice(0, 24)}...</p>}
          <button
            onClick={() => router.push("/auctions")}
            className="border border-white bg-white text-black px-6 py-3 font-mono text-[10px] tracking-[0.15em] uppercase font-bold hover:opacity-80 transition-all duration-100"
          >
            VIEW AUCTIONS
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Confirm modal */}
      <AnimatePresence>
        {showModal && pendingData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border border-white bg-black p-8 max-w-md w-full mx-4"
            >
              <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] mb-4">DEPLOY VAULT</p>
              <p className="font-mono text-[10px] uppercase opacity-40 mb-6">PARAMETERS ARE IMMUTABLE AFTER CREATION</p>

              <div className="border border-white divide-y divide-white font-mono text-xs mb-6">
                <div className="flex justify-between p-3">
                  <span className="opacity-40">TITLE</span>
                  <span className="truncate ml-4 max-w-[180px]">{pendingData.title}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-40">DURATION</span>
                  <span>
                    {pendingData.durationHours}H + {pendingData.revealWindowHours}H REVEAL
                  </span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-40">DEPOSIT</span>
                  <span>{pendingData.depositEth} ETH</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-40">SUPPLIERS</span>
                  <span>{pendingData.allowedSuppliersRaw.split(",").filter(Boolean).length}</span>
                </div>
              </div>

              <div className="flex gap-0">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isTxPending}
                  className="flex-1 py-3 border border-white font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isTxPending}
                  className="flex-1 py-3 border border-white border-l-0 bg-white text-black font-mono text-[10px] tracking-[0.1em] uppercase font-bold hover:opacity-80 transition-all disabled:opacity-20"
                >
                  {isTxPending ? "DEPLOYING..." : "DEPLOY"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-black pt-14">
        {/* Header */}
        <div className="border-b border-white">
          <div className="max-w-3xl mx-auto px-6 py-8">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-40 mb-3">[ DEPLOY ]</p>
            <h1 className="font-mono text-3xl font-bold tracking-[-0.03em] uppercase text-white mb-2">CREATE VAULT</h1>
            <p className="font-mono text-xs opacity-40">IMMUTABLE PARAMETERS — CONFIRM BEFORE DEPLOYMENT</p>
            {!isConnected && (
              <p className="font-mono text-[10px] uppercase opacity-50 mt-3 border border-white inline-block px-3 py-1.5">
                ⚠ CONNECT WALLET TO DEPLOY
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
            {/* Auction Info */}
            <div className="border border-white p-6 mb-0">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-6">AUCTION INFO</p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>TITLE</label>
                  <input {...register("title")} placeholder="ENTERPRISE CLOUD Q3" className={inputClass} />
                  {errors.title && (
                    <p className="font-mono text-[10px] uppercase opacity-60 mt-1">{errors.title.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>DESCRIPTION</label>
                  <textarea
                    {...register("description")}
                    rows={3}
                    placeholder="DESCRIBE REQUIREMENTS..."
                    className={inputClass + " resize-none"}
                  />
                  {errors.description && (
                    <p className="font-mono text-[10px] uppercase opacity-60 mt-1">{errors.description.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Timing */}
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-6">TIMING</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>COMMIT DURATION (H)</label>
                  <input {...register("durationHours")} type="number" min={1} placeholder="24" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>REVEAL WINDOW (H)</label>
                  <input
                    {...register("revealWindowHours")}
                    type="number"
                    min={1}
                    placeholder="4"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Deposit */}
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-6">DEPOSIT</p>
              <div>
                <label className={labelClass}>REQUIRED DEPOSIT (ETH)</label>
                <input
                  {...register("depositEth")}
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.01"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Access */}
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-6">ACCESS CONTROL</p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>ALLOWED SUPPLIERS (COMMA-SEP)</label>
                  <textarea
                    {...register("allowedSuppliersRaw")}
                    rows={2}
                    placeholder="0xABC..., 0xDEF..."
                    className={inputClass + " resize-none"}
                  />
                </div>
                <div>
                  <label className={labelClass}>AUDITOR ADDRESS (OPTIONAL)</label>
                  <input {...register("auditor")} placeholder="0x0000...0000" className={inputClass} />
                </div>
              </div>
            </div>

            {/* ECIES */}
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-6">ENCRYPTION</p>
              <div>
                <label className={labelClass}>BUYER ECIES PUBLIC KEY</label>
                <input {...register("buyerECIESPubKey")} placeholder="04A1B2C3..." className={inputClass} />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isConnected}
              className="w-full py-5 border border-white border-t-0 bg-white text-black font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 disabled:opacity-20 transition-all duration-100"
            >
              REVIEW & DEPLOY VAULT →
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
