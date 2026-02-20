"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { PostRevealReport } from "~~/components/ai/PostRevealReport";
import { FACTORY_ABI, VAULT_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS } from "~~/lib/darkpool-config";
import { VaultPhase, phaseToStatus } from "~~/lib/types";
import { formatAddress, formatTimeLeft, formatTimestamp, formatWei } from "~~/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "created" | "participated";

interface VaultData {
  address: `0x${string}`;
  title: string;
  phase: VaultPhase;
  status: string;
  closeTime: bigint;
  depositRequired: bigint;
  bidCount: bigint;
  winner: `0x${string}`;
  winningPrice: bigint;
  buyer: `0x${string}`;
  delivered: boolean;
  paymentSubmitted: boolean;
}

const STATUS_CONFIG: Record<string, { badge: string; color: string; desc: string }> = {
  open: { badge: "OPEN", color: "border-green-400/40 text-green-400", desc: "Accepting bids" },
  reveal: { badge: "REVEAL", color: "border-blue-400/40 text-blue-400", desc: "Bid reveal phase" },
  settled: { badge: "SETTLED", color: "border-white/40 text-white", desc: "Winner selected" },
  cancelled: { badge: "CANCELLED", color: "border-red-400/40 text-red-400", desc: "Auction cancelled" },
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "created", label: "MY CREATIONS" },
  { key: "participated", label: "MY PARTICIPATIONS" },
];

// ─── Vault Row Component ──────────────────────────────────────────────────────

