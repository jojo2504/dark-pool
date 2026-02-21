import { NextRequest, NextResponse } from "next/server";
import { ensureLedgerFunded, getBroker, runInference } from "~~/services/og/broker";

interface CategorizeRequest {
  title: string;
  description: string;
}

function buildFallbackCategorization(body: CategorizeRequest) {
  const text = (body.title + " " + body.description).toLowerCase();

  const categories: Record<string, string[]> = {
    "Real Estate": ["real estate", "property", "building", "land", "villa", "apartment", "tower", "plot"],
    Infrastructure: ["infrastructure", "road", "bridge", "utility", "water", "power", "transport"],
    Construction: ["construction", "renovation", "development", "build"],
    Technology: ["technology", "software", "hardware", "digital", "it ", "cloud", "ai"],
    "Financial Services": ["financial", "banking", "insurance", "investment", "fund"],
    Energy: ["energy", "solar", "oil", "gas", "renewable", "power plant"],
    Healthcare: ["healthcare", "hospital", "medical", "pharma"],
    Government: ["government", "public", "municipal", "federal"],
  };

  const scores: Array<{ cat: string; score: number }> = [];
  for (const [cat, keywords] of Object.entries(categories)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > 0) scores.push({ cat, score });
  }
  scores.sort((a, b) => b.score - a.score);

  const primary = scores[0]?.cat || "General";
  const secondary = scores.slice(1, 3).map(s => s.cat);

  // Extract simple tags from title
  const tags = body.title
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .map(w => w.toUpperCase());

  return {
    primaryCategory: primary,
    secondaryCategories: secondary,
    tags,
    confidence: scores[0]?.score ? Math.min(0.9, 0.3 + scores[0].score * 0.15) : 0.2,
    isFallback: true,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CategorizeRequest;
  const { title, description } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const broker = await getBroker();
    await ensureLedgerFunded(broker);

    const systemPrompt = `You are a categorization expert for institutional RWA (Real World Asset) auctions.
You classify auctions into industry categories based on their title and description.
You respond ONLY in valid JSON, no markdown, no backticks.`;

    const userPrompt = `
Categorize this auction:

TITLE: "${title}"
DESCRIPTION: "${description || "No description provided"}"

Assign a primary category, secondary categories (if applicable), and relevant tags.

Return ONLY this JSON (no markdown):
{
  "primaryCategory": "<main category>",
  "secondaryCategories": ["<cat1>", "<cat2>"],
  "tags": ["<tag1>", "<tag2>", "<tag3>", ...],
  "confidence": <number 0-1>
}`.trim();

    const rawResponse = await runInference(broker, systemPrompt, userPrompt, 400);

    let categorization;
    try {
      const cleaned = rawResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      categorization = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI response not parseable", raw: rawResponse }, { status: 502 });
    }

    return NextResponse.json({ categorization, source: "0g-compute" });
  } catch (ogError: any) {
    console.warn("[0G Unavailable] Categorization fallback:", ogError.message);
    const fallback = buildFallbackCategorization(body);
    return NextResponse.json({
      categorization: fallback,
      source: "statistical-fallback",
      fallbackReason: ogError.message,
    });
  }
}
