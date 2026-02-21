import { NextRequest, NextResponse } from "next/server";
import { ensureLedgerFunded, getBroker, runInference } from "~~/services/og/broker";

interface RevealedBid {
  price: number;
  conditions: string;
  bidderAddress: string;
}

interface BidScoringRequest {
  auctionTitle: string;
  auctionDescription: string;
  revealedBids: RevealedBid[];
}

function buildFallbackScoring(body: BidScoringRequest) {
  const { revealedBids } = body;
  const prices = revealedBids.map(b => b.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const scoredBids = revealedBids.map(b => {
    const priceScore = Math.round(((maxPrice - b.price) / range) * 100);
    const qualityScore = Math.min(100, Math.round(b.conditions.length / 2));
    const overallScore = Math.round(priceScore * 0.6 + qualityScore * 0.4);
    return {
      bidderAddress: b.bidderAddress,
      priceScore,
      qualityScore,
      overallScore,
      reasoning: `Price-based ranking. ${b.price === minPrice ? "Lowest price." : `${(((b.price - minPrice) / minPrice) * 100).toFixed(1)}% above lowest.`}`,
    };
  });

  scoredBids.sort((a, b) => b.overallScore - a.overallScore);
  const bestBid = scoredBids[0];

  return {
    scoredBids,
    bestValueBid: bestBid?.bidderAddress || "",
    recommendation: `Based on price-weighted scoring (60% price, 40% quality), ${bestBid?.bidderAddress.slice(0, 10)}... offers the best value.`,
    isFallback: true,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BidScoringRequest;
  const { auctionTitle, auctionDescription, revealedBids } = body;

  if (!revealedBids || revealedBids.length < 2) {
    return NextResponse.json({ error: "Minimum 2 revealed bids required for scoring" }, { status: 400 });
  }

  try {
    const broker = await getBroker();
    await ensureLedgerFunded(broker);

    const systemPrompt = `You are a procurement evaluation expert for sealed-bid RWA auctions.
You score revealed bids across multiple criteria to help buyers make informed decisions.
All bids have been publicly revealed on-chain. Your analysis must be fair and objective.
You respond ONLY in valid JSON, no markdown, no backticks.`;

    const anonymizedBids = revealedBids.map((b, i) => ({
      id: `Bidder_${i + 1}`,
      address: b.bidderAddress,
      price: b.price,
      conditions: b.conditions,
    }));

    const userPrompt = `
Score these revealed bids for auction "${auctionTitle}":
Description: "${auctionDescription}"

BIDS:
${anonymizedBids.map(b => `- ${b.id} (${b.address.slice(0, 10)}...): Price = ${b.price} ADI | Conditions: "${b.conditions}"`).join("\n")}

Score each bid on: price competitiveness (0-100), quality/conditions (0-100), overall (0-100).

Return ONLY this JSON (no markdown):
{
  "scoredBids": [
    {
      "bidderAddress": "<full address>",
      "priceScore": <0-100>,
      "qualityScore": <0-100>,
      "overallScore": <0-100>,
      "reasoning": "<1-2 sentences>"
    }
  ],
  "bestValueBid": "<address of best overall bid>",
  "recommendation": "<2-3 sentences of buyer recommendation>"
}`.trim();

    const rawResponse = await runInference(broker, systemPrompt, userPrompt, 900);

    let scoring;
    try {
      const cleaned = rawResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      scoring = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI response not parseable", raw: rawResponse }, { status: 502 });
    }

    return NextResponse.json({ scoring, source: "0g-compute" });
  } catch (ogError: any) {
    console.warn("[0G Unavailable] Bid scoring fallback:", ogError.message);
    const fallbackScoring = buildFallbackScoring(body);
    return NextResponse.json({
      scoring: fallbackScoring,
      source: "statistical-fallback",
      fallbackReason: ogError.message,
    });
  }
}
