import { NextRequest, NextResponse } from "next/server";
import { ensureLedgerFunded, getBroker, runInference } from "~~/services/og/broker";

interface BidDraftRequest {
  auctionTitle: string;
  auctionDescription: string;
  providerPrice: number;
  providerStrengths: string;
}

function buildFallbackDraft(body: BidDraftRequest) {
  const { auctionTitle, providerPrice, providerStrengths } = body;
  const strengths = providerStrengths
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  return {
    draftText: `Regarding "${auctionTitle}": We propose a competitive offer at ${providerPrice} ADI, leveraging our core strengths: ${strengths.join(", ")}. Our team is committed to delivering high-quality results within the specified timeline.`,
    toneAnalysis: "professional",
    suggestedKeywords: strengths.slice(0, 5),
    confidenceLevel: "low" as const,
    isFallback: true,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BidDraftRequest;
  const { auctionTitle, auctionDescription, providerPrice, providerStrengths } = body;

  if (!auctionTitle || !providerPrice || !providerStrengths) {
    return NextResponse.json(
      { error: "auctionTitle, providerPrice, and providerStrengths are required" },
      { status: 400 },
    );
  }

  try {
    const broker = await getBroker();
    await ensureLedgerFunded(broker);

    const systemPrompt = `You are an expert B2B bid writer for sealed-bid auctions.
You help providers draft compelling, professional bid descriptions based on their strengths and the auction context.
You NEVER fabricate credentials or capabilities the provider hasn't mentioned.
You respond ONLY in valid JSON, no markdown, no backticks.`;

    const userPrompt = `
Draft a professional bid description for this sealed-bid auction:

AUCTION: "${auctionTitle}"
DESCRIPTION: "${auctionDescription}"
PROPOSED PRICE: ${providerPrice} ADI
PROVIDER STRENGTHS: ${providerStrengths}

Return ONLY this JSON (no markdown):
{
  "draftText": "<2-4 paragraph professional bid text>",
  "toneAnalysis": "<formal|professional|technical>",
  "suggestedKeywords": ["<keyword1>", "<keyword2>", ...],
  "confidenceLevel": "<low|medium|high>"
}`.trim();

    const rawResponse = await runInference(broker, systemPrompt, userPrompt, 800);

    let draft;
    try {
      const cleaned = rawResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      draft = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI response not parseable", raw: rawResponse }, { status: 502 });
    }

    return NextResponse.json({ draft, source: "0g-compute" });
  } catch (ogError: any) {
    console.warn("[0G Unavailable] Bid draft fallback:", ogError.message);
    const fallbackDraft = buildFallbackDraft(body);
    return NextResponse.json({
      draft: fallbackDraft,
      source: "statistical-fallback",
      fallbackReason: ogError.message,
    });
  }
}
