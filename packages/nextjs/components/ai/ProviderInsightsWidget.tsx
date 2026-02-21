"use client";

import { useState } from "react";

interface ProviderInsights {
  winRate: number;
  avgPriceVsMedian: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  trendDirection: "improving" | "declining" | "stable";
  isFallback?: boolean;
}

interface ProviderInsightsWidgetProps {
  providerAddress: string;
  bidHistory: Array<{ price: number; won: boolean; auctionTitle: string }>;
}

const TREND_STYLE: Record<string, { label: string; color: string }> = {
  improving: { label: "↑ IMPROVING", color: "text-green-400" },
  declining: { label: "↓ DECLINING", color: "text-red-400" },
  stable: { label: "→ STABLE", color: "text-white/60" },
};

export function ProviderInsightsWidget({ providerAddress, bidHistory }: ProviderInsightsWidgetProps) {
  const [insights, setInsights] = useState<ProviderInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsights() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/provider-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAddress, bidHistory }),
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
      setInsights(data.insights);
    } catch (e: any) {
      setError(e.message || "Insights generation failed");
    } finally {
      setLoading(false);
    }
  }

  const trend = insights ? TREND_STYLE[insights.trendDirection] || TREND_STYLE.stable : null;

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI PERFORMANCE INSIGHTS</p>

      {insights?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">📡 OFFLINE MODE — STATISTICAL ANALYSIS ONLY.</p>
        </div>
      )}

      {bidHistory.length === 0 ? (
        <div className="border border-white/20 p-4 text-center">
          <p className="font-mono text-[10px] uppercase opacity-40">NO BID HISTORY AVAILABLE</p>
        </div>
      ) : (
        <>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
          >
            {loading ? "ANALYZING..." : insights ? "REFRESH INSIGHTS" : "ANALYZE MY PERFORMANCE"}
          </button>

          {error && (
            <div className="border border-red-400/40 p-3 mb-4">
              <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
            </div>
          )}

          {insights && (
            <div className="space-y-0">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-0">
                <div className="border border-white p-3 text-center">
                  <p className="font-mono text-[8px] uppercase opacity-100 mb-1">WIN RATE</p>
                  <p className="font-mono text-sm font-bold">{insights.winRate}%</p>
                </div>
                <div className="border border-white border-l-0 p-3 text-center">
                  <p className="font-mono text-[8px] uppercase opacity-100 mb-1">TREND</p>
                  <p className={`font-mono text-xs font-bold ${trend?.color}`}>{trend?.label}</p>
                </div>
                <div className="border border-white border-l-0 p-3 text-center">
                  <p className="font-mono text-[8px] uppercase opacity-100 mb-1">VS MEDIAN</p>
                  <p className="font-mono text-sm font-bold">
                    {insights.avgPriceVsMedian > 0 ? "+" : ""}
                    {insights.avgPriceVsMedian}%
                  </p>
                </div>
              </div>

              {/* Strengths */}
              <div className="border border-white border-t-0 p-4">
                <p className="font-mono text-[9px] uppercase text-green-400 mb-2">STRENGTHS</p>
                <ul className="space-y-1">
                  {insights.strengths.map((s, i) => (
                    <li key={i} className="font-mono text-[10px] opacity-80 flex gap-2">
                      <span className="text-green-400">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="border border-white border-t-0 p-4">
                <p className="font-mono text-[9px] uppercase text-red-400/80 mb-2">AREAS TO IMPROVE</p>
                <ul className="space-y-1">
                  {insights.weaknesses.map((w, i) => (
                    <li key={i} className="font-mono text-[10px] opacity-80 flex gap-2">
                      <span className="text-red-400">✗</span> {w}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="border border-white border-t-0 p-4">
                <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RECOMMENDATIONS</p>
                <ul className="space-y-1">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="font-mono text-[10px] opacity-80 flex gap-2">
                      <span className="opacity-40">{i + 1}.</span> {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* History summary */}
              <div className="border border-white border-t-0 p-3 text-center">
                <p className="font-mono text-[8px] uppercase opacity-100">
                  BASED ON {bidHistory.length} BID{bidHistory.length > 1 ? "S" : ""} • DECENTRALIZED INFERENCE VIA 0G
                  COMPUTE
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
