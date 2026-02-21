import { NextResponse } from "next/server";
import { getGeminiClient } from "~~/services/gemini/client";

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  provider: string;
  latencyMs: number;
  checkedAt: number;
  model?: string;
  error?: string;
}

let _lastHealthCheck: HealthResponse | null = null;
let _lastCheckedAt = 0;
const HEALTH_CACHE_TTL_MS = 60 * 1000;

export async function GET() {
  const now = Date.now();

  if (_lastHealthCheck && now - _lastCheckedAt < HEALTH_CACHE_TTL_MS) {
    return NextResponse.json(_lastHealthCheck);
  }

  const start = Date.now();
  try {
    // Vérifier que la clé Gemini est configurée
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Ping léger — une requête minimale pour vérifier la connectivité
    const result = await model.generateContent("Reply with just: ok");
    const text = result.response.text();

    const response: HealthResponse = {
      status: text ? "ok" : "degraded",
      provider: "gemini",
      model: "gemini-2.0-flash",
      latencyMs: Date.now() - start,
      checkedAt: now,
    };

    _lastHealthCheck = response;
    _lastCheckedAt = now;
    return NextResponse.json(response);
  } catch (error: any) {
    const response: HealthResponse = {
      status: "down",
      provider: "gemini",
      latencyMs: Date.now() - start,
      checkedAt: now,
      error: error.message,
    };

    _lastHealthCheck = response;
    _lastCheckedAt = now;
    return NextResponse.json(response);
  }
}
