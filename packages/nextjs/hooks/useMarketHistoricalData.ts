import { useCallback, useEffect, useMemo, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ABI, VAULT_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS } from "~~/lib/darkpool-config";
import { VaultPhase } from "~~/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketData {
  percentile25: number;
  percentile50: number;
  percentile75: number;
  winRateByRange: {
    below_q1: number;
    q1_to_median: number;
    median_to_q3: number;
    above_q3: number;
  };
  sampleSize: number;
  periodMonths: number;
}

interface UseMarketHistoricalDataReturn {
  marketData: MarketData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─── In-memory cache — TTL 10 minutes ─────────────────────────────────────────

const CACHE: Record<string, { data: MarketData; expiresAt: number }> = {};
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Hook that aggregates historical winning prices from all settled vaults
 * and computes Q1/median/Q3 percentiles for the CompetitivenessWidget.
 *
 * Since ShadowBid contracts don't have categories, this aggregates ALL
 * settled auctions as market data.
 */
export function useMarketHistoricalData(periodMonths = 12): UseMarketHistoricalDataReturn {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Get all vault addresses from factory
  const {
    data: allVaults,
    isLoading: vaultsLoading,
    refetch: refetchVaults,
  } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllVaults",
  });

  const vaultList = useMemo(() => (allVaults as `0x${string}`[] | undefined) ?? [], [allVaults]);

  // Step 2: Batch-read phase + winningPrice for each vault
  const contracts = useMemo(
    () =>
      vaultList.flatMap(addr => [
        { address: addr, abi: VAULT_ABI, functionName: "getCurrentPhase" as const },
        { address: addr, abi: VAULT_ABI, functionName: "winningPrice" as const },
      ]),
    [vaultList],
  );

  const { data: batchData, isLoading: batchLoading } = useReadContracts({
    contracts,
    query: { enabled: vaultList.length > 0 },
  });

  // Step 3: Compute percentiles from settled vault winning prices
  const computeMarketData = useCallback(() => {
    if (!batchData || batchData.length === 0) return;

    const cacheKey = `all_${periodMonths}`;
    const cached = CACHE[cacheKey];
    if (cached && cached.expiresAt > Date.now()) {
      setMarketData(cached.data);
      setIsLoading(false);
      return;
    }

    const prices: number[] = [];

    for (let i = 0; i < vaultList.length; i++) {
      const phaseResult = batchData[i * 2];
      const priceResult = batchData[i * 2 + 1];

      if (phaseResult.status !== "success" || priceResult.status !== "success") continue;

      const phase = phaseResult.result as number;
      const winPrice = priceResult.result as bigint;

      // Only include settled vaults with an actual winning price
      if (phase === VaultPhase.SETTLED && winPrice > 0n) {
        prices.push(Number(winPrice) / 1e18);
      }
    }

    if (prices.length < 3) {
      // Not enough data — provide reasonable defaults
      const fallback: MarketData = {
        percentile25: 0,
        percentile50: 0,
        percentile75: 0,
        winRateByRange: { below_q1: 70, q1_to_median: 55, median_to_q3: 30, above_q3: 10 },
        sampleSize: prices.length,
        periodMonths,
      };
      setMarketData(fallback);
      setIsLoading(false);
      return;
    }

    prices.sort((a, b) => a - b);
    const n = prices.length;
    const q1 = prices[Math.floor(n * 0.25)];
    const median = prices[Math.floor(n * 0.5)];
    const q3 = prices[Math.floor(n * 0.75)];

    const winRateByRange = {
      below_q1: Math.min(100, Math.round((prices.filter(p => p < q1).length / n) * 100 * 1.4)),
      q1_to_median: Math.min(100, Math.round((prices.filter(p => p >= q1 && p < median).length / n) * 100 * 1.1)),
      median_to_q3: Math.min(100, Math.round((prices.filter(p => p >= median && p < q3).length / n) * 100 * 0.6)),
      above_q3: Math.min(100, Math.round((prices.filter(p => p >= q3).length / n) * 100 * 0.2)),
    };

    const data: MarketData = {
      percentile25: Math.round(q1 * 100) / 100,
      percentile50: Math.round(median * 100) / 100,
      percentile75: Math.round(q3 * 100) / 100,
      winRateByRange,
      sampleSize: n,
      periodMonths,
    };

    CACHE[cacheKey] = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    setMarketData(data);
    setIsLoading(false);
  }, [batchData, vaultList, periodMonths]);

  useEffect(() => {
    if (vaultsLoading || batchLoading) {
      setIsLoading(true);
      return;
    }

    if (vaultList.length === 0) {
      setMarketData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      computeMarketData();
    } catch (e: any) {
      setError(e.message || "Error computing market data");
      setIsLoading(false);
    }
  }, [vaultsLoading, batchLoading, vaultList.length, computeMarketData]);

  return {
    marketData,
    isLoading,
    error,
    refetch: () => {
      // Clear cache and refetch
      delete CACHE[`all_${periodMonths}`];
      refetchVaults();
    },
  };
}
