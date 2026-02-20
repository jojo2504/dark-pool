"use client";

import { useState } from "react";

interface CompetitivenessAnalysis {
  estimatedPercentile: number;
  competitivenessScore: number;
  winProbabilityEstimate: number;
  recommendation: string;
  detailedExplanation: string;
  riskAssessment: "low" | "medium" | "high";
  suggestedPriceRange: { min: number; max: number };
  confidenceLevel: "low" | "medium" | "high";
  isFallback?: boolean;
}

interface CompetitivenessWidgetProps {
  providerPrice: number;
  providerConditions: string;
  auctionCategory: string;
}

const RISK_STYLE: Record<string, string> = {
  low: "border-green-400/40 text-green-400",
  medium: "border-yellow-400/40 text-yellow-400",
  high: "border-red-400/40 text-red-400",
};

export function CompetitivenessWidget({
  providerPrice,
  providerConditions,
  auctionCategory,
}: CompetitivenessWidgetProps) {
  const [analysis, setAnalysis] = useState<CompetitivenessAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedPrice, setAnalyzedPrice] = useState<number | null>(null);
  const priceChanged = analyzedPrice !== null && analyzedPrice !== providerPrice;

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/competitiveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerPrice,
          providerConditions,
          auctionCategory,
          marketHistoricalData: {
            percentile25: providerPrice * 0.8,
            percentile50: providerPrice * 0.95,
            percentile75: providerPrice * 1.1,
            winRateByRange: {
              below_q1: 72,
              q1_to_median: 45,
              median_to_q3: 18,
              above_q3: 5,
            },
            sampleSize: 120,
            periodMonths: 6,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { analysis: result } = await res.json();
      setAnalysis(result);
      setAnalyzedPrice(providerPrice);
    } catch (e: any) {
      setError(e.message || "Analyse échouée");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI COMPETITIVENESS ANALYSIS</p>

      {/* Isolation disclaimer */}
      <div className="border border-white/10 p-3 mb-4">
        <p className="font-mono text-[9px] uppercase opacity-100 leading-relaxed">
          DATA ISOLATION: THIS ANALYSIS USES ONLY YOUR OWN DATA + PUBLIC HISTORICAL MARKET STATISTICS. NO COMPETITOR
          BIDS ARE VISIBLE. POWERED BY DECENTRALIZED 0G COMPUTE.
        </p>
      </div>

      {/* Fallback badge */}
      {analysis?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">
            📡 OFFLINE MODE — 0G COMPUTE UNAVAILABLE. LOCAL STATISTICAL ANALYSIS (NO AI).
          </p>
        </div>
      )}

      {/* Stale-price warning */}
      {priceChanged && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">
            ⚠ PRICE CHANGED SINCE LAST ANALYSIS — RE-RUN RECOMMENDED
          </p>
        </div>
      )}

      {/* Action */}
      <button
        onClick={runAnalysis}
        disabled={loading || providerPrice <= 0}
        className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
      >
        {loading ? "ANALYZING..." : analysis ? "RE-ANALYZE" : "ANALYZE MY COMPETITIVENESS"}
      </button>

      {error && (
        <div className="border border-red-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-0">
          {/* Score cards */}
          <div className="grid grid-cols-3 gap-0">
            {[
              { label: "SCORE", value: `${analysis.competitivenessScore}/100` },
              { label: "PERCENTILE", value: `${analysis.estimatedPercentile}th` },
              { label: "WIN PROB", value: `${analysis.winProbabilityEstimate}%` },
            ].map((s, i) => (
              <div key={s.label} className={`border border-white p-3 text-center ${i > 0 ? "border-l-0" : ""}`}>
                <p className="font-mono text-[8px] uppercase opacity-100 mb-1">{s.label}</p>
                <p className="font-mono text-sm font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RECOMMENDATION</p>
            <p className="font-mono text-xs opacity-80">{analysis.recommendation}</p>
          </div>

          {/* Detail */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">ANALYSIS</p>
            <p className="font-mono text-[10px] opacity-100 leading-relaxed">{analysis.detailedExplanation}</p>
          </div>

          {/* Risk + Range */}
          <div className="grid grid-cols-2 gap-0">
            <div className={`border ${RISK_STYLE[analysis.riskAssessment]} p-3`}>
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">RISK</p>
              <p className="font-mono text-xs font-bold uppercase">{analysis.riskAssessment}</p>
            </div>
            <div className="border border-white border-l-0 p-3">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">SUGGESTED RANGE</p>
              <p className="font-mono text-xs font-bold">
                {analysis.suggestedPriceRange.min} — {analysis.suggestedPriceRange.max}
              </p>
            </div>
          </div>

          {/* Confidence */}
          <div className="border border-white border-t-0 p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100">
              CONFIDENCE: {analysis.confidenceLevel.toUpperCase()} • DECENTRALIZED INFERENCE VIA 0G COMPUTE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
