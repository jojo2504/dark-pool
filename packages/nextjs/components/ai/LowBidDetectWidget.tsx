"use client";

import { useState } from "react";

interface LowBidAlert {
  bidderIndex: number;
  price: number;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface LowBidDetectionResult {
  alerts: LowBidAlert[];
  overallRisk: "low" | "medium" | "high";
  recommendation: string;
  isFallback?: boolean;
}

interface LowBidDetectWidgetProps {
  auctionTitle: string;
  auctionDescription: string;
  revealedBids: Array<{ price: number; conditions: string }>;
}

const SEVERITY_STYLE: Record<string, string> = {
  low: "border-yellow-400/30 text-yellow-400",
  medium: "border-yellow-400/40 text-yellow-400",
  high: "border-red-400/40 text-red-400",
  critical: "border-red-500/60 text-red-500 bg-red-500/5",
};

const RISK_STYLE: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

export function LowBidDetectWidget({ auctionTitle, auctionDescription, revealedBids }: LowBidDetectWidgetProps) {
  const [result, setResult] = useState<LowBidDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDetection() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/low-bid-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revealedBids,
          marketContext: { title: auctionTitle, description: auctionDescription },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { detection } = await res.json();
      setResult(detection);
    } catch (e: any) {
      setError(e.message || "Detection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI LOW BID DETECTION</p>

      {result?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">📡 OFFLINE MODE — Z-SCORE DETECTION ONLY.</p>
        </div>
      )}

      <button
        onClick={runDetection}
        disabled={loading || revealedBids.length < 2}
        className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
      >
        {loading ? "SCANNING..." : result ? "RE-SCAN BIDS" : "SCAN FOR LOW BIDS"}
      </button>

      {error && (
        <div className="border border-red-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-0">
          {/* Overall risk */}
          <div className="border border-white p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100 mb-1">OVERALL RISK</p>
            <p className={`font-mono text-lg font-bold uppercase ${RISK_STYLE[result.overallRisk]}`}>
              {result.overallRisk}
            </p>
          </div>

          {/* Alerts */}
          {result.alerts.length > 0 ? (
            <div className="border border-white border-t-0 p-4">
              <p className="font-mono text-[9px] uppercase opacity-100 mb-3">FLAGGED BIDS ({result.alerts.length})</p>
              <div className="space-y-2">
                {result.alerts.map((alert, i) => (
                  <div key={i} className={`border p-3 ${SEVERITY_STYLE[alert.severity]}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[9px] uppercase font-bold">
                        BIDDER #{alert.bidderIndex + 1} — {alert.price} ADI
                      </span>
                      <span className="font-mono text-[8px] uppercase border px-1 py-0.5 border-current">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="font-mono text-[9px] opacity-80">{alert.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-white border-t-0 p-4 text-center">
              <p className="font-mono text-[10px] uppercase text-green-400">✓ NO ABNORMALLY LOW BIDS DETECTED</p>
            </div>
          )}

          {/* Recommendation */}
          <div className="border border-white border-t-0 p-4">
            <p className="font-mono text-[9px] uppercase opacity-100 mb-2">RECOMMENDATION</p>
            <p className="font-mono text-[10px] opacity-80 leading-relaxed">{result.recommendation}</p>
          </div>

          <div className="border border-white border-t-0 p-3 text-center">
            <p className="font-mono text-[8px] uppercase opacity-100">
              ANOMALY DETECTION • DECENTRALIZED INFERENCE VIA 0G COMPUTE
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
