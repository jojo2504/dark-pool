"use client";

import { use, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BidPanel } from "~~/components/darkpool/BidPanel";
import { VAULT_ABI } from "~~/lib/contracts";
import { PHASE_LABEL, VaultPhase, phaseToStatus } from "~~/lib/types";
import { formatAddress, formatTimestamp, formatWei } from "~~/lib/utils";

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

  const { writeContractAsync: triggerReveal, isPending: isTriggerPending } = useWriteContract();
  const [triggerHash, setTriggerHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isTriggerSuccess } = useWaitForTransactionReceipt({ hash: triggerHash });

  const { writeContractAsync: settle, isPending: isSettlePending } = useWriteContract();
  const [settleHash, setSettleHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isSettleSuccess } = useWaitForTransactionReceipt({ hash: settleHash });

  const { writeContractAsync: cancel, isPending: isCancelPending } = useWriteContract();
  const [cancelHash, setCancelHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });

  if (isTriggerSuccess || isSettleSuccess || isCancelSuccess) refetch();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-xs uppercase opacity-30">
        LOADING...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="border border-white p-8 text-center">
          <p className="font-mono text-xs uppercase opacity-50 mb-2">FAILED TO LOAD VAULT</p>
          <Link href="/auctions" className="font-mono text-[10px] uppercase opacity-30 hover:opacity-100">
            [BACK]
          </Link>
        </div>
      </div>
    );
  }

  const title = (data[0].result ?? "UNNAMED") as string;
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
  const isBuyer = userAddress?.toLowerCase() === buyer.toLowerCase();
  const nowSec = Math.floor(Date.now() / 1000);
  const secsToClose = Math.max(0, Number(closeTime) - nowSec);
  const canTriggerReveal = status === "open" && secsToClose === 0;
  const canSettle = phase === VaultPhase.REVEAL && nowSec > Number(revealDeadline) && isBuyer;
  const canCancel = phase === VaultPhase.OPEN && isBuyer;

  async function handleTriggerReveal() {
    try {
      const h = await triggerReveal({ address: vaultAddress, abi: VAULT_ABI, functionName: "triggerRevealPhase" });
      setTriggerHash(h);
      toast.success("Reveal triggered");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleSettle() {
    try {
      const h = await settle({ address: vaultAddress, abi: VAULT_ABI, functionName: "settle" });
      setSettleHash(h);
      toast.success("Settlement submitted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleCancel() {
    try {
      const h = await cancel({ address: vaultAddress, abi: VAULT_ABI, functionName: "cancel" });
      setCancelHash(h);
      toast.success("Cancellation submitted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const rows = [
    { label: "CONTRACT", value: vaultAddress },
    { label: "BUYER", value: formatAddress(buyer) },
    { label: "PHASE", value: PHASE_LABEL[phase] },
    { label: "DEPOSIT", value: formatWei(depositRequired) },
    { label: "CLOSE", value: formatTimestamp(closeTime) },
    { label: "REVEAL DEADLINE", value: formatTimestamp(revealDeadline) },
    { label: "BID COUNT", value: String(Number(bidCount)) },
    ...(phase === VaultPhase.SETTLED
      ? [
          { label: "WINNER", value: formatAddress(winner) },
          { label: "WINNING PRICE", value: formatWei(winningPrice) },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-black pt-14">
      {/* Top bar */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href="/auctions"
            className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-30 hover:opacity-100 transition-opacity"
          >
            ← ALL AUCTIONS
          </Link>
        </div>
      </div>

      {/* Title bar */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase border border-white px-2 py-1">
                {PHASE_LABEL[phase]}
              </span>
            </div>
            <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-[-0.03em] uppercase text-white">
              {title}
            </h1>
          </div>
          <div className="flex gap-0">
            <button
              onClick={() => refetch()}
              className="border border-white px-4 py-2 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all"
            >
              REFRESH
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="border border-white border-l-0 px-4 py-2 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all"
            >
              SHARE
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: "DEPOSIT", value: formatWei(depositRequired) },
            { label: "CLOSE", value: formatTimestamp(closeTime) },
            { label: "BIDS", value: String(Number(bidCount)) },
            { label: "REVEAL", value: formatTimestamp(revealDeadline) },
          ].map((s, i) => (
            <div key={s.label} className={`px-6 py-6 ${i < 3 ? "border-r border-white" : ""}`}>
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-30 mb-1">{s.label}</p>
              <p className="font-mono text-xs font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left */}
        <div className="lg:col-span-3 space-y-0">
          {/* Description */}
          <div className="border border-white p-6">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-4">ABOUT</p>
            <p className="font-mono text-xs leading-relaxed opacity-70">{description || "NO DESCRIPTION PROVIDED."}</p>
          </div>

          {/* Details table */}
          <div className="border border-white border-t-0">
            <p className="px-6 pt-6 font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-4">VAULT DETAILS</p>
            <div className="divide-y divide-white/10">
              {rows.map(r => (
                <div key={r.label} className="flex justify-between px-6 py-3 font-mono text-xs">
                  <span className="opacity-40">{r.label}</span>
                  <span className="font-bold truncate ml-4 max-w-[60%] text-right">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ECIES key */}
          {eciesKey && (
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-3">ECIES PUBLIC KEY</p>
              <p className="font-mono text-[10px] opacity-40 break-all">{eciesKey}</p>
            </div>
          )}

          {/* Buyer actions */}
          {isBuyer && (canTriggerReveal || canSettle || canCancel) && (
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-30 mb-4">BUYER ACTIONS</p>
              <div className="flex gap-0">
                {canTriggerReveal && (
                  <button
                    onClick={handleTriggerReveal}
                    disabled={isTriggerPending}
                    className="border border-white px-4 py-2.5 font-mono text-[10px] uppercase bg-white text-black hover:opacity-80 transition-all disabled:opacity-20"
                  >
                    {isTriggerPending ? "..." : "TRIGGER REVEAL"}
                  </button>
                )}
                {canSettle && (
                  <button
                    onClick={handleSettle}
                    disabled={isSettlePending}
                    className="border border-white border-l-0 px-4 py-2.5 font-mono text-[10px] uppercase bg-white text-black hover:opacity-80 transition-all disabled:opacity-20"
                  >
                    {isSettlePending ? "..." : "SETTLE"}
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={isCancelPending}
                    className="border border-white border-l-0 px-4 py-2.5 font-mono text-[10px] uppercase hover:opacity-60 transition-all disabled:opacity-20"
                  >
                    {isCancelPending ? "..." : "CANCEL"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Bid panel */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-16 space-y-0">
            <BidPanel
              vaultAddress={vaultAddress}
              phase={phase}
              closeTime={closeTime}
              revealDeadline={revealDeadline}
              depositRequired={depositRequired}
              bidCount={bidCount}
              eciesKey={eciesKey}
            />
            <div className="border border-white border-t-0 p-4">
              <p className="font-mono text-[10px] uppercase opacity-30 leading-relaxed">
                SEALED-BID GUARANTEE: YOUR BID IS COMMITTED AS A HASH. PRICE HIDDEN UNTIL REVEAL. NON-REVEALERS LOSE
                DEPOSIT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
