"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { keccak256, parseEther, toBytes, zeroAddress } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { z } from "zod";
import { RFPGeneratorWidget } from "~~/components/ai/RFPGeneratorWidget";
import { FACTORY_ABI } from "~~/lib/contracts";
import { DDSC_ADDRESS, FACTORY_ADDRESS } from "~~/lib/darkpool-config";

const schema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(10).max(500),
  durationHours: z.coerce.number().min(1).max(8760),
  revealWindowHours: z.coerce.number().min(1).max(720),
  depositEth: z.string().min(1),
  allowedSuppliersRaw: z
    .string()
    .min(1)
    .refine(
      val =>
        val
          .split(",")
          .map(s => s.trim())
          .some(s => /^0x[0-9a-fA-F]{40}$/.test(s)),
      { message: "Enter at least one valid Ethereum address (0x followed by 40 hex chars)" },
    ),
  buyerECIESPubKey: z.string().min(1),
  // Compliance
  oracleAddress: z.string().optional(),
  assetDocumentUrl: z.string().optional(),
  declaredAssetValueEth: z.string().optional(),
  settlementWindowHours: z.coerce.number().min(1).default(48),
  oracleTimeoutDays: z.coerce.number().min(1).default(30),
  requiresAccreditation: z.boolean().default(false),
  allowedJurisdictionsRaw: z.string().optional(),
  reviewWindowHours: z.coerce.number().min(0).default(0),
});
type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-4 py-3 bg-black/80 border border-white/30 font-mono text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-white focus:bg-black transition-all duration-100";
const labelClass = "font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2";
const req = <span className="text-red-500 ml-0.5">*</span>;

// keccak256("BUYER_ROLE") — must match ShadowBidFactory's BUYER_ROLE constant
const BUYER_ROLE_HASH = "0xf8cd32ed93fc2f9fc78152a14807c9609af3d99c5fe4dc6b106a801aaddfe90e" as `0x${string}`;

function computeBond(declaredEth: string): bigint {
  try {
    if (!declaredEth || parseFloat(declaredEth) === 0) return 0n;
    const value = parseEther(declaredEth);
    const bond = (value * 5n) / 1000n;
    const minBond = parseEther("0.01");
    return bond < minBond ? minBond : bond;
  } catch {
    return parseEther("0.01");
  }
}

