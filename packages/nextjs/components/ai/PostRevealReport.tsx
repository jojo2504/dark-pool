"use client";

import { useState } from "react";

interface PostRevealReportData {
  collusionRisk: "none" | "low" | "medium" | "high" | "critical";
  collusionIndicators: string[];
  collusionExplanation: string;
  priceDispersion: {
    spreadPercent: number;
    standardDeviation: number;
    interpretation: string;
    outliers: string[];
  };
  winnerJustification: string;
  marketHealthScore: number;
  revealBehaviorAnalysis: string;
  nextCycleRecommendations: string[];
  shouldEscalate: boolean;
  isFallback?: boolean;
}

interface RevealedBid {
  bidderAddress: string;
  price: number;
  conditions: string;
  submittedAt: number;
  revealedAt: number;
}

interface PostRevealReportProps {
  auctionId: string;
  auctionCategory: string;
  buyerAddress: string;
  revealedBids: RevealedBid[];
  auctionStartedAt: number;
  auctionEndedAt: number;
}

const RISK_COLORS: Record<string, string> = {
  none: "border-green-400/40 text-green-400",
  low: "border-green-400/40 text-green-400",
  medium: "border-yellow-400/40 text-yellow-400",
  high: "border-red-400/40 text-red-400",
  critical: "border-red-600 text-red-500 bg-red-400/5",
};

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-green-400" : score >= 50 ? "bg-yellow-400" : score >= 25 ? "bg-orange-400" : "bg-red-400";
  return (
    <div className="w-full h-1 bg-white/10 mt-2">
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
    </div>
  );
}

export function PostRevealReport({
  auctionId,
  auctionCategory,
  buyerAddress,
  revealedBids,
  auctionStartedAt,
  auctionEndedAt,
}: PostRevealReportProps) {
  const [report, setReport] = useState<PostRevealReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/post-reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auctionId,
          auctionCategory,
          buyerAddress,
          revealedBids,
          auctionStartedAt,
          auctionEndedAt,
        }),
      });

      const rawText = await res.text();
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          errMsg = JSON.parse(rawText).error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = JSON.parse(rawText);
      setReport(data.report);
    } catch (e: any) {
      setError(e.message || "Report generation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!report) {
    return (
      <div className="border border-white p-6">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI POST-REVEAL ANALYSIS</p>
        <p className="font-mono text-[10px] opacity-100 mb-4 leading-relaxed">
          GENERATE AN AI-POWERED ANALYSIS OF REVEALED BIDS — COLLUSION DETECTION, PRICE DISPERSION, AND MARKET HEALTH.
          ALL DATA IS POST-REVEAL AND PUBLIC ON-CHAIN.
        </p>
        <button
          onClick={generateReport}
          disabled={loading || revealedBids.length < 2}
          className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20"
        >
          {loading ? "ANALYZING BIDS..." : "GENERATE AI REPORT"}
        </button>
        {error && (
          <div className="border border-red-400/40 p-3 mt-4">
            <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-white">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100">AI POST-REVEAL REPORT</p>
          <button
            onClick={generateReport}
            disabled={loading}
            className="border border-white px-3 py-1 font-mono text-[9px] uppercase hover:opacity-60 transition-all disabled:opacity-20"
          >
            {loading ? "..." : "REFRESH"}
          </button>
        </div>
      </div>

      {/* Fallback badge */}
      {report.isFallback && (
        <div className="p-3 border-b border-white/10 border-yellow-400/40">
          <p className="font-mono text-[9px] uppercase text-yellow-400">
            📡 OFFLINE MODE — LOCAL STATISTICAL ANALYSIS. RE-RUN FOR FULL AI ANALYSIS.
          </p>
        </div>
      )}

      {/* Collusion risk */}
      <div className={`p-4 border-b border-white/10 ${RISK_COLORS[report.collusionRisk]}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[9px] uppercase opacity-100">COLLUSION RISK</p>
          <span className="font-mono text-xs font-bold uppercase">{report.collusionRisk}</span>
        </div>
        <p className="font-mono text-[10px] opacity-70 leading-relaxed">{report.collusionExplanation}</p>
        {report.collusionIndicators.length > 0 && (
          <div className="mt-3 space-y-1">
            {report.collusionIndicators.map((ind, i) => (
              <p key={i} className="font-mono text-[9px] opacity-100">
                → {ind}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Price Dispersion */}
      <div className="p-4 border-b border-white/10">
        <p className="font-mono text-[9px] uppercase opacity-100 mb-3">PRICE DISPERSION</p>
        <div className="grid grid-cols-2 gap-0 mb-3">
          <div className="border border-white/10 p-2">
            <p className="font-mono text-[8px] uppercase opacity-100 mb-1">SPREAD</p>
            <p className="font-mono text-xs font-bold">{report.priceDispersion.spreadPercent}%</p>
          </div>
          <div className="border border-white/10 border-l-0 p-2">
            <p className="font-mono text-[8px] uppercase opacity-100 mb-1">STD DEV</p>
            <p className="font-mono text-xs font-bold">{report.priceDispersion.standardDeviation}</p>
          </div>
        </div>
        <p className="font-mono text-[10px] opacity-100 leading-relaxed">{report.priceDispersion.interpretation}</p>
        {report.priceDispersion.outliers.length > 0 && (
          <div className="mt-2 space-y-1">
            {report.priceDispersion.outliers.map((o, i) => (
              <p key={i} className="font-mono text-[9px] text-yellow-400/70">
                ⚠ {o}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Market Health */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9px] uppercase opacity-100">MARKET HEALTH</p>
          <p className="font-mono text-sm font-bold">{report.marketHealthScore}/100</p>
        </div>
        <HealthBar score={report.marketHealthScore} />
      </div>

      {/* Winner Justification */}
      <div className="p-4 border-b border-white/10">
        <p className="font-mono text-[9px] uppercase opacity-100 mb-2">WINNER JUSTIFICATION</p>
        <p className="font-mono text-[10px] opacity-100 leading-relaxed">{report.winnerJustification}</p>
      </div>

      {/* Reveal Behavior */}
      <div className="p-4 border-b border-white/10">
        <p className="font-mono text-[9px] uppercase opacity-100 mb-2">REVEAL BEHAVIOR</p>
        <p className="font-mono text-[10px] opacity-100 leading-relaxed">{report.revealBehaviorAnalysis}</p>
      </div>

      {/* Recommendations */}
      <div className="p-4 border-b border-white/10">
        <p className="font-mono text-[9px] uppercase opacity-100 mb-3">NEXT CYCLE RECOMMENDATIONS</p>
        <div className="space-y-2">
          {report.nextCycleRecommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono text-[9px] opacity-100 mt-0.5">{i + 1}.</span>
              <p className="font-mono text-[10px] opacity-100 leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Escalation banner */}
      {report.shouldEscalate && (
        <div className="p-4 border-t border-red-400/40 bg-red-400/5">
          <p className="font-mono text-[10px] uppercase text-red-400 font-bold">
            ⚠ ESCALATION RECOMMENDED — REVIEW COLLUSION INDICATORS BEFORE NEXT CYCLE
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 text-center">
        <p className="font-mono text-[8px] uppercase opacity-100">
          DECENTRALIZED INFERENCE VIA 0G COMPUTE • ALL DATA POST-REVEAL ON-CHAIN
        </p>
      </div>
    </div>
  );
}