function VaultRow({
  vault,
  index,
  isBuyer,
  userAddress,
}: {
  vault: VaultData;
  index: number;
  isBuyer: boolean;
  userAddress: `0x${string}`;
}) {
  const [showReport, setShowReport] = useState(false);
  const cfg = STATUS_CONFIG[vault.status] ?? STATUS_CONFIG.open;
  const nowSec = Math.floor(Date.now() / 1000);
  const secsLeft = Math.max(0, Number(vault.closeTime) - nowSec);
  const isOpen = vault.status === "open";
  const isSettled = vault.status === "settled";
  const isWinner = vault.winner.toLowerCase() === userAddress.toLowerCase();
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 }}>
      <div className="border border-white p-6 hover:opacity-80 transition-all">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[9px] tracking-[0.15em] uppercase border px-2 py-0.5 ${cfg.color}`}>
              {cfg.badge}
            </span>
            {isOpen && (
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-100">
                {formatTimeLeft(secsLeft)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0">
            <Link
              href={`/auctions/${vault.address}`}
              className="border border-white px-3 py-1.5 font-mono text-[9px] uppercase hover:opacity-60 transition-all"
            >
              VIEW
            </Link>
            {isBuyer && isSettled && (
              <button
                onClick={() => setShowReport(!showReport)}
                className="border border-white border-l-0 px-3 py-1.5 font-mono text-[9px] uppercase hover:opacity-60 transition-all"
              >
                {showReport ? "HIDE REPORT" : "AI REPORT"}
              </button>
            )}
          </div>
        </div>

        {/* Title + address */}
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.02em] mb-1">{vault.title || "UNNAMED"}</h3>
        <p className="font-mono text-[10px] opacity-100 mb-4 truncate">{vault.address}</p>

        {/* Stats */}
        <div className="flex items-center justify-between font-mono text-xs mb-2">
          <span>
            <span className="opacity-100">DEPOSIT: </span>
            <span className="font-bold">{formatWei(vault.depositRequired)}</span>
          </span>
          <span>
            <span className="opacity-100">BIDS: </span>
            <span className="font-bold">{Number(vault.bidCount)}</span>
          </span>
          <span>
            <span className="opacity-100">CLOSE: </span>
            <span className="font-bold">{formatTimestamp(vault.closeTime)}</span>
          </span>
        </div>

        {/* Winner info (if settled) */}
        {isSettled && vault.winner !== ZERO_ADDR && (
          <div className="border-t border-white/10 pt-3 mt-3 flex items-center justify-between font-mono text-xs">
            <span>
              <span className="opacity-100">WINNER: </span>
              <span className={`font-bold ${isWinner ? "text-green-400" : ""}`}>
                {isWinner ? "YOU" : formatAddress(vault.winner)}
              </span>
            </span>
            <span>
              <span className="opacity-100">PRICE: </span>
              <span className="font-bold">{formatWei(vault.winningPrice)}</span>
            </span>
            <span>
              <span className="opacity-100">PAYMENT: </span>
              <span className={vault.paymentSubmitted ? "text-green-400" : "opacity-100"}>
                {vault.paymentSubmitted ? "RECEIVED" : "PENDING"}
              </span>
            </span>
          </div>
        )}

        {/* AI Report (inline expansion) */}
        {showReport && isSettled && (
          <div className="mt-4">
            <PostRevealReport
              auctionId={vault.address}
              auctionCategory="RWA"
              buyerAddress={userAddress}
              revealedBids={[]}
              auctionStartedAt={0}
              auctionEndedAt={Number(vault.closeTime)}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Vault Data Loader ────────────────────────────────────────────────────────

function VaultDataRow({
  address,
  index,
  isBuyer,
  userAddress,
}: {
  address: `0x${string}`;
  index: number;
  isBuyer: boolean;
  userAddress: `0x${string}`;
}) {
  const contract = { address, abi: VAULT_ABI } as const;
  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      { ...contract, functionName: "title" },
      { ...contract, functionName: "getCurrentPhase" },
      { ...contract, functionName: "closeTime" },
      { ...contract, functionName: "depositRequired" },
      { ...contract, functionName: "getBidCount" },
      { ...contract, functionName: "winner" },
      { ...contract, functionName: "winningPrice" },
      { ...contract, functionName: "buyer" },
      { ...contract, functionName: "delivered" },
      { ...contract, functionName: "paymentSubmitted" },
    ],
  });

  if (isLoading) {
    return <div className="border border-white p-6 font-mono text-xs opacity-100 animate-pulse">LOADING VAULT...</div>;
  }

  if (isError || !data) {
    return (
      <div className="border border-white p-6 font-mono text-xs opacity-100">ERROR: {address.slice(0, 14)}...</div>
    );
  }

  const title = (data[0].result ?? "UNNAMED") as string;
  const phaseRaw = (data[1].result ?? 0) as number;
  const closeTime = (data[2].result ?? 0n) as bigint;
  const depositRequired = (data[3].result ?? 0n) as bigint;
  const bidCount = (data[4].result ?? 0n) as bigint;
  const winner = (data[5].result ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const winningPrice = (data[6].result ?? 0n) as bigint;
  const buyer = (data[7].result ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const delivered = (data[8].result ?? false) as boolean;
  const paymentSubmitted = (data[9].result ?? false) as boolean;

  const phase = phaseRaw as VaultPhase;
  const status = phaseToStatus(phase, closeTime);

  const vault: VaultData = {
    address,
    title,
    phase,
    status,
    closeTime,
    depositRequired,
    bidCount,
    winner,
    winningPrice,
    buyer,
    delivered,
    paymentSubmitted,
  };

  return <VaultRow vault={vault} index={index} isBuyer={isBuyer} userAddress={userAddress} />;
}

// ─── Participation Checker ────────────────────────────────────────────────────

function ParticipationChecker({
  vaultAddress,
  userAddress,
  onResult,
}: {
  vaultAddress: `0x${string}`;
  userAddress: `0x${string}`;
  onResult: (participated: boolean) => void;
}) {
  const { data, isLoading } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "bids",
    args: [userAddress],
  });

  useEffect(() => {
    if (!isLoading && data) {
      // bids() returns tuple: [commitHash, storageRoot, revealedPrice, revealed, depositPaid, depositReturned]
      const commitHash = (data as any)[0] as `0x${string}`;
      const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
      onResult(commitHash !== ZERO_HASH);
    }
  }, [data, isLoading, onResult]);

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyAuctionsPage() {
  const { address: rawUserAddress, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<TabKey>("created");
  const [participatedVaults, setParticipatedVaults] = useState<`0x${string}`[]>([]);
  const [checkedVaults, setCheckedVaults] = useState<Set<string>>(new Set());

  // Explicit cast after null check below
  const userAddress = rawUserAddress as `0x${string}` | undefined;

  // Fetch vaults created by this user
  const { data: createdVaults, isLoading: createdLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getVaultsByBuyer",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchOnMount: "always" as const, staleTime: 0 },
  });

  // Fetch ALL vaults to check participation
  const { data: allVaults, isLoading: allVaultsLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllVaults",
    query: { enabled: !!userAddress && activeTab === "participated", refetchOnMount: "always" as const, staleTime: 0 },
  });

  const createdList = (createdVaults as `0x${string}`[] | undefined) ?? [];
  const allVaultsList = (allVaults as `0x${string}`[] | undefined) ?? [];

  const handleParticipationResult = (vaultAddress: `0x${string}`, participated: boolean) => {
    setCheckedVaults(prev => {
      const next = new Set(prev);
      next.add(vaultAddress);
      return next;
    });
    if (participated) {
      setParticipatedVaults(prev => {
        if (prev.includes(vaultAddress)) return prev;
        return [...prev, vaultAddress];
      });
    }
  };

  // Not connected
  if (!isConnected || !userAddress) {
    return (
      <div className="min-h-screen bg-black pt-14 flex items-center justify-center">
        <div className="border border-white p-12 text-center max-w-md">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">MY AUCTIONS</p>
          <p className="font-mono text-xs opacity-100 mb-6">CONNECT YOUR WALLET TO VIEW YOUR AUCTIONS</p>
          <Link
            href="/auctions"
            className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-100 hover:opacity-100 transition-opacity"
          >
            ← BROWSE ALL AUCTIONS
          </Link>
        </div>
      </div>
    );
  }

  const participationCheckComplete = allVaultsList.length > 0 && checkedVaults.size >= allVaultsList.length;

  return (
    <div className="min-h-screen bg-black pt-14">
      {/* Top bar */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/auctions"
            className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-100 hover:opacity-100 transition-opacity"
          >
            ← ALL AUCTIONS
          </Link>
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-100">
            {formatAddress(userAddress)}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-[-0.03em] uppercase text-white">
            MY AUCTIONS
          </h1>
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-100 mt-2">
            MANAGE YOUR CREATED AND PARTICIPATED AUCTIONS
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-4 font-mono text-[10px] tracking-[0.15em] uppercase transition-all
                ${activeTab === tab.key ? "bg-white text-black font-bold" : "opacity-100 hover:opacity-80"}`}
            >
              {tab.label}
              {tab.key === "created" && !createdLoading && (
                <span className="ml-2 opacity-100">[{createdList.length}]</span>
              )}
              {tab.key === "participated" && participationCheckComplete && (
                <span className="ml-2 opacity-100">[{participatedVaults.length}]</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Created Tab */}
        {activeTab === "created" && (
          <div>
            {createdLoading ? (
              <div className="border border-white p-12 text-center">
                <p className="font-mono text-xs uppercase opacity-100 animate-pulse">LOADING YOUR VAULTS...</p>
              </div>
            ) : createdList.length === 0 ? (
              <div className="border border-white p-12 text-center">
                <p className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-100 mb-4">
                  NO AUCTIONS CREATED YET
                </p>
                <Link
                  href="/auctions/create"
                  className="border border-white px-6 py-3 font-mono text-[10px] uppercase hover:opacity-60 transition-all"
                >
                  CREATE YOUR FIRST AUCTION
                </Link>
              </div>
            ) : (
              <div className="space-y-0">
                {[...createdList].reverse().map((addr, i) => (
                  <VaultDataRow key={addr} address={addr} index={i} isBuyer={true} userAddress={userAddress} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Participated Tab */}
        {activeTab === "participated" && (
          <div>
            {/* Hidden participation checkers */}
            {userAddress &&
              allVaultsList.map(addr => (
                <ParticipationChecker
                  key={addr}
                  vaultAddress={addr}
                  userAddress={userAddress}
                  onResult={participated => handleParticipationResult(addr, participated)}
                />
              ))}

            {allVaultsLoading || !participationCheckComplete ? (
              <div className="border border-white p-12 text-center">
                <p className="font-mono text-xs uppercase opacity-100 animate-pulse">
                  SCANNING {allVaultsList.length} VAULTS FOR YOUR BIDS...
                </p>
                {allVaultsList.length > 0 && (
                  <p className="font-mono text-[9px] uppercase opacity-100 mt-2">
                    {checkedVaults.size} / {allVaultsList.length} CHECKED
                  </p>
                )}
              </div>
            ) : participatedVaults.length === 0 ? (
              <div className="border border-white p-12 text-center">
                <p className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-100 mb-4">
                  NO PARTICIPATIONS FOUND
                </p>
                <Link
                  href="/auctions"
                  className="border border-white px-6 py-3 font-mono text-[10px] uppercase hover:opacity-60 transition-all"
                >
                  BROWSE AUCTIONS TO BID
                </Link>
              </div>
            ) : (
              <div className="space-y-0">
                {participatedVaults.map((addr, i) => (
                  <VaultDataRow key={addr} address={addr} index={i} isBuyer={false} userAddress={userAddress} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
