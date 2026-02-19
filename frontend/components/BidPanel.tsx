"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCanton } from "@/lib/canton-context";
import {
  Lock,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatUSDCx, formatTimeLeft } from "@/lib/utils";
import { AuctionState } from "@/lib/types";

interface BidPanelProps {
  auction: AuctionState;
}

type BidStep = "idle" | "approve" | "lock" | "success";

export function BidPanel({ auction }: BidPanelProps) {
  const { status, identity } = useCanton();
  const isConnected = status === "connected" && !!identity;

  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<BidStep>("idle");
  const [showIncrease, setShowIncrease] = useState(false);
  const [increaseAmount, setIncreaseAmount] = useState("");

  const minBid = BigInt(auction.params.startingBid ?? "0");
  const minIncrement = BigInt(auction.params.minBidIncrement ?? "0");
  const currentBid = BigInt(auction.currentBid ?? auction.params.startingBid ?? "0");
  const minRequired = auction.bidCount > 0 ? currentBid + minIncrement : minBid;

  const depositPercent = auction.params.bidDepositPercent ?? 10;
  const amountNum = parseFloat(amount) || 0;
  const depositAmount = (amountNum * depositPercent) / 100;

  const isLive = auction.status === "active";
  const timeLeft = formatTimeLeft(
    Math.max(0, Math.floor(((auction.endsAt ?? 0) - Date.now()) / 1000))
  );

  // Mock: has user bid already?
  const userHasBid = false;
  const userLockedAmount = "0";

  const handleBid = async () => {
    if (!isConnected) {
      toast.error("Connect your Canton identity first");
      return;
    }
    const val = parseFloat(amount);
    if (!val || val * 1e6 < Number(minRequired)) {
      toast.error(`Minimum bid: ${formatUSDCx(minRequired.toString())}`);
      return;
    }
    setStep("approve");
    await new Promise((r) => setTimeout(r, 1200));
    setStep("lock");
    await new Promise((r) => setTimeout(r, 1500));
    setStep("success");
    toast.success("Bid locked! Funds secured until auction closes.", {
      icon: "🔒",
      duration: 5000,
    });
  };

  const handleIncreaseBid = async () => {
    const val = parseFloat(increaseAmount);
    if (!val) return;
    toast.loading("Increasing bid…", { duration: 2000 });
    await new Promise((r) => setTimeout(r, 2000));
    toast.success("Bid increased successfully!", { icon: "📈" });
    setIncreaseAmount("");
    setShowIncrease(false);
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-white text-sm font-semibold">Place Bid</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Clock className="w-3 h-3" />
            {timeLeft}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Current bid display */}
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">
            {auction.bidCount > 0 ? "Current Highest Bid" : "Starting Bid"}
          </p>
          <div className="flex items-baseline justify-between">
            <p className="text-white font-mono font-bold text-2xl">
              {formatUSDCx(currentBid.toString())}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400" />
              <span className="text-zinc-400 text-xs font-medium">USDCx</span>
            </div>
          </div>
          {auction.bidCount > 0 && (
            <p className="text-zinc-600 text-xs mt-1">
              {auction.bidCount} sealed bid{auction.bidCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {!isLive ? (
          <div className="text-center py-4 text-zinc-500 text-sm">
            {auction.status === "pending"
              ? "Auction has not started yet"
              : auction.status === "closed"
              ? "Bidding closed — revealing bids"
              : "Auction has ended"}
          </div>
        ) : step === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-400 font-semibold text-sm">
              Bid Locked!
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              Your USDCx is secured until the auction settles
            </p>
          </motion.div>
        ) : (
          <>
            {/* Bid input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-zinc-300 text-sm font-medium">
                  Your Bid
                </label>
                <span className="text-zinc-600 text-xs">
                  Min: {formatUSDCx(minRequired.toString())}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(Number(minRequired) / 1e6)}
                  className="w-full pl-4 pr-16 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">
                  USDCx
                </span>
              </div>
            </div>

            {/* Deposit info */}
            {amountNum > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-yellow-500/[0.06] border border-yellow-500/20 rounded-xl p-3 text-xs"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-yellow-300/80">
                    <strong>{depositPercent}% deposit required: </strong>
                    <span className="font-mono">
                      ~{depositAmount.toFixed(2)} USDCx
                    </span>{" "}
                    will be locked. Full amount released if you don&apos;t win.
                  </div>
                </div>
              </motion.div>
            )}

            {/* Lock btn */}
            <button
              onClick={handleBid}
              disabled={step !== "idle"}
              className="w-full py-3.5 rounded-xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2"
            >
              {step === "approve" ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                  Approving USDCx…
                </>
              ) : step === "lock" ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                  Locking Funds…
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  {isConnected ? "Lock Funds & Bid" : "Connect Identity to Bid"}
                </>
              )}
            </button>

            <p className="text-zinc-600 text-[11px] text-center">
              Bids are sealed — no one can see your amount until close
            </p>
          </>
        )}

        {/* Increase bid section */}
        {isLive && step === "success" && (
          <div className="border-t border-white/[0.06] pt-4">
            <button
              onClick={() => setShowIncrease((p) => !p)}
              className="w-full flex items-center justify-between text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Increase my bid
              </div>
              {showIncrease ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {showIncrease && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-3 overflow-hidden"
                >
                  <p className="text-zinc-500 text-xs">
                    Current locked:{" "}
                    <span className="text-cyan-400 font-mono">
                      {userLockedAmount} USDCx
                    </span>
                    . Add more to increase your sealed bid.
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={increaseAmount}
                      onChange={(e) => setIncreaseAmount(e.target.value)}
                      placeholder="Additional USDCx"
                      className="w-full pl-4 pr-16 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                      USDCx
                    </span>
                  </div>
                  <button
                    onClick={handleIncreaseBid}
                    disabled={!increaseAmount}
                    className="w-full py-2.5 rounded-xl border border-cyan-500/40 text-cyan-400 text-sm font-medium hover:bg-cyan-500/10 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Add Funds
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Locked funds note */}
      <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
        <p className="text-zinc-600 text-[11px] flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Funds auto-released to non-winners after settlement
        </p>
      </div>
    </div>
  );
}
