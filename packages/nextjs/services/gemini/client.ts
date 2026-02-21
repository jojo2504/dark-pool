import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

/**
 * Retourne le client Gemini initialisé (singleton).
 * ATTENTION : server-side uniquement — ne jamais importer dans du code client/React.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant dans .env.local");

  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

/**
 * Effectue une requête d'inférence via Gemini Flash.
 * Interface identique à l'ancien runInference() de 0G pour compatibilité totale.
 * Drop-in replacement — les routes API n'ont pas besoin de changer.
 */
export async function runInference(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
    },
    systemInstruction: systemPrompt,
  });

  // Timeout de 30 secondes
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const content = result.response.text();
    if (!content || content.trim() === "") {
      throw new Error("Gemini a retourné une réponse vide");
    }

    return content;
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new Error("Timeout Gemini (30s)");
    }
    throw new Error(`Erreur Gemini : ${e.message}`);
  } finally {
    clearTimeout(timeout);
  }
}
