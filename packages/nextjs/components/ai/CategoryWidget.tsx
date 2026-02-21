"use client";

import { useState } from "react";

interface Categorization {
  primaryCategory: string;
  secondaryCategories: string[];
  tags: string[];
  confidence: number;
  isFallback?: boolean;
}

interface CategoryWidgetProps {
  title: string;
  description: string;
}

export function CategoryWidget({ title, description }: CategoryWidgetProps) {
  const [result, setResult] = useState<Categorization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function categorize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { categorization } = await res.json();
      setResult(categorization);
    } catch (e: any) {
      setError(e.message || "Categorization failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-white border-t-0 p-4">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60">AI CATEGORY</p>

        {!result && !loading && (
          <button
            onClick={categorize}
            className="font-mono text-[9px] uppercase border border-white/30 px-2 py-0.5 hover:opacity-60 transition-all"
          >
            CLASSIFY
          </button>
        )}

        {loading && <span className="font-mono text-[9px] uppercase opacity-40">CLASSIFYING...</span>}

        {error && <span className="font-mono text-[9px] uppercase text-red-400">{error}</span>}

        {result && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[9px] uppercase border border-white px-2 py-0.5 font-bold">
              {result.primaryCategory}
            </span>
            {result.secondaryCategories.map((cat, i) => (
              <span key={i} className="font-mono text-[9px] uppercase border border-white/30 px-2 py-0.5">
                {cat}
              </span>
            ))}
            {result.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="font-mono text-[8px] uppercase text-white/40 px-1">
                #{tag}
              </span>
            ))}
            <span className="font-mono text-[8px] uppercase opacity-30">
              {Math.round(result.confidence * 100)}%{result.isFallback ? " • OFFLINE" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
