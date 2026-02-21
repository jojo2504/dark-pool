import { NextResponse } from "next/server";
import { getActiveProvider } from "~~/services/gemini/client";

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

/**
 * Quick ping for each provider — tests that the key + endpoint actually work.
 */
async function pingGroq(): Promise<boolean> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

async function pingOpenAI(): Promise<boolean> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

async function pingGemini(): Promise<boolean> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return false;
  try {
    const { getGeminiClient } = await import("~~/services/gemini/client");
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("ok");
    return !!result.response.text();
  } catch {
    return false;
  }
}

export async function GET() {
  const now = Date.now();

  if (_lastHealthCheck && now - _lastCheckedAt < HEALTH_CACHE_TTL_MS) {
    return NextResponse.json(_lastHealthCheck);
  }

  const start = Date.now();
  const active = getActiveProvider();

  // Ping providers in priority order: Groq → OpenAI → Gemini
  const providers: { name: string; model: string; ping: () => Promise<boolean> }[] = [
    { name: "groq", model: "llama-3.3-70b-versatile", ping: pingGroq },
    { name: "openai", model: "gpt-4o-mini", ping: pingOpenAI },
    { name: "gemini", model: "gemini-2.0-flash", ping: pingGemini },
  ];

  for (const p of providers) {
    try {
      const ok = await p.ping();
      if (ok) {
        const response: HealthResponse = {
          status: "ok",
          provider: p.name,
          model: p.model,
          latencyMs: Date.now() - start,
          checkedAt: now,
        };
        _lastHealthCheck = response;
        _lastCheckedAt = now;
        return NextResponse.json(response);
      }
    } catch (e: any) {
      console.warn(`[Health] ${p.name} ping failed:`, e.message);
    }
  }

  // All providers failed
  const response: HealthResponse = {
    status: "down",
    provider: active,
    latencyMs: Date.now() - start,
    checkedAt: now,
    error: "No AI provider reachable",
  };
  _lastHealthCheck = response;
  _lastCheckedAt = now;
  return NextResponse.json(response);
}
