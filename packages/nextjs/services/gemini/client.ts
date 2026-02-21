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
 * Vérifie si Gemini est disponible (pas de quota exceeded)
 */
export async function isGeminiAvailable(): Promise<boolean> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    // Quick ping test - use simpler method based on SDK version
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: "ok" }] }] });
    const text = result.response.text();
    return !!text;
  } catch (e: any) {
    // If it's a quota error, Gemini is unavailable
    if (e.message?.includes("Quota exceeded") || e.message?.includes("429")) {
      return false;
    }
    return false;
  }
}

// Export getGeminiClient for health check
export { getGeminiClient };

/**
 * Effectue une requête d'inférence via Groq (principal), Gemini Flash, ou OpenAI.
 * Priorité : Groq → OpenAI → Gemini
 */
export async function runInference(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string> {
  console.log("[runInference] Starting with maxTokens:", maxTokens);

  // 1. Try Groq first (fast, free tier generous)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log("[runInference] Groq key found, trying Groq first");
    try {
      const result = await runInferenceGroq(systemPrompt, userPrompt, maxTokens);
      console.log("[runInference] Groq succeeded");
      return result;
    } catch (e: any) {
      console.warn("[AI] Groq failed:", e.message);
    }
  }

  // 2. Try OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    console.log("[runInference] OpenAI key found, trying OpenAI");
    try {
      const result = await runInferenceOpenAI(systemPrompt, userPrompt, maxTokens);
      console.log("[runInference] OpenAI succeeded");
      return result;
    } catch (e: any) {
      console.warn("[AI] OpenAI failed:", e.message);
    }
  }

  // 3. Try Gemini
  try {
    console.log("[runInference] Trying Gemini");
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
      },
      systemInstruction: systemPrompt,
    });

    const timeout = setTimeout(() => {}, 30_000);

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });

      const content = result.response.text();
      if (!content || content.trim() === "") {
        throw new Error("Gemini a retourné une réponse vide");
      }

      console.log("[runInference] Gemini succeeded");
      return content;
    } catch (e: any) {
      console.warn("[runInference] Gemini error:", e.message);
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  } catch (e: any) {
    console.error("[runInference] All providers failed:", e.message);
    throw new Error(`All AI providers failed. Last error: ${e.message}`);
  }
}

// ─── Provider: Groq (OpenAI-compatible, primary) ──────────────────────────────

/**
 * Detect which Groq provider the user wants based on the current active inference.
 * Returns the provider name used in the last successful runInference call.
 */
export function getActiveProvider(): string {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (groqKey) return "groq";
  if (openaiKey) return "openai";
  if (geminiKey) return "gemini";
  return "none";
}

/**
 * Run inference via Groq (OpenAI-compatible API).
 * Uses llama-3.3-70b-versatile — fast, free tier: 6000 req/day.
 */
async function runInferenceGroq(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error("GROQ_API_KEY non configuré");
  }

  console.log("[Groq] Making request with key starting:", groqKey.substring(0, 10) + "...");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const responseText = await response.text();
  console.log("[Groq] Response status:", response.status, "Body preview:", responseText.substring(0, 300));

  if (!response.ok) {
    throw new Error(`Groq API ${response.status}: ${responseText.substring(0, 200)}`);
  }

  try {
    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim() === "") {
      throw new Error("Groq a retourné une réponse vide");
    }
    return content;
  } catch (e: any) {
    throw new Error(`Groq response parse error: ${e.message}. Raw: ${responseText.substring(0, 200)}`);
  }
}

// ─── Provider: OpenAI ─────────────────────────────────────────────────────────
async function runInferenceOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY non configuré");
  }

  console.log("[OpenAI] Making request with key starting:", openaiKey.substring(0, 10) + "...");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const responseText = await response.text();
  console.log("[OpenAI] Response status:", response.status, "Body preview:", responseText.substring(0, 300));

  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${responseText.substring(0, 200)}`);
  }

  try {
    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim() === "") {
      throw new Error("OpenAI a retourné une réponse vide");
    }
    return content;
  } catch (e: any) {
    throw new Error(`OpenAI response parse error: ${e.message}. Raw: ${responseText.substring(0, 200)}`);
  }
}
