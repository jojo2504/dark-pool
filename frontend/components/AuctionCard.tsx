"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Clock, Users, ArrowRight, Lock, Eye, EyeOff } from "lucide-react";
import { AuctionState } from "@/lib/types";
import { formatUSDCx, formatTimeLeft } from "@/lib/utils";

interface AuctionCardProps {
  auction: AuctionState;
  index?: number;
}

const statusConfig: Record<
  AuctionState["status"],
  { label: string; color: string; dot: string }
> = {
  active: {
    label: "Live",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  pending: {
    label: "Upcoming",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    dot: "bg-yellow-400",
  },
  closed: {
    label: "Revealing",
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    dot: "bg-cyan-400",
  },
  settled: {
    label: "Settled",
    color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    dot: "bg-zinc-400",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
    dot: "bg-red-400",
  },
};

export function AuctionCard({ auction, index = 0 }: AuctionCardProps) {
  const status = statusConfig[auction.status];
  const isLive = auction.status === "active";
  const timeLeft = formatTimeLeft(auction.params.durationHours * 3600); // placeholder

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/auctions/${auction.id}`}>
        <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200 overflow-hidden cursor-pointer">
          {/* Top glow on hover */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/0 to-transparent group-hover:via-cyan-500/40 transition-all duration-300" />

          {/* Live pulse ring */}
          {isLive && (
            <span className="absolute top-4 right-4 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          )}

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-3 pr-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-sm truncate group-hover:text-cyan-300 transition-colors">
                  {auction.title}
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5 capitalize">
                  {auction.category}
                </p>
              </div>
            </div>

            {/* Status badge */}
            <div className="mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${status.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>

            {/* Bid info */}
            <div className="bg-white/[0.03] rounded-xl p-3 mb-3 border border-white/[0.04]">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">
                    Current Bid
                  </p>
                  <p className="text-white font-mono font-semibold text-base">
                    {auction.currentBid
                      ? formatUSDCx(auction.currentBid)
                      : formatUSDCx(auction.params.startingBid)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">
                    USDCx
                  </p>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 ml-auto" />
                </div>
              </div>
            </div>

            {/* Footer row */}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeLeft}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {auction.bidCount} bids
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {auction.params.visibility === "private" ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                <Lock className="w-3 h-3" />
              </div>
            </div>

            {/* Arrow */}
            <div className="absolute bottom-4 right-4 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
