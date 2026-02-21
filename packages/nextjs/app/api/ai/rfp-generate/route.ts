import { NextRequest, NextResponse } from "next/server";
import { ensureLedgerFunded, getBroker, runInference } from "~~/services/og/broker";

interface RFPGenerateRequest {
  assetType: string;
  location: string;
  budget: string;
  requirements: string;
  timeline: string;
}

function buildFallbackRFP(body: RFPGenerateRequest) {
  const { assetType, location, budget, requirements, timeline } = body;
  return {
    suggestedTitle: `${assetType.toUpperCase()} — ${location.toUpperCase()} SEALED-BID TENDER`,
    suggestedDescription: `Request for Proposals for ${assetType} located in ${location}. Budget range: ${budget} ADI. Requirements: ${requirements}. Expected timeline: ${timeline}. All bids must comply with platform KYB verification requirements.`,
    suggestedDuration: 48,
    suggestedDeposit: "0.01",
    keyTerms: [
      assetType,
      location,
      ...requirements
        .split(",")
        .map(r => r.trim())
        .filter(Boolean)
        .slice(0, 3),
    ],
    isFallback: true,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RFPGenerateRequest;
  const { assetType, requirements } = body;

  if (!assetType || !requirements) {
    return NextResponse.json({ error: "assetType and requirements are required" }, { status: 400 });
  }

  try {
    const broker = await getBroker();
    await ensureLedgerFunded(broker);

    const systemPrompt = `You are an expert RFP (Request for Proposal) writer for institutional RWA sealed-bid auctions.
You help buyers create clear, professional auction listings that maximize quality bid submissions.
You respond ONLY in valid JSON, no markdown, no backticks.`;

    const userPrompt = `
Generate a professional auction listing from these inputs:

ASSET TYPE: ${assetType}
LOCATION: ${body.location || "Not specified"}
BUDGET: ${body.budget || "Not specified"} ADI
KEY REQUIREMENTS: ${requirements}
TIMELINE: ${body.timeline || "Not specified"}

Return ONLY this JSON (no markdown):
{
  "suggestedTitle": "<concise professional title, max 80 chars>",
  "suggestedDescription": "<detailed 2-3 paragraph description covering scope, requirements, and expectations>",
  "suggestedDuration": <number, recommended auction duration in hours>,
  "suggestedDeposit": "<recommended deposit in ADI as string>",
  "keyTerms": ["<term1>", "<term2>", ...]
}`.trim();

    const rawResponse = await runInference(broker, systemPrompt, userPrompt, 800);

    let rfp;
    try {
      const cleaned = rawResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      rfp = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI response not parseable", raw: rawResponse }, { status: 502 });
    }

    return NextResponse.json({ rfp, source: "0g-compute" });
  } catch (ogError: any) {
    console.warn("[0G Unavailable] RFP generation fallback:", ogError.message);
    const fallbackRFP = buildFallbackRFP(body);
    return NextResponse.json({
      rfp: fallbackRFP,
      source: "statistical-fallback",
      fallbackReason: ogError.message,
    });
  }
}
