"use client";
import { Lock, Eye, EyeOff, Shield, Clock, Users, Percent } from "lucide-react";
import { AuctionParams } from "@/lib/types";
import { formatUSDCx } from "@/lib/utils";

interface AuctionRulesDisplayProps {
  params: AuctionParams;
  createdAt?: number;
  createdBy?: string;
}

function Row({
  icon: Icon,
  label,
  value,
  mono = false,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2.5 text-zinc-500 text-xs">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        {label}
      </div>
      <span
        className={`text-xs font-medium ${mono ? "font-mono" : ""} ${
          highlight ? "text-cyan-400" : "text-zinc-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function AuctionRulesDisplay({
  params,
  createdAt,
  createdBy,
}: AuctionRulesDisplayProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <span className="text-white text-sm font-semibold">Auction Rules</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium">
          <Lock className="w-2.5 h-2.5" />
          IMMUTABLE
        </div>
      </div>

      <div className="px-5 py-1">
        {/* Pricing */}
        <p className="text-zinc-600 text-[10px] uppercase tracking-widest pt-3 pb-1">
          Pricing
        </p>
        <Row
          icon={Shield}
          label="Starting Bid"
          value={formatUSDCx(params.startingBid)}
          mono
          highlight
        />
        {params.reservePrice && (
          <Row
            icon={params.showReservePrice ? Eye : EyeOff}
            label={`Reserve Price${params.showReservePrice ? "" : " (hidden)"}`}
            value={
              params.showReservePrice
                ? formatUSDCx(params.reservePrice)
                : "Hidden"
            }
            mono={params.showReservePrice}
          />
        )}
        <Row
          icon={Shield}
          label="Min Increment"
          value={formatUSDCx(params.minBidIncrement)}
          mono
        />
        {params.buyNowPrice && (
          <Row
            icon={Shield}
            label="Buy Now Price"
            value={formatUSDCx(params.buyNowPrice)}
            mono
            highlight
          />
        )}

        {/* Timing */}
        <p className="text-zinc-600 text-[10px] uppercase tracking-widest pt-4 pb-1">
          Timing
        </p>
        <Row
          icon={Clock}
          label="Duration"
          value={`${params.durationHours}h`}
        />
        <Row
          icon={Clock}
          label="Anti-sniping Window"
          value={`${params.antiSnipingWindowMinutes} min`}
        />
        <Row
          icon={Clock}
          label="Extension per Snipe"
          value={`${params.antiSnipingExtensionMinutes} min`}
        />

        {/* Access */}
        <p className="text-zinc-600 text-[10px] uppercase tracking-widest pt-4 pb-1">
          Access
        </p>
        <Row
          icon={params.visibility === "private" ? EyeOff : Eye}
          label="Visibility"
          value={
            <span className="capitalize">{params.visibility}</span>
          }
        />
        <Row
          icon={Shield}
          label="Auction Type"
          value={
            <span className="capitalize">{params.auctionType}</span>
          }
        />
        <Row
          icon={Users}
          label="Max Bidders"
          value={params.maxBidders}
        />
        <Row
          icon={Percent}
          label="Bid Deposit"
          value={`${params.bidDepositPercent}%`}
        />

        {/* Meta */}
        {(createdAt || createdBy) && (
          <>
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest pt-4 pb-1">
              Meta
            </p>
            {createdAt && (
              <Row
                icon={Clock}
                label="Created"
                value={new Date(createdAt).toLocaleDateString()}
              />
            )}
            {createdBy && (
              <Row
                icon={Shield}
                label="Creator"
                value={
                  createdBy.length > 12
                    ? `${createdBy.slice(0, 6)}…${createdBy.slice(-4)}`
                    : createdBy
                }
                mono
              />
            )}
          </>
        )}
      </div>

      {/* Footer note */}
      <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
        <p className="text-zinc-600 text-[11px] flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Parameters locked at creation · Cannot be modified
        </p>
      </div>
    </div>
  );
}
