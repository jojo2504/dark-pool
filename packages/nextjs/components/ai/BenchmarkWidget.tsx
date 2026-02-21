"use client";

import { useState } from "react";

interface BenchmarkResult {
  avgWinningPrice: number;
  avgBidCount: number;
  priceRange: { min: number; max: number };
  trendDirection: "rising" | "falling" | "stable" | "insufficient_data";
  sectorInsights: string;
  recommendations: string[];
  isFallback?: boolean;
}

interface BenchmarkWidgetProps {
  category: string;
  recentAuctions: Array<{ title: string; winningPrice: number; bidCount: number; duration: number }>;
}

const TREND_STYLE: Record<string, { label: string; color: string }> = {
  rising: { label: "↑ RISING", color: "text-red-400" },
  falling: { label: "↓ FALLING", color: "text-green-400" },
  stable: { label: "→ STABLE", color: "text-white/60" },
  insufficient_data: { label: "? NO DATA", color: "text-white/30" },
};

export function BenchmarkWidget({ category, recentAuctions }: BenchmarkWidgetProps) {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchBenchmark() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, recentAuctions }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { benchmark } = await res.json();
      setResult(benchmark);
    } catch (e: any) {
      setError(e.message || "Benchmark generation failed");
    } finally {
      setLoading(false);
    }
  }

  const trend = result ? TREND_STYLE[result.trendDirection] || TREND_STYLE.stable : null;

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">
        AI MARKET BENCHMARK — {category.toUpperCase()}
      </p>

      {result?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">📡 OFFLINE MODE — STATISTICAL AVERAGES ONLY.</p>
        </div>
      )}

      <button
        onClick={fetchBenchmark}
        disabled={loading}
        className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
      >
        {loading ? "GENERATING..." : result ? "REFRESH BENCHMARK" : "GENERATE BENCHMARK"}
      </button>

      {error && (
        <div className="border border-red-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-0">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-0">
            <div className="border border-white p-3 text-center">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">AVG PRICE</p>
              <p className="font-mono text-sm font-bold">{result.avgWinningPrice}</p>
              <p className="font-mono text-[8px] opacity-40">ADI</p>
            </div>
            <div className="border border-white border-l-0 p-3 text-center">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">AVG BIDS</p>
              <p className="font-mono text-sm font-bold">{result.avgBidCount}</p>
            </div>
            <div className="border border-white border-l-0 p-3 text-center">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">RANGE</p>
              <p className="font-mono text-[10px] font-bold">
                {result.priceRange.min}–{result.priceRange.max}
              </p>
            </div>
            <div className="border border-white border-l-0 p-3 text-center">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">TREND</p>
              <p className={`font-mono text-xs font-bold ${trend?.color}`}>{trend?.label}</p>
            </div>
          </div>

          {/* Insights */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">SECTOR INSIGHTS</p>
            <p className="font-mono text-[10px] opacity-80 leading-relaxed">{result.sectorInsights}</p>
          </div>

          {/* Recommendations */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RECOMMENDATIONS</p>
            <ul className="space-y-1">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="font-mono text-[10px] opacity-80 flex gap-2">
                  <span className="opacity-40">{i + 1}.</span> {rec}
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-white border-t-0 p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100">
              {recentAuctions.length} AUCTION{recentAuctions.length !== 1 ? "S" : ""} ANALYZED • DECENTRALIZED INFERENCE
              VIA 0G COMPUTE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
