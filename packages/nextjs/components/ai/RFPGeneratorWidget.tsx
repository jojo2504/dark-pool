"use client";

import { useState } from "react";

interface RFPResult {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedDuration: number;
  suggestedDeposit: string;
  keyTerms: string[];
  isFallback?: boolean;
}

interface RFPGeneratorWidgetProps {
  onApply?: (rfp: RFPResult) => void;
}

export function RFPGeneratorWidget({ onApply }: RFPGeneratorWidgetProps) {
  const [assetType, setAssetType] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [requirements, setRequirements] = useState("");
  const [timeline, setTimeline] = useState("");
  const [rfp, setRFP] = useState<RFPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function generateRFP() {
    if (!assetType.trim() || !requirements.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/rfp-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, location, budget, requirements, timeline }),
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
      setRFP(data.rfp);
    } catch (e: any) {
      setError(e.message || "RFP generation failed");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 bg-black/80 border border-white/30 font-mono text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white transition-all";

  return (
    <div className="border border-white border-b-0">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase hover:opacity-60 transition-all"
      >
        <span>🤖 AI RFP GENERATOR</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-4">
          {rfp?.isFallback && (
            <div className="border border-yellow-400/40 p-3">
              <p className="font-mono text-[9px] uppercase text-yellow-400">
                📡 OFFLINE MODE — TEMPLATE-BASED GENERATION.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2">
                ASSET TYPE *
              </label>
              <input
                value={assetType}
                onChange={e => setAssetType(e.target.value)}
                placeholder="REAL ESTATE, INFRASTRUCTURE..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2">
                LOCATION
              </label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="DUBAI, ABU DHABI..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2">
                BUDGET (ADI)
              </label>
              <input
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="100"
                className={inputClass}
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2">
                TIMELINE
              </label>
              <input
                value={timeline}
                onChange={e => setTimeline(e.target.value)}
                placeholder="Q3 2026, 6 MONTHS..."
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2">
              REQUIREMENTS *
            </label>
            <textarea
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              rows={2}
              placeholder="DESCRIBE KEY REQUIREMENTS..."
              className={inputClass + " resize-none"}
            />
          </div>

          <button
            onClick={generateRFP}
            disabled={loading || !assetType.trim() || !requirements.trim()}
            className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20"
          >
            {loading ? "GENERATING..." : rfp ? "RE-GENERATE RFP" : "GENERATE RFP"}
          </button>

          {error && (
            <div className="border border-red-400/40 p-3">
              <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
            </div>
          )}

          {rfp && (
            <div className="space-y-0">
              <div className="border border-white p-4">
                <p className="font-mono text-[9px] uppercase opacity-100 mb-2">SUGGESTED TITLE</p>
                <p className="font-mono text-xs font-bold">{rfp.suggestedTitle}</p>
              </div>
              <div className="border border-white border-t-0 p-4">
                <p className="font-mono text-[9px] uppercase opacity-100 mb-2">SUGGESTED DESCRIPTION</p>
                <p className="font-mono text-[10px] opacity-80 leading-relaxed whitespace-pre-wrap">
                  {rfp.suggestedDescription}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="border border-white border-t-0 p-3">
                  <p className="font-mono text-[8px] uppercase opacity-100 mb-1">DURATION</p>
                  <p className="font-mono text-xs font-bold">{rfp.suggestedDuration}H</p>
                </div>
                <div className="border border-white border-t-0 border-l-0 p-3">
                  <p className="font-mono text-[8px] uppercase opacity-100 mb-1">DEPOSIT</p>
                  <p className="font-mono text-xs font-bold">{rfp.suggestedDeposit} ADI</p>
                </div>
              </div>
              {rfp.keyTerms.length > 0 && (
                <div className="border border-white border-t-0 p-3">
                  <p className="font-mono text-[8px] uppercase opacity-100 mb-2">KEY TERMS</p>
                  <div className="flex flex-wrap gap-1">
                    {rfp.keyTerms.map((term, i) => (
                      <span key={i} className="font-mono text-[9px] uppercase border border-white/30 px-2 py-0.5">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {onApply && (
                <button
                  onClick={() => onApply(rfp)}
                  className="w-full border border-white border-t-0 bg-white text-black px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase font-bold hover:opacity-80 transition-all"
                >
                  APPLY TO FORM
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
