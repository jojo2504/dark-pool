/**
 * ComplyAdvantage sanctions screening client
 * Docs: https://docs.complyadvantage.com/
 */

const API_KEY = process.env.COMPLY_ADVANTAGE_API_KEY ?? "";
const BASE_URL = "https://api.complyadvantage.com";

export interface SanctionSearchResult {
  searchId: string;
  totalHits: number;
  hits: Array<{
    score: number;
    matchTypes: string[];
    doc: { name: string; types: string[] };
  }>;
}

/** Run a sanctions search for an entity name + jurisdiction */
export async function screenEntity(entityName: string, jurisdiction?: string): Promise<SanctionSearchResult> {
  // Demo mode: no real ComplyAdvantage key configured
  if (!API_KEY) {
    console.warn("[sanctions] DEMO MODE — skipping real screening (COMPLY_ADVANTAGE_API_KEY not set)");
    return { searchId: "demo", totalHits: 0, hits: [] };
  }

  const body = {
    search_term: entityName,
    fuzziness: 0.6,
    search_profile: "sanctions",
    ...(jurisdiction ? { filters: { countries: [jurisdiction] } } : {}),
  };

  const res = await fetch(`${BASE_URL}/searches`, {
    method: "POST",
    headers: {
      Authorization: `Token ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ComplyAdvantage search failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    content: {
      data: {
        id: string;
        total_hits: number;
        hits: Array<{
          score: number;
          match_types: string[];
          doc: { name: string; types: string[] };
        }>;
      };
    };
  };

  const d = data.content.data;
  return {
    searchId: d.id,
    totalHits: d.total_hits,
    hits: d.hits.map(h => ({
      score: h.score,
      matchTypes: h.match_types,
      doc: h.doc,
    })),
  };
}

/** Returns true if the entity has a high-confidence sanction match */
export function hasSanctionHit(result: SanctionSearchResult, threshold = 0.85): boolean {
  return result.hits.some(h => h.score >= threshold);
}
