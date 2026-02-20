"use client";

import { useEffect, useState } from "react";

interface HealthData {
  status: "ok" | "degraded" | "down";
  providerCount: number;
  latencyMs: number;
  checkedAt: number;
  error?: string;
}

const STATUS_CONFIG = {
  ok: { dot: "bg-green-400", label: "0G ONLINE", textClass: "text-green-400" },
  degraded: { dot: "bg-yellow-400", label: "0G DEGRADED", textClass: "text-yellow-400" },
  down: { dot: "bg-red-400", label: "0G OFFLINE", textClass: "text-red-400" },
};

export function OGStatusWidget() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/ai/health");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ status: "down", providerCount: 0, latencyMs: 0, checkedAt: Date.now() });
    } finally {
      setChecking(false);
    }
  };

  // Check on mount then every 2 minutes
  useEffect(() => {
    check();
    const interval = setInterval(check, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const cfg = health ? STATUS_CONFIG[health.status] : null;

  return (
    <div
      className="flex items-center gap-1.5 cursor-pointer group"
      onClick={check}
      title={
        health
          ? `${health.providerCount} providers — ${health.latencyMs}ms${health.error ? ` — ${health.error}` : ""}`
          : "Checking..."
      }
    >
      {checking || !health ? (
        <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
      ) : (
        <span className={`w-2 h-2 rounded-full ${cfg!.dot} animate-pulse`} />
      )}
      <span className={`font-mono text-[9px] tracking-[0.1em] ${cfg ? cfg.textClass : "opacity-100"}`}>
        {checking ? "..." : cfg ? cfg.label : "0G ..."}
      </span>
      {health?.status === "ok" && (
        <span className="font-mono text-[8px] opacity-0 group-hover:opacity-30 transition-opacity">
          {health.latencyMs}ms · {health.providerCount}p
        </span>
      )}
    </div>
  );
}
