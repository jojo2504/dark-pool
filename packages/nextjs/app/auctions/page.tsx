"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { VaultCard } from "~~/components/darkpool/VaultCard";
import { FACTORY_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS, ZERO_ADDRESS } from "~~/lib/darkpool-config";

type StatusFilter = "all" | "open" | "reveal" | "settled" | "cancelled";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "open", label: "OPEN" },
  { value: "reveal", label: "REVEAL" },
  { value: "settled", label: "SETTLED" },
  { value: "cancelled", label: "CANCELLED" },
];

export default function AuctionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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

  const { address: userAddress, isConnected } = useAccount();
  const { data: isKybVerified } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "verified",
    args: [userAddress ?? ZERO_ADDRESS],
    query: { enabled: !!userAddress },
  });
  const showKybBanner = isConnected && isKybVerified === false;

  const addresses = (vaultAddresses ?? []) as `0x${string}`[];

  return (
    <div className="min-h-screen bg-black pt-14">
      {/* KYB verification banner */}
      {showKybBanner && (
        <div className="border-b border-yellow-400/30 bg-yellow-400/5">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <p className="font-mono text-[10px] uppercase text-yellow-400/80">
              ⚠ YOUR WALLET IS NOT KYB VERIFIED — YOU CANNOT BID ON AUCTIONS UNTIL VERIFIED
            </p>
            <Link
              href="/kyb"
              className="shrink-0 border border-yellow-400/60 text-yellow-400 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] hover:bg-yellow-400/10 transition-all"
            >
              VERIFY NOW →
            </Link>
          </div>
        </div>
      )}
      {/* Header bar */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-3">[ BROWSE ]</p>
            <h1 className="font-mono text-3xl font-bold tracking-[-0.03em] uppercase text-white">AUCTIONS</h1>
            {addresses.length > 0 && <p className="font-mono text-xs opacity-100 mt-1">{addresses.length} TOTAL</p>}
          </div>
          <div className="flex gap-0">
            <button
              onClick={() => refetch()}
              className="border border-white px-5 py-3 font-mono text-[10px] tracking-[0.15em] uppercase text-white hover:opacity-60 transition-all duration-100"
            >
              REFRESH
            </button>
            <Link
              href="/auctions/create"
              className="border border-white border-l-0 px-5 py-3 bg-white text-black font-mono text-[10px] tracking-[0.15em] uppercase font-bold hover:opacity-80 transition-all duration-100"
            >
              + NEW VAULT
            </Link>
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="border-b border-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-0 border border-white">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-2 font-mono text-[10px] tracking-[0.1em] uppercase border-r border-white last:border-r-0 transition-all duration-100 ${
                  statusFilter === f.value ? "bg-white text-black" : "text-white hover:opacity-60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SEARCH ADDRESS..."
            className="bg-black border border-white/50 px-4 py-2 font-mono text-xs text-white placeholder:text-white/40 w-full sm:w-64 focus:outline-none focus:border-white transition-all duration-100"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <p className="font-mono text-xs uppercase opacity-100 py-20 text-center">LOADING...</p>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="font-mono text-xs uppercase opacity-100 mb-2">FAILED TO LOAD VAULTS</p>
            <button
              onClick={() => refetch()}
              className="font-mono text-[10px] uppercase opacity-100 hover:opacity-100 transition-opacity"
            >
              [RETRY]
            </button>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-mono text-sm uppercase opacity-100 mb-2">NO VAULTS DEPLOYED</p>
            <Link
              href="/auctions/create"
              className="font-mono text-xs uppercase border-b border-white hover:opacity-60 transition-all px-1"
            >
              CREATE FIRST AUCTION
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
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
