"use client";

import { useState } from "react";

interface LotAnalysis {
  keyRequirements: string[];
  riskFactors: string[];
  recommendedStrategy: string;
  complexityScore: number;
  idealProfileDescription: string;
  isFallback?: boolean;
}

interface LotAnalysisWidgetProps {
  auctionTitle: string;
  auctionDescription: string;
  depositRequired: string;
  closeTime: number;
}

const COMPLEXITY_COLOR: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

function complexityLabel(score: number): { label: string; color: string } {
  if (score <= 3) return { label: "LOW", color: COMPLEXITY_COLOR.low };
  if (score <= 6) return { label: "MEDIUM", color: COMPLEXITY_COLOR.medium };
  return { label: "HIGH", color: COMPLEXITY_COLOR.high };
}

export function LotAnalysisWidget({
  auctionTitle,
  auctionDescription,
  depositRequired,
  closeTime,
}: LotAnalysisWidgetProps) {
  const [analysis, setAnalysis] = useState<LotAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/lot-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionTitle, auctionDescription, depositRequired, closeTime }),
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
      setAnalysis(data.analysis);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const cx = analysis ? complexityLabel(analysis.complexityScore) : null;

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI LOT ANALYSIS</p>

      {analysis?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">
            📡 OFFLINE MODE — KEYWORD-BASED ANALYSIS (NO AI).
          </p>
        </div>
      )}

      <button
        onClick={runAnalysis}
        disabled={loading}
        className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
      >
        {loading ? "ANALYZING..." : analysis ? "RE-ANALYZE LOT" : "ANALYZE THIS LOT"}
      </button>

      {error && (
        <div className="border border-red-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-0">
          {/* Complexity score */}
          <div className="border border-white p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100 mb-1">COMPLEXITY</p>
            <p className={`font-mono text-lg font-bold ${cx?.color}`}>
              {analysis.complexityScore}/10 <span className="text-xs">({cx?.label})</span>
            </p>
          </div>

          {/* Key requirements */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">KEY REQUIREMENTS</p>
            <ul className="space-y-1">
              {analysis.keyRequirements.map((req, i) => (
                <li key={i} className="font-mono text-[10px] opacity-80 flex gap-2">
                  <span className="opacity-40">•</span> {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Risk factors */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RISK FACTORS</p>
            <ul className="space-y-1">
              {analysis.riskFactors.map((risk, i) => (
                <li key={i} className="font-mono text-[10px] text-yellow-400/80 flex gap-2">
                  <span>⚠</span> {risk}
                </li>
              ))}
            </ul>
          </div>

          {/* Strategy */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RECOMMENDED STRATEGY</p>
            <p className="font-mono text-[10px] opacity-80 leading-relaxed">{analysis.recommendedStrategy}</p>
          </div>

          {/* Ideal profile */}
          <div className="border border-white border-t-0 p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100 mb-1">IDEAL BIDDER PROFILE</p>
            <p className="font-mono text-[10px] opacity-60">{analysis.idealProfileDescription}</p>
          </div>
        </div>
      )}
    </div>
  );
}