export default function CreateAuctionPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [section, setSection] = useState<"basic" | "compliance" | "settlement">("basic");

  const { writeContractAsync, isPending: isTxPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Gate: createVault requires BUYER_ROLE — granted automatically on KYB approval.
  // Without it, the tx reverts with "AccessControl: missing role" which ZKSync surfaces
  // to MetaMask as a misleading "insufficient funds" error.
  const { data: hasBuyerRole } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "hasRole",
    args: [BUYER_ROLE_HASH, address ?? zeroAddress],
    query: { enabled: !!address },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      durationHours: 24,
      revealWindowHours: 4,
      depositEth: "0.01",
      settlementWindowHours: 48,
      oracleTimeoutDays: 30,
      reviewWindowHours: 0,
      requiresAccreditation: false,
    },
  });

  const watchedDeclaredValue = watch("declaredAssetValueEth") ?? "";
  const bondAmount = computeBond(watchedDeclaredValue);

  const onSubmit = (data: FormData) => {
    if (!isConnected) {
      toast.error("Connect wallet");
      return;
    }
    if (hasBuyerRole === false) {
      toast.error("KYB verification required — complete KYB at /kyb to unlock vault creation");
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

      const oracle = (
        pendingData.oracleAddress?.startsWith("0x") ? pendingData.oracleAddress : zeroAddress
      ) as `0x${string}`;

      // Hash the document URL/content as the asset proof hash
      const assetProofHash = pendingData.assetDocumentUrl
        ? keccak256(toBytes(pendingData.assetDocumentUrl))
        : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);

      const declaredAssetValue = pendingData.declaredAssetValueEth ? parseEther(pendingData.declaredAssetValueEth) : 0n;

      const settlementWindow = BigInt(pendingData.settlementWindowHours * 3600);
      const oracleTimeout = BigInt(pendingData.oracleTimeoutDays * 24 * 3600);
      const reviewWindow = BigInt(pendingData.reviewWindowHours * 3600);

      const jurisdictions = (pendingData.allowedJurisdictionsRaw ?? "")
        .split(",")
        .map(j => j.trim())
        .filter(Boolean);

      const creatorBond = computeBond(pendingData.declaredAssetValueEth ?? "");

      const settlementTokenAddress = DDSC_ADDRESS;

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
          pendingData.buyerECIESPubKey,
          oracle,
          assetProofHash,
          settlementWindow,
          oracleTimeout,
          pendingData.requiresAccreditation,
          jurisdictions,
          settlementTokenAddress,
          declaredAssetValue,
          reviewWindow,
        ],
        value: creatorBond,
      });
      setTxHash(hash);
      setShowModal(false);
      toast.success("Vault deployment submitted...");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (isTxSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="border border-white p-12 text-center max-w-sm">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] mb-2">VAULT DEPLOYED</p>
          <p className="font-mono text-[10px] uppercase opacity-100 mb-6">CONTRACT LIVE ON-CHAIN</p>
          {txHash && <p className="font-mono text-[10px] opacity-100 mb-6">{txHash.slice(0, 24)}...</p>}
          <button
            onClick={() => router.push("/auctions/my-auctions")}
            className="border border-white bg-white text-black px-6 py-3 font-mono text-[10px] tracking-[0.15em] uppercase font-bold hover:opacity-80 transition-all duration-100"
          >
            VIEW MY AUCTIONS
          </button>
        </div>
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 font-mono text-[10px] tracking-[0.15em] uppercase transition-all cursor-pointer ${
      active ? "bg-white text-black" : "text-white hover:text-white"
    }`;

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
              <p className="font-mono text-[10px] uppercase opacity-100 mb-6">
                PARAMETERS ARE IMMUTABLE AFTER CREATION
              </p>

              <div className="border border-white divide-y divide-white font-mono text-xs mb-6">
                <div className="flex justify-between p-3">
                  <span className="opacity-100">TITLE</span>
                  <span className="truncate ml-4 max-w-[180px]">{pendingData.title}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-100">DURATION</span>
                  <span>
                    {pendingData.durationHours}H + {pendingData.revealWindowHours}H REVEAL
                  </span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-40">DEPOSIT</span>
                  <span>{pendingData.depositEth} ADI</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-100">SUPPLIERS</span>
                  <span>
                    {pendingData.allowedSuppliersRaw.split(",").filter(s => s.trim().startsWith("0x")).length}
                  </span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-40">ASSET VALUE</span>
                  <span>{pendingData.declaredAssetValueEth || "0"} ADI</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-100">CREATOR BOND</span>
                  <span className="text-yellow-400">
                    {bondAmount === 0n ? "0 ADI (no bond)" : `${Number(bondAmount) / 1e18} ADI`}
                  </span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-100">ACCREDITATION</span>
                  <span>{pendingData.requiresAccreditation ? "REQUIRED" : "NOT REQUIRED"}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="opacity-40">SETTLEMENT</span>
                  <span>DDSC (AED STABLECOIN)</span>
                </div>
              </div>

              {bondAmount > 0n && (
                <div className="border border-yellow-400/30 bg-yellow-400/5 p-3 mb-4">
                  <p className="font-mono text-[10px] uppercase text-yellow-400 opacity-80">
                    ⚡ {Number(bondAmount) / 1e18} ADI CREATOR BOND WILL BE LOCKED IN ESCROW
                  </p>
                  <p className="font-mono text-[10px] uppercase text-white mt-1">
                    RELEASED 72H AFTER ORACLE CONFIRMS DELIVERY
                  </p>
                </div>
              )}

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
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-3">[ DEPLOY ]</p>
            <h1 className="font-mono text-3xl font-bold tracking-[-0.03em] uppercase text-white mb-2">CREATE VAULT</h1>
            <p className="font-mono text-xs text-white">INSTITUTIONAL RWA SEALED-BID AUCTION — IMMUTABLE PARAMETERS</p>
            {!isConnected && (
              <p className="font-mono text-[10px] uppercase opacity-100 mt-3 border border-white inline-block px-3 py-1.5">
                ⚠ CONNECT WALLET TO DEPLOY
              </p>
            )}
            {isConnected && hasBuyerRole === false && (
              <div className="border border-red-500/40 bg-red-900/10 p-3 mt-3 max-w-lg">
                <p className="font-mono text-[10px] uppercase text-red-400">
                  ⚠ YOUR WALLET IS NOT AUTHORIZED TO CREATE AUCTIONS.{" "}
                  <a href="/kyb" className="underline hover:opacity-80">
                    COMPLETE KYB VERIFICATION TO UNLOCK →
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <div className="max-w-3xl mx-auto px-6 pt-4">
          <div className="flex border border-white">
            <button className={tabClass(section === "basic")} onClick={() => setSection("basic")}>
              AUCTION
            </button>
            <button className={tabClass(section === "compliance")} onClick={() => setSection("compliance")}>
              COMPLIANCE
            </button>
            <button className={tabClass(section === "settlement")} onClick={() => setSection("settlement")}>
              SETTLEMENT
            </button>
          </div>
        </div>

        {/* AI RFP Generator */}
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <RFPGeneratorWidget />
        </div>

        {/* Form */}
        <div className="max-w-3xl mx-auto px-6 py-0 pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
            {/* ── BASIC SECTION ── */}
            <div className={section === "basic" ? "" : "hidden"}>
              {/* Auction Info */}
              <div className="border border-white border-t-0 p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white mb-6">AUCTION INFO</p>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>TITLE {req}</label>
                    <input {...register("title")} placeholder="DUBAI REAL ESTATE Q3 TENDER" className={inputClass} />
                    {errors.title && (
                      <p className="font-mono text-[10px] uppercase text-red-400 mt-1">{errors.title.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>DESCRIPTION {req}</label>
                    <textarea
                      {...register("description")}
                      rows={3}
                      placeholder="DESCRIBE THE ASSET AND REQUIREMENTS..."
                      className={inputClass + " resize-none"}
                    />
                    {errors.description && (
                      <p className="font-mono text-[10px] uppercase text-red-400 mt-1">{errors.description.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Timing */}
              <div className="border border-white border-t-0 p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white mb-6">TIMING</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>COMMIT DURATION (H) {req}</label>
                    <input
                      {...register("durationHours")}
                      type="number"
                      min={1}
                      placeholder="24"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>REVEAL WINDOW (H) {req}</label>
                    <input
                      {...register("revealWindowHours")}
                      type="number"
                      min={1}
                      placeholder="4"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>DOC REVIEW WINDOW (H)</label>
                    <input
                      {...register("reviewWindowHours")}
                      type="number"
                      min={0}
                      placeholder="0"
                      className={inputClass}
                    />
                    <p className="font-mono text-[9px] text-white mt-1">BIDDING STARTS AFTER THIS WINDOW</p>
                  </div>
                  <div>
                    <label className={labelClass}>REQUIRED DEPOSIT (ADI) {req}</label>
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
              </div>

              {/* Access */}
              <div className="border border-white border-t-0 p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white mb-6">ACCESS CONTROL</p>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>WHITELISTED BIDDERS (COMMA-SEPARATED) {req}</label>
                    <textarea
                      {...register("allowedSuppliersRaw")}
                      rows={2}
                      placeholder="0xABC..., 0xDEF..."
                      className={inputClass + " resize-none"}
                    />
                    {errors.allowedSuppliersRaw && (
                      <p className="font-mono text-[10px] uppercase text-red-400 mt-1">
                        {errors.allowedSuppliersRaw.message}
                      </p>
                    )}
                    <p className="font-mono text-[9px] text-white/50 mt-1">MUST ALSO PASS KYB VERIFICATION</p>
                  </div>
                  <div>
                    <label className={labelClass}>BUYER ECIES PUBLIC KEY {req}</label>
                    <input {...register("buyerECIESPubKey")} placeholder="04A1B2C3..." className={inputClass} />
                    {errors.buyerECIESPubKey && (
                      <p className="font-mono text-[10px] uppercase text-red-400 mt-1">
                        {errors.buyerECIESPubKey.message}
                      </p>
                    )}
                    <p className="font-mono text-[9px] text-white/50 mt-1">FOR OFF-CHAIN ENCRYPTED BID STORAGE</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COMPLIANCE SECTION ── */}
            <div className={section === "compliance" ? "" : "hidden"}>
              {/* Asset Proof */}
              <div className="border border-white border-t-0 p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white mb-6">ASSET PROOF</p>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>LEGAL DOCUMENT URL / IPFS HASH</label>
                    <input
                      {...register("assetDocumentUrl")}
                      placeholder="ipfs://Qm... or https://..."
                      className={inputClass}
                    />
                    <p className="font-mono text-[9px] text-white mt-1">HASHED ON-CHAIN AS IMMUTABLE ASSET PROOF</p>
                  </div>
                  <div>
                    <label className={labelClass}>DECLARED ASSET VALUE (ADI)</label>
                    <input
                      {...register("declaredAssetValueEth")}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="100"
                      className={inputClass}
                    />
                    <p className="font-mono text-[9px] text-white mt-1">
                      CREATOR BOND:{" "}
                      {bondAmount === 0n
                        ? "NONE (no value declared)"
                        : `${Number(bondAmount) / 1e18} ADI (0.5% min 0.01 ADI)`}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>ORACLE ADDRESS</label>
                    <input
                      {...register("oracleAddress")}
                      placeholder="0x... (notary / custodian / multisig)"
                      className={inputClass}
                    />
                    <p className="font-mono text-[9px] text-white mt-1">
                      CONFIRMS REAL-WORLD ASSET DELIVERY TO RELEASE PAYMENT
                    </p>
                  </div>
                </div>
              </div>

              {/* Jurisdiction */}
              <div className="border border-white border-t-0 p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white mb-6">
                  JURISDICTION & ACCREDITATION
                </p>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>ALLOWED JURISDICTIONS (COMMA-SEP)</label>
                    <input
                      {...register("allowedJurisdictionsRaw")}
                      placeholder="UAE, KSA, UK, SG"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      id="reqAccred"
                      {...register("requiresAccreditation")}
                      className="w-4 h-4 accent-white"
                    />
                    <label htmlFor="reqAccred" className="font-mono text-[10px] tracking-[0.15em] uppercase">
                      REQUIRE ACCREDITED INVESTOR STATUS
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SETTLEMENT SECTION ── */}
            <div className={section === "settlement" ? "" : "hidden"}>
              <div className="border border-white border-t-0 p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white mb-6">
                  SETTLEMENT PARAMETERS
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>PAYMENT WINDOW (H)</label>
                    <input
                      {...register("settlementWindowHours")}
                      type="number"
                      min={1}
                      placeholder="48"
                      className={inputClass}
                    />
                    <p className="font-mono text-[9px] text-white mt-1">TIME FOR WINNER TO SUBMIT PAYMENT</p>
                  </div>
                  <div>
                    <label className={labelClass}>ORACLE TIMEOUT (DAYS)</label>
                    <input
                      {...register("oracleTimeoutDays")}
                      type="number"
                      min={1}
                      placeholder="30"
                      className={inputClass}
                    />
                    <p className="font-mono text-[9px] text-white mt-1">MAX DAYS FOR ORACLE TO CONFIRM DELIVERY</p>
                  </div>
                </div>

                {/* Settlement Currency — always DDSC */}
                <div className="mt-6">
                  <label className={labelClass}>SETTLEMENT CURRENCY</label>
                  <div className="flex items-center gap-3 px-4 py-3 border border-white bg-white text-black font-mono text-xs">
                    <span className="uppercase tracking-[0.1em] font-bold">DDSC — AED STABLECOIN</span>
                  </div>
                  <p className="font-mono text-[9px] text-white/50 mt-1">
                    UAE CENTRAL BANK-LICENSED AED STABLECOIN ON ADI CHAIN · ELIMINATES PRICE VOLATILITY RISK
                  </p>
                </div>

                <div className="mt-6 p-4 border border-white/20 bg-white/5">
                  <p className="font-mono text-[10px] uppercase text-white mb-3">SETTLEMENT FLOW</p>
                  <div className="space-y-1 font-mono text-[10px] text-white">
                    <p>1. AUCTION SETTLES → WINNER ANNOUNCED</p>
                    <p>2. WINNER HAS [PAYMENT WINDOW] TO SUBMIT FULL PAYMENT</p>
                    <p>3. ORACLE CONFIRMS REAL-WORLD DELIVERY</p>
                    <p>4. PAYMENT RELEASED TO SELLER</p>
                    <p>5. CREATOR BOND RELEASED 72H AFTER DELIVERY</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isConnected}
              className="w-full py-5 border border-white border-t-0 bg-white text-black font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 disabled:opacity-20 transition-all duration-100"
            >
              REVIEW &amp; DEPLOY VAULT →
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
