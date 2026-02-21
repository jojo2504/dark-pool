"use client";

import { useState } from "react";

interface ScoredBid {
  bidderAddress: string;
  priceScore: number;
  qualityScore: number;
  overallScore: number;
  reasoning: string;
}

interface BidScoringResult {
  scoredBids: ScoredBid[];
  bestValueBid: string;
  recommendation: string;
  isFallback?: boolean;
}

interface BidScoringWidgetProps {
  auctionTitle: string;
  auctionDescription: string;
  revealedBids: Array<{ price: number; conditions: string; bidderAddress: string }>;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

export function BidScoringWidget({ auctionTitle, auctionDescription, revealedBids }: BidScoringWidgetProps) {
  const [result, setResult] = useState<BidScoringResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScoring() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/bid-scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionTitle, auctionDescription, revealedBids }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { scoring } = await res.json();
      setResult(scoring);
    } catch (e: any) {
      setError(e.message || "Scoring failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI MULTI-CRITERIA BID SCORING</p>

      {result?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">
            📡 OFFLINE MODE — PRICE-WEIGHTED SCORING ONLY.
          </p>
        </div>
      )}

      <button
        onClick={runScoring}
        disabled={loading || revealedBids.length < 2}
        className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
      >
        {loading ? "SCORING..." : result ? "RE-SCORE BIDS" : "SCORE ALL BIDS"}
      </button>

      {error && (
        <div className="border border-red-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-0">
          {/* Scoring table */}
          <div className="border border-white">
            {/* Header */}
            <div className="grid grid-cols-5 gap-0 border-b border-white/30 px-3 py-2">
              {["BIDDER", "PRICE", "QUALITY", "OVERALL", ""].map((h, i) => (
                <p key={i} className="font-mono text-[8px] uppercase opacity-60">
                  {h}
                </p>
              ))}
            </div>
            {/* Rows */}
            {result.scoredBids.map((bid, i) => (
              <div
                key={i}
                className={`grid grid-cols-5 gap-0 px-3 py-2 ${i < result.scoredBids.length - 1 ? "border-b border-white/10" : ""} ${bid.bidderAddress === result.bestValueBid ? "bg-white/5" : ""}`}
              >
                <p className="font-mono text-[10px] truncate">
                  {bid.bidderAddress.slice(0, 8)}...
                  {bid.bidderAddress === result.bestValueBid && <span className="text-green-400 ml-1">★</span>}
                </p>
                <p className={`font-mono text-[10px] font-bold ${scoreColor(bid.priceScore)}`}>{bid.priceScore}</p>
                <p className={`font-mono text-[10px] font-bold ${scoreColor(bid.qualityScore)}`}>{bid.qualityScore}</p>
                <p className={`font-mono text-[10px] font-bold ${scoreColor(bid.overallScore)}`}>{bid.overallScore}</p>
                <p className="font-mono text-[9px] opacity-60 truncate">{bid.reasoning.slice(0, 30)}</p>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RECOMMENDATION</p>
            <p className="font-mono text-[10px] opacity-80 leading-relaxed">{result.recommendation}</p>
          </div>

          <div className="border border-white border-t-0 p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100">
              SCORES: 0-100 • ★ = BEST VALUE • DECENTRALIZED INFERENCE VIA 0G COMPUTE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
