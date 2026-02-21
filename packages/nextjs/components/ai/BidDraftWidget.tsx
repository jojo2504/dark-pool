"use client";

import { useState } from "react";

interface BidDraft {
  draftText: string;
  toneAnalysis: string;
  suggestedKeywords: string[];
  confidenceLevel: "low" | "medium" | "high";
  isFallback?: boolean;
}

interface BidDraftWidgetProps {
  auctionTitle: string;
  auctionDescription: string;
  providerPrice: number;
}

export function BidDraftWidget({ auctionTitle, auctionDescription, providerPrice }: BidDraftWidgetProps) {
  const [strengths, setStrengths] = useState("");
  const [draft, setDraft] = useState<BidDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generateDraft() {
    if (!strengths.trim() || providerPrice <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/bid-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionTitle, auctionDescription, providerPrice, providerStrengths: strengths }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { draft: result } = await res.json();
      setDraft(result);
    } catch (e: any) {
      setError(e.message || "Draft generation failed");
    } finally {
      setLoading(false);
    }
  }

  function copyDraft() {
    if (!draft?.draftText) return;
    navigator.clipboard?.writeText(draft.draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-white p-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-100 mb-4">AI BID DRAFT ASSISTANT</p>

      {draft?.isFallback && (
        <div className="border border-yellow-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-yellow-400">
            📡 OFFLINE MODE — TEMPLATE-BASED DRAFT (NO AI).
          </p>
        </div>
      )}

      <div className="mb-4">
        <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/80 block mb-2">
          YOUR KEY STRENGTHS
        </label>
        <textarea
          value={strengths}
          onChange={e => setStrengths(e.target.value)}
          rows={2}
          placeholder="E.G. 10 YEARS EXPERIENCE, ISO 9001, FAST DELIVERY..."
          className="w-full px-4 py-3 bg-black/80 border border-white/30 font-mono text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white transition-all resize-none"
        />
      </div>

      <button
        onClick={generateDraft}
        disabled={loading || !strengths.trim() || providerPrice <= 0}
        className="w-full border border-white px-4 py-3 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-60 transition-all disabled:opacity-20 mb-4"
      >
        {loading ? "GENERATING..." : draft ? "RE-GENERATE DRAFT" : "GENERATE BID DRAFT"}
      </button>

      {error && (
        <div className="border border-red-400/40 p-3 mb-4">
          <p className="font-mono text-[9px] uppercase text-red-400">{error}</p>
        </div>
      )}

      {draft && (
        <div className="space-y-0">
          <div className="border border-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase opacity-100">GENERATED DRAFT</p>
              <button
                onClick={copyDraft}
                className="font-mono text-[9px] uppercase border border-white/30 px-2 py-1 hover:opacity-60 transition-all"
              >
                {copied ? "COPIED ✓" : "COPY"}
              </button>
            </div>
            <p className="font-mono text-[10px] opacity-80 leading-relaxed whitespace-pre-wrap">{draft.draftText}</p>
          </div>

          <div className="grid grid-cols-2 gap-0">
            <div className="border border-white border-t-0 p-3">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">TONE</p>
              <p className="font-mono text-xs font-bold uppercase">{draft.toneAnalysis}</p>
            </div>
            <div className="border border-white border-t-0 border-l-0 p-3">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-1">CONFIDENCE</p>
              <p className="font-mono text-xs font-bold uppercase">{draft.confidenceLevel}</p>
            </div>
          </div>

          {draft.suggestedKeywords.length > 0 && (
            <div className="border border-white border-t-0 p-3">
              <p className="font-mono text-[8px] uppercase opacity-100 mb-2">SUGGESTED KEYWORDS</p>
              <div className="flex flex-wrap gap-1">
                {draft.suggestedKeywords.map((kw, i) => (
                  <span key={i} className="font-mono text-[9px] uppercase border border-white/30 px-2 py-0.5">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
