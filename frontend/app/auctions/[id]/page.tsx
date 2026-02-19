"use client";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Users,
  Eye,
  EyeOff,
  Share2,
  CheckCircle2,
} from "lucide-react";
import { AuctionRulesDisplay } from "@/components/AuctionRulesDisplay";
import { BidPanel } from "@/components/BidPanel";
import { AuctionState } from "@/lib/types";
import { formatUSDCx, formatTimeLeft } from "@/lib/utils";

/* ─── Mock data (replace with on-chain reads) ────────────── */
const MOCK_AUCTIONS: Record<string, AuctionState> = {
  "0x01": {
    id: "0x01",
    title: "Series A Software License Bundle",
    category: "Software",
    status: "active",
    currentBid: "12400000000",
    bidCount: 7,
    endsAt: Date.now() + 3 * 3600 * 1000,
    createdAt: Date.now() - 24 * 3600 * 1000,
    createdBy: "0xAbCd1234",
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
  "0x02": {
    id: "0x02",
    title: "Enterprise Cloud Infrastructure Q3",
    category: "Cloud",
    status: "active",
    currentBid: "88000000000",
    bidCount: 3,
    endsAt: Date.now() + 12 * 3600 * 1000,
    createdAt: Date.now() - 6 * 3600 * 1000,
    createdBy: "0xDe125678",
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
};

const statusConfig: Record<
  AuctionState["status"],
  { label: string; color: string }
> = {
  active: { label: "Live", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  pending: { label: "Upcoming", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  closed: { label: "Revealing", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  settled: { label: "Settled", color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20" },
  cancelled: { label: "Cancelled", color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

/* ─── Page ───────────────────────────────────────────────── */
export default function AuctionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const auction = MOCK_AUCTIONS[params.id];
  if (!auction) notFound();

  const status = statusConfig[auction.status];
  const isLive = auction.status === "active";
  const timeLeft = formatTimeLeft(
    Math.max(0, Math.floor(((auction.endsAt ?? 0) - Date.now()) / 1000))
  );

  return (
    <div className="min-h-screen bg-[#050505] pt-28 pb-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${status.color}`}
              >
                {isLive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                )}
                {status.label}
              </span>
              <span className="text-zinc-600 text-xs capitalize">
                {auction.category}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {auction.title}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              By{" "}
              <span className="font-mono text-zinc-400">
                {auction.createdBy}
              </span>
            </p>
          </div>
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-zinc-400 text-sm hover:bg-white/[0.04] transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          {[
            {
              icon: CheckCircle2,
              label: "Current Bid",
              value: formatUSDCx(auction.currentBid ?? auction.params.startingBid),
              highlight: true,
            },
            {
              icon: Clock,
              label: "Time Left",
              value: isLive ? timeLeft : auction.status === "pending" ? "Not started" : "Ended",
            },
            {
              icon: Users,
              label: "Sealed Bids",
              value: String(auction.bidCount),
            },
            {
              icon: auction.params.visibility === "private" ? EyeOff : Eye,
              label: "Visibility",
              value: <span className="capitalize">{auction.params.visibility}</span>,
            },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1">
                <s.icon className="w-3 h-3" />
                {s.label}
              </p>
              <p
                className={`font-mono text-sm font-semibold ${
                  s.highlight ? "text-cyan-400" : "text-zinc-200"
                }`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Main content: rules left, bid panel right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Rules */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 space-y-4"
          >
            {/* Description (placeholder) */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-white text-sm font-semibold mb-3">About this Auction</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                This is a sealed-bid procurement auction. All bids are
                cryptographically hidden until the auction closes. After the
                deadline, bids are revealed and the highest valid bid wins.
                Settlement is handled automatically via smart contract on Canton
                Network with USDCx.
              </p>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-white text-sm font-semibold mb-4">Timeline</h2>
              <div className="space-y-3">
                {[
                  {
                    label: "Created",
                    time: auction.createdAt
                      ? new Date(auction.createdAt).toLocaleString()
                      : "—",
                    done: true,
                  },
                  {
                    label: "Bidding Closes",
                    time: auction.endsAt
                      ? new Date(auction.endsAt).toLocaleString()
                      : "—",
                    done: !isLive && auction.status !== "pending",
                  },
                  {
                    label: "Reveal Phase",
                    time: "After bidding closes",
                    done: auction.status === "settled",
                  },
                  {
                    label: "Settlement",
                    time: "Automatic on reveal",
                    done: auction.status === "settled",
                  },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        step.done
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : i === 1 && isLive
                          ? "border-cyan-500/50 bg-cyan-500/10"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : i === 1 && isLive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span
                        className={`text-sm ${
                          step.done ? "text-zinc-300" : "text-zinc-500"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="text-zinc-600 text-xs">{step.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Immutable rules */}
            <AuctionRulesDisplay
              params={auction.params}
              createdAt={auction.createdAt}
              createdBy={auction.createdBy}
            />
          </motion.div>

          {/* Right: Bid panel (sticky) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2"
          >
            <div className="lg:sticky lg:top-28 space-y-4">
              <BidPanel auction={auction} />

              {/* Privacy note */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-zinc-500 text-xs leading-relaxed">
                  <span className="text-zinc-300 font-medium">
                    Sealed-bid guarantee:
                  </span>{" "}
                  Your bid amount is cryptographically hidden from all
                  participants — including the auctioneer — until the reveal
                  phase. No front-running possible.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
