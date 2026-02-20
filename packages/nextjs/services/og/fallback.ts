/**
 * Fallback statistique pur — utilisé quand 0G Compute est indisponible.
 * Calcule une analyse basée uniquement sur les maths, sans IA.
 */

interface MarketData {
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

export function computeCompetitivenessFallback(price: number, market: MarketData) {
  const { percentile25: q1, percentile50: median, percentile75: q3 } = market;

  // Estimer le percentile par interpolation linéaire
  let estimatedPercentile: number;
  let winRate: number;

  if (price <= q1) {
    estimatedPercentile = Math.round((price / q1) * 25);
    winRate = market.winRateByRange.below_q1;
  } else if (price <= median) {
    estimatedPercentile = 25 + Math.round(((price - q1) / (median - q1)) * 25);
    winRate = market.winRateByRange.q1_to_median;
  } else if (price <= q3) {
    estimatedPercentile = 50 + Math.round(((price - median) / (q3 - median)) * 25);
    winRate = market.winRateByRange.median_to_q3;
  } else {
    estimatedPercentile = Math.min(99, 75 + Math.round(((price - q3) / q3) * 25));
    winRate = market.winRateByRange.above_q3;
  }

  const competitivenessScore = Math.max(0, Math.min(100, 100 - estimatedPercentile));

  let recommendation: string;
  const reductionToMedian = (((price - median) / price) * 100).toFixed(1);
  const reductionToQ1 = (((price - q1) / price) * 100).toFixed(1);

  if (price <= q1) {
    recommendation = `Your price is very competitive — in the lower quartile of the market.`;
  } else if (price <= median) {
    recommendation = `Competitive price. Reducing by ${reductionToQ1}% would reach Q1 (most retained bids).`;
  } else if (price <= q3) {
    recommendation = `Price above median. Reducing by ${reductionToMedian}% would bring you to the historical median.`;
  } else {
    recommendation = `Low competitiveness (>${q3}). Reduce by ${reductionToMedian}% to reach median, or ${reductionToQ1}% for Q1.`;
  }

  return {
    estimatedPercentile,
    competitivenessScore,
    winProbabilityEstimate: Math.round(winRate),
    recommendation,
    detailedExplanation: `Statistical analysis computed locally from ${market.sampleSize} auctions over the last ${market.periodMonths} months. 0G Compute was unavailable at the time of analysis.`,
    riskAssessment: estimatedPercentile > 75 ? "high" : estimatedPercentile > 50 ? "medium" : "low",
    suggestedPriceRange: {
      min: Math.round(q1 * 0.95 * 100) / 100,
      max: Math.round(median * 1.02 * 100) / 100,
    },
    confidenceLevel: market.sampleSize >= 20 ? "medium" : "low",
    isFallback: true,
  };
}

/**
 * Fallback post-reveal — analyse statistique pure sans IA.
 */
export function computePostRevealFallback(bids: Array<{ price: number; conditions: string }>) {
  const prices = bids.map(b => b.price).sort((a, b) => a - b);
  const n = prices.length;
  const min = prices[0];
  const max = prices[n - 1];
  const avg = prices.reduce((a, b) => a + b, 0) / n;
  const spreadPercent = parseFloat((((max - min) / avg) * 100).toFixed(2));
  const stdDev = parseFloat(Math.sqrt(prices.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) / n).toFixed(2));

  const minGap = Math.min(...prices.slice(1).map((p, i) => p - prices[i]));
  const suspiciouslyClose = minGap < avg * 0.005;
  const collusionRisk = suspiciouslyClose ? "medium" : spreadPercent < 5 ? "medium" : "low";

  return {
    collusionRisk,
    collusionIndicators: suspiciouslyClose
      ? [`Two bids separated by less than 0.5% of the average (gap: ${minGap.toFixed(2)})`]
      : [],
    collusionExplanation: suspiciouslyClose
      ? "Very close bids detected. A more detailed AI analysis could not be performed (0G Compute unavailable)."
      : "No obvious suspicious patterns detected in the price distribution.",
    priceDispersion: {
      spreadPercent,
      standardDeviation: stdDev,
      interpretation:
        spreadPercent < 5
          ? "Very low dispersion — unusually clustered bids."
          : spreadPercent < 20
            ? "Normal dispersion for this type of market."
            : "High dispersion — wide variety of pricing approaches.",
      outliers: [],
    },
    winnerJustification: `The lowest bid (${min}) represents a gap of ${(((max - min) / max) * 100).toFixed(1)}% from the highest.`,
    marketHealthScore: Math.min(100, Math.round(50 + spreadPercent * 1.5 - (suspiciouslyClose ? 20 : 0))),
    revealBehaviorAnalysis: "Reveal timing analysis unavailable (offline mode).",
    nextCycleRecommendations: [
      "Increase the number of bidders to improve competition.",
      "Publish aggregated post-auction statistics to inform suppliers.",
      "Re-run the full AI analysis when 0G Compute is available.",
    ],
    shouldEscalate: suspiciouslyClose,
    isFallback: true,
  };
}
