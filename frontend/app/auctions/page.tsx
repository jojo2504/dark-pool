"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { AuctionCard } from "@/components/AuctionCard";
import { AuctionState, AuctionStatus } from "@/lib/types";

/* ──────────────────────────────────────────────
   Mock data — replace with on-chain reads
   ────────────────────────────────────────────── */
const MOCK_AUCTIONS: AuctionState[] = [
  {
    id: "0x01",
    title: "Series A Software License Bundle",
    category: "Software",
    status: "active",
    currentBid: "12400000000",
    bidCount: 7,
    endsAt: Date.now() + 3 * 3600 * 1000,
    createdBy: "0xAbCd...1234",
    params: {
      startingBid: "10000000000",
      reservePrice: "15000000000",
      minBidIncrement: "500000000",
      durationHours: 48,
      antiSnipingWindowMinutes: 10,
      antiSnipingExtensionMinutes: 5,
      visibility: "public",
      auctionType: "sealed",
      maxBidders: 20,
      bidDepositPercent: 10,
      showReservePrice: false,
    },
  },
  {
    id: "0x02",
    title: "Enterprise Cloud Infrastructure Q3",
    category: "Cloud",
    status: "active",
    currentBid: "88000000000",
    bidCount: 3,
    endsAt: Date.now() + 12 * 3600 * 1000,
    createdBy: "0xDe12...5678",
    params: {
      startingBid: "80000000000",
      reservePrice: "120000000000",
      minBidIncrement: "2000000000",
      durationHours: 72,
      antiSnipingWindowMinutes: 15,
      antiSnipingExtensionMinutes: 10,
      visibility: "public",
      auctionType: "sealed",
      maxBidders: 10,
      bidDepositPercent: 5,
      showReservePrice: false,
    },
  },
  {
    id: "0x03",
    title: "Managed Security Services – Annual",
    category: "Security",
    status: "pending",
    bidCount: 0,
    endsAt: Date.now() + 48 * 3600 * 1000,
    createdBy: "0xFf00...9999",
    params: {
      startingBid: "25000000000",
      minBidIncrement: "1000000000",
      durationHours: 24,
      antiSnipingWindowMinutes: 10,
      antiSnipingExtensionMinutes: 5,
      visibility: "private",
      auctionType: "sealed",
      maxBidders: 5,
      bidDepositPercent: 15,
      showReservePrice: false,
    },
  },
  {
    id: "0x04",
    title: "Office Hardware Procurement 2024",
    category: "Hardware",
    status: "closed",
    currentBid: "34500000000",
    bidCount: 12,
    endsAt: Date.now() - 2 * 3600 * 1000,
    createdBy: "0x1122...aabb",
    params: {
      startingBid: "20000000000",
      minBidIncrement: "500000000",
      durationHours: 72,
      antiSnipingWindowMinutes: 10,
      antiSnipingExtensionMinutes: 5,
      visibility: "public",
      auctionType: "sealed",
      maxBidders: 30,
      bidDepositPercent: 10,
      showReservePrice: true,
      reservePrice: "30000000000",
    },
  },
  {
    id: "0x05",
    title: "Professional Services – Legal Q4",
    category: "Services",
    status: "settled",
    currentBid: "55000000000",
    bidCount: 6,
    endsAt: Date.now() - 24 * 3600 * 1000,
    createdBy: "0xccdd...eeff",
    params: {
      startingBid: "50000000000",
      minBidIncrement: "1000000000",
      durationHours: 48,
      antiSnipingWindowMinutes: 5,
      antiSnipingExtensionMinutes: 5,
      visibility: "public",
      auctionType: "sealed",
      maxBidders: 15,
      bidDepositPercent: 10,
      showReservePrice: false,
    },
  },
  {
    id: "0x06",
    title: "Data Analytics Platform License",
    category: "Software",
    status: "active",
    currentBid: "7800000000",
    bidCount: 4,
    endsAt: Date.now() + 6 * 3600 * 1000,
    createdBy: "0xabab...cdcd",
    params: {
      startingBid: "5000000000",
      minBidIncrement: "200000000",
      durationHours: 24,
      antiSnipingWindowMinutes: 10,
      antiSnipingExtensionMinutes: 5,
      visibility: "public",
      auctionType: "sealed",
      maxBidders: 25,
      bidDepositPercent: 5,
      showReservePrice: false,
    },
  },
];

const STATUS_FILTERS: { value: AuctionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "pending", label: "Upcoming" },
  { value: "closed", label: "Revealing" },
  { value: "settled", label: "Settled" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "ending_soon", label: "Ending Soon" },
  { value: "highest_bid", label: "Highest Bid" },
  { value: "most_bids", label: "Most Bids" },
];

export default function AuctionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AuctionStatus | "all">("all");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = MOCK_AUCTIONS.filter((a) => {
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }).sort((a, b) => {
    if (sort === "ending_soon") return (a.endsAt ?? 0) - (b.endsAt ?? 0);
    if (sort === "highest_bid")
      return Number(b.currentBid ?? 0) - Number(a.currentBid ?? 0);
    if (sort === "most_bids") return b.bidCount - a.bidCount;
    return 0; // newest — mock order
  });

  const liveCount = MOCK_AUCTIONS.filter((a) => a.status === "active").length;

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
              <span className="text-emerald-400 font-medium">{liveCount} live</span>{" "}
              · {MOCK_AUCTIONS.length} total · Sealed bids · USDCx only
            </p>
          </div>
          <Link
            href="/auctions/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-all self-start sm:self-auto shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            New Auction
          </Link>
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
              placeholder="Search auctions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-sm focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#141414]">
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${
              showFilters
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
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap gap-2 mb-6"
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  statusFilter === f.value
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <p className="text-lg">No auctions found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((auction, i) => (
              <AuctionCard key={auction.id} auction={auction} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
