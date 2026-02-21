import { NextRequest, NextResponse } from "next/server";
import { ensureLedgerFunded, getBroker, runInference } from "~~/services/og/broker";

interface LowBidDetectRequest {
  revealedBids: Array<{ price: number; conditions: string }>;
  marketContext: { title: string; description: string };
}

function buildFallbackDetection(body: LowBidDetectRequest) {
  const prices = body.revealedBids.map(b => b.price);
  const n = prices.length;
  const avg = prices.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(prices.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) / n);

  const alerts = body.revealedBids
    .map((b, i) => {
      const zScore = stdDev > 0 ? (avg - b.price) / stdDev : 0;
      if (zScore > 1.5) {
        return {
          bidderIndex: i,
          price: b.price,
          reason: `Price is ${zScore.toFixed(1)} standard deviations below the mean (${avg.toFixed(2)} ADI). Z-score threshold: 1.5.`,
          severity: (zScore > 2.5 ? "critical" : zScore > 2 ? "high" : "medium") as "critical" | "high" | "medium",
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ bidderIndex: number; price: number; reason: string; severity: string }>;

  return {
    alerts,
    overallRisk: alerts.some(a => a.severity === "critical") ? "high" : alerts.length > 0 ? "medium" : "low",
    recommendation:
      alerts.length > 0
        ? "Review flagged bids carefully — abnormally low prices may indicate misunderstanding of scope or predatory pricing."
        : "No abnormally low bids detected. Price distribution appears normal.",
    isFallback: true,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LowBidDetectRequest;
  const { revealedBids, marketContext } = body;

  if (!revealedBids || revealedBids.length < 2) {
    return NextResponse.json({ error: "Minimum 2 revealed bids required for detection" }, { status: 400 });
  }

  try {
    const broker = await getBroker();
    await ensureLedgerFunded(broker);

    const systemPrompt = `You are a procurement risk analyst specializing in detecting abnormally low bids in sealed auctions.
You flag bids that may indicate predatory pricing, scope misunderstanding, or non-viable offers.
All bids are publicly revealed on-chain. Your analysis must be objective and fact-based.
You respond ONLY in valid JSON, no markdown, no backticks.`;

    const prices = revealedBids.map(b => b.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    const userPrompt = `
Detect abnormally low bids in this auction:

CONTEXT: "${marketContext.title}" — "${marketContext.description}"
AVERAGE BID PRICE: ${avg.toFixed(2)} ADI

BIDS:
${revealedBids.map((b, i) => `- Bidder ${i + 1}: ${b.price} ADI | Conditions: "${b.conditions}"`).join("\n")}

Flag any bids that are suspiciously low. Consider price relative to average, conditions offered, and market context.

Return ONLY this JSON (no markdown):
{
  "alerts": [
    {
      "bidderIndex": <0-based index>,
      "price": <number>,
      "reason": "<why this bid is flagged>",
      "severity": "<low|medium|high|critical>"
    }
  ],
  "overallRisk": "<low|medium|high>",
  "recommendation": "<2-3 sentences for the buyer>"
}`.trim();

    const rawResponse = await runInference(broker, systemPrompt, userPrompt, 700);

    let detection;
    try {
      const cleaned = rawResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      detection = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI response not parseable", raw: rawResponse }, { status: 502 });
    }

    return NextResponse.json({ detection, source: "0g-compute" });
  } catch (ogError: any) {
    console.warn("[0G Unavailable] Low bid detection fallback:", ogError.message);
    const fallbackDetection = buildFallbackDetection(body);
    return NextResponse.json({
      detection: fallbackDetection,
      source: "statistical-fallback",
      fallbackReason: ogError.message,
    });
  }
}
