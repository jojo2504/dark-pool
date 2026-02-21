"use client";

import { use, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BidDraftWidget } from "~~/components/ai/BidDraftWidget";
import { BidScoringWidget } from "~~/components/ai/BidScoringWidget";
import { CategoryWidget } from "~~/components/ai/CategoryWidget";
import { LotAnalysisWidget } from "~~/components/ai/LotAnalysisWidget";
import { LowBidDetectWidget } from "~~/components/ai/LowBidDetectWidget";
import { BidPanel } from "~~/components/darkpool/BidPanel";
import { Countdown } from "~~/components/darkpool/Countdown";
import { VAULT_ABI } from "~~/lib/contracts";
import { ZERO_ADDRESS } from "~~/lib/darkpool-config";
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
      { ...contract, functionName: "oracle" },
      { ...contract, functionName: "delivered" },
      { ...contract, functionName: "paymentSubmitted" },
      { ...contract, functionName: "settlementDeadline" },
      { ...contract, functionName: "creatorBond" },
      { ...contract, functionName: "secondBidder" },
      { ...contract, functionName: "assetProofHash" },
      { ...contract, functionName: "biddingStartTime" },
      { ...contract, functionName: "paused" },
      { ...contract, functionName: "winningBidAmount" },
      { ...contract, functionName: "requiresAccreditation" },
    ],
  });

  const { writeContractAsync, isPending: isTxPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  if (isTxSuccess) refetch();

  async function sendTx(
    functionName: string,
    args?: readonly unknown[],
    value?: bigint,
    successMsg = "Transaction submitted",
  ) {
    try {
      const h = await (writeContractAsync as any)({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName,
        args,
        ...(value !== undefined ? { value } : {}),
      });
      setTxHash(h);
      toast.success(successMsg);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.slice(0, 80) : "Failed");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-xs uppercase opacity-100">
        LOADING...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="border border-white p-8 text-center">
          <p className="font-mono text-xs uppercase opacity-100 mb-2">FAILED TO LOAD VAULT</p>
          <Link href="/auctions" className="font-mono text-[10px] uppercase opacity-100 hover:opacity-100">
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
  const oracle = (data[11].result ?? "0x0") as `0x${string}`;
  const delivered = (data[12].result ?? false) as boolean;
  const paymentSubmitted = (data[13].result ?? false) as boolean;
  const settlementDeadline = (data[14].result ?? 0n) as bigint;
  const creatorBond = (data[15].result ?? 0n) as bigint;
  const secondBidder = (data[16].result ?? "0x0") as `0x${string}`;
  const assetProofHash = (data[17].result ?? "0x") as `0x${string}`;
  const biddingStartTime = (data[18].result ?? 0n) as bigint;
  const paused = (data[19].result ?? false) as boolean;
  const winningBidAmount = (data[20].result ?? 0n) as bigint;
  const requiresAccreditation = (data[21].result ?? false) as boolean;

  const phase = phaseRaw as VaultPhase;
  const status = phaseToStatus(phase, closeTime);
  const isBuyer = userAddress?.toLowerCase() === buyer.toLowerCase();
  const isWinner = userAddress?.toLowerCase() === winner.toLowerCase();
  const isOracle = userAddress?.toLowerCase() === oracle.toLowerCase();
  const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const nowSec = Math.floor(Date.now() / 1000);
  const secsToClose = Math.max(0, Number(closeTime) - nowSec);
  const canTriggerReveal = status === "open" && secsToClose === 0;
  const canSettle = phase === VaultPhase.REVEAL && nowSec > Number(revealDeadline) && isBuyer;
  const canCancel = phase === VaultPhase.OPEN && isBuyer;
  const canSubmitPayment = isWinner && phase === VaultPhase.SETTLED && !paymentSubmitted;
  const canConfirmDelivery = isOracle && paymentSubmitted && !delivered;
  const canDisputeDelivery = (isBuyer || isWinner) && paymentSubmitted && !delivered;
  const canClaimBuyerDefault =
    isBuyer &&
    phase === VaultPhase.SETTLED &&
    !paymentSubmitted &&
    settlementDeadline > 0n &&
    nowSec > Number(settlementDeadline);
  const canReleaseCreatorBond = isBuyer && delivered && creatorBond > 0n;

  const rows = [
    { label: "CONTRACT", value: vaultAddress },
    { label: "BUYER", value: formatAddress(buyer) },
    { label: "PHASE", value: PHASE_LABEL[phase] },
    { label: "DEPOSIT", value: formatWei(depositRequired) },
    { label: "CLOSE", value: formatTimestamp(closeTime) },
    { label: "REVEAL DL", value: formatTimestamp(revealDeadline) },
    { label: "BID COUNT", value: String(Number(bidCount)) },
    { label: "CREATOR BOND", value: creatorBond > 0n ? formatWei(creatorBond) : "NONE" },
    ...(oracle !== ZERO_ADDRESS ? [{ label: "ORACLE", value: formatAddress(oracle) }] : []),
    ...(biddingStartTime > 0n ? [{ label: "BIDDING OPENS", value: formatTimestamp(biddingStartTime) }] : []),
    ...(phase === VaultPhase.SETTLED
      ? [
          { label: "WINNER", value: formatAddress(winner) },
          { label: "WINNING PRICE", value: formatWei(winningPrice) },
          { label: "WINNING BID", value: formatWei(winningBidAmount) },
          ...(secondBidder !== ZERO_ADDRESS ? [{ label: "BACKUP BIDDER", value: formatAddress(secondBidder) }] : []),
          { label: "PAYMENT", value: paymentSubmitted ? "SUBMITTED ✓" : "PENDING" },
          { label: "DELIVERY", value: delivered ? "CONFIRMED ✓" : "PENDING" },
          ...(settlementDeadline > 0n ? [{ label: "PAYMENT DL", value: formatTimestamp(settlementDeadline) }] : []),
        ]
      : []),
    ...(assetProofHash && assetProofHash !== ZERO_HASH
      ? [{ label: "ASSET PROOF", value: assetProofHash.slice(0, 18) + "..." }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-black pt-14">
      {/* Top bar */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/auctions"
            className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-100 hover:opacity-100 transition-opacity"
          >
            ← ALL AUCTIONS
          </Link>
          {paused && (
            <span className="font-mono text-[10px] uppercase border border-red-400 text-red-400 px-2 py-0.5">
              PAUSED
            </span>
          )}
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
            { label: "DEPOSIT", value: formatWei(depositRequired), node: null },
            {
              label: "CLOSE",
              value: formatTimestamp(closeTime),
              node:
                status === "open" ? (
                  <Countdown closeTimestamp={Number(closeTime)} className="font-mono text-xs font-bold" />
                ) : null,
            },
            { label: "BIDS", value: String(Number(bidCount)), node: null },
            { label: "REVEAL", value: formatTimestamp(revealDeadline), node: null },
          ].map((s, i) => (
            <div key={s.label} className={`px-6 py-6 ${i < 3 ? "border-r border-white" : ""}`}>
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-100 mb-1">{s.label}</p>
              {s.node ? (
                <div>
                  {s.node}
                  <p className="font-mono text-[9px] opacity-60 mt-1">{s.value}</p>
                </div>
              ) : (
                <p className="font-mono text-xs font-bold">{s.value}</p>
              )}
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
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">ABOUT</p>
            <p className="font-mono text-xs leading-relaxed opacity-70">{description || "NO DESCRIPTION PROVIDED."}</p>
          </div>

          {/* Details table */}
          <div className="border border-white border-t-0">
            <p className="px-6 pt-6 font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">VAULT DETAILS</p>
            <div className="divide-y divide-white/10">
              {rows.map(r => (
                <div key={r.label} className="flex justify-between px-6 py-3 font-mono text-xs">
                  <span className="opacity-100">{r.label}</span>
                  <span className="font-bold truncate ml-4 max-w-[60%] text-right">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ECIES key */}
          {/* AI Category */}
          <CategoryWidget title={title} description={description} />

          {eciesKey && (
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-3">ECIES PUBLIC KEY</p>
              <p className="font-mono text-[10px] opacity-100 break-all">{eciesKey}</p>
            </div>
          )}

          {/* Buyer actions */}
          {isBuyer && (canTriggerReveal || canSettle || canCancel || canClaimBuyerDefault || canReleaseCreatorBond) && (
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">BUYER ACTIONS</p>
              <div className="flex flex-wrap gap-0">
                {canTriggerReveal && (
                  <button
                    onClick={() => sendTx("triggerRevealPhase", [], undefined, "Reveal triggered")}
                    disabled={isTxPending}
                    className="border border-white px-4 py-2.5 font-mono text-[10px] uppercase bg-white text-black hover:opacity-80 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "TRIGGER REVEAL"}
                  </button>
                )}
                {canSettle && (
                  <button
                    onClick={() => sendTx("settle", [], undefined, "Settlement submitted")}
                    disabled={isTxPending}
                    className="border border-white border-l-0 px-4 py-2.5 font-mono text-[10px] uppercase bg-white text-black hover:opacity-80 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "SETTLE"}
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => sendTx("cancel", [], undefined, "Cancellation submitted")}
                    disabled={isTxPending}
                    className="border border-white border-l-0 px-4 py-2.5 font-mono text-[10px] uppercase hover:opacity-60 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "CANCEL"}
                  </button>
                )}
                {canClaimBuyerDefault && (
                  <button
                    onClick={() => sendTx("claimBuyerDefault", [], undefined, "Default claimed")}
                    disabled={isTxPending}
                    className="border border-yellow-400 border-l-0 px-4 py-2.5 font-mono text-[10px] uppercase text-yellow-400 hover:opacity-60 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "CLAIM DEFAULT"}
                  </button>
                )}
                {canReleaseCreatorBond && (
                  <button
                    onClick={() => sendTx("releaseCreatorBond", [], undefined, "Bond released")}
                    disabled={isTxPending}
                    className="border border-white border-l-0 px-4 py-2.5 font-mono text-[10px] uppercase hover:opacity-60 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "RELEASE BOND"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Settlement panel */}
          {phase === VaultPhase.SETTLED && (
            <div className="border border-white border-t-0 p-6">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">SETTLEMENT FLOW</p>
              {isWinner && canSubmitPayment && (
                <div className="mb-4">
                  <p className="font-mono text-[10px] uppercase opacity-100 mb-2">
                    YOU WON — SUBMIT PAYMENT OF {formatWei(winningBidAmount)}
                  </p>
                  <button
                    onClick={() => sendTx("submitPayment", [], winningBidAmount, "Payment submitted")}
                    disabled={isTxPending}
                    className="border border-green-400 px-6 py-3 font-mono text-[10px] uppercase text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "PROCESSING..." : "SUBMIT PAYMENT"}
                  </button>
                </div>
              )}
              {isOracle && canConfirmDelivery && (
                <div className="mb-4">
                  <p className="font-mono text-[10px] uppercase opacity-100 mb-2">ORACLE: CONFIRM ASSET DELIVERY</p>
                  <button
                    onClick={() => sendTx("confirmDelivery", [], undefined, "Delivery confirmed — payment released")}
                    disabled={isTxPending}
                    className="border border-green-400 px-6 py-3 font-mono text-[10px] uppercase text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "CONFIRM DELIVERY"}
                  </button>
                </div>
              )}
              {canDisputeDelivery && (
                <div className="mb-4">
                  <p className="font-mono text-[10px] uppercase opacity-100 mb-2">DISPUTE DELIVERY</p>
                  <button
                    onClick={() => sendTx("disputeDelivery", [], undefined, "Dispute filed")}
                    disabled={isTxPending}
                    className="border border-red-400 px-6 py-3 font-mono text-[10px] uppercase text-red-400 hover:opacity-80 transition-all disabled:opacity-20"
                  >
                    {isTxPending ? "..." : "DISPUTE"}
                  </button>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2 font-mono text-[10px]">
                <div
                  className={`p-2 border ${paymentSubmitted ? "border-green-400/40 text-green-400" : "border-white/10 opacity-100"}`}
                >
                  PAYMENT: {paymentSubmitted ? "RECEIVED" : "AWAITING"}
                </div>
                <div
                  className={`p-2 border ${delivered ? "border-green-400/40 text-green-400" : "border-white/10 opacity-100"}`}
                >
                  DELIVERY: {delivered ? "CONFIRMED" : "PENDING"}
                </div>
              </div>
            </div>
          )}
          {/* AI Lot Analysis (Provider, OPEN/REVEAL phase) */}
          {!isBuyer && (status === "open" || status === "reveal") && (
            <LotAnalysisWidget
              auctionTitle={title}
              auctionDescription={description}
              depositRequired={formatWei(depositRequired)}
              closeTime={Number(closeTime)}
            />
          )}

          {/* AI Bid Scoring (Buyer, SETTLED phase) */}
          {isBuyer && phase === VaultPhase.SETTLED && (
            <BidScoringWidget
              auctionTitle={title}
              auctionDescription={description}
              revealedBids={[]} // Will be populated when bid reveal data is available
            />
          )}

          {/* AI Low Bid Detection (Buyer, SETTLED phase) */}
          {isBuyer && phase === VaultPhase.SETTLED && (
            <LowBidDetectWidget
              auctionTitle={title}
              auctionDescription={description}
              revealedBids={[]} // Will be populated when bid reveal data is available
            />
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
              requiresAccreditation={requiresAccreditation}
            />
            <div className="border border-white border-t-0 p-4">
              <p className="font-mono text-[10px] uppercase opacity-100 leading-relaxed">
                SEALED-BID GUARANTEE: YOUR BID IS COMMITTED AS A HASH. PRICE HIDDEN UNTIL REVEAL. NON-REVEALERS LOSE
                DEPOSIT.
              </p>
              {oracle !== ZERO_ADDRESS && (
                <p className="font-mono text-[10px] uppercase opacity-100 leading-relaxed mt-2">
                  ORACLE-GATED SETTLEMENT. PAYMENT HELD IN ESCROW UNTIL DELIVERY CONFIRMED.
                </p>
              )}
            </div>

            {/* AI Bid Draft (Provider, OPEN phase) */}
            {!isBuyer && status === "open" && (
              <BidDraftWidget auctionTitle={title} auctionDescription={description} providerPrice={0} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
