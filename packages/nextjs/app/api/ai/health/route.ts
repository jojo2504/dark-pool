import { NextResponse } from "next/server";
import { getBroker } from "~~/services/og/broker";

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  providerCount: number;
  latencyMs: number;
  checkedAt: number;
  error?: string;
}

// Cache du dernier health check — évite de spammer le réseau 0G
let _lastHealthCheck: HealthResponse | null = null;
let _lastCheckedAt = 0;
const HEALTH_CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function GET() {
  const now = Date.now();

  // Retourner le cache si encore frais
  if (_lastHealthCheck && now - _lastCheckedAt < HEALTH_CACHE_TTL_MS) {
    return NextResponse.json(_lastHealthCheck);
  }

  const start = Date.now();
  try {
    const broker = await getBroker();
    const services = await broker.inference.listService();
    const latencyMs = Date.now() - start;

    const llmProviders = services.filter((s: any) => s.serviceType === "inference").length;

    const response: HealthResponse = {
      status: llmProviders > 0 ? "ok" : "degraded",
      providerCount: llmProviders,
      latencyMs,
      checkedAt: now,
    };

    _lastHealthCheck = response;
    _lastCheckedAt = now;

    return NextResponse.json(response);
  } catch (error: any) {
    const response: HealthResponse = {
      status: "down",
      providerCount: 0,
      latencyMs: Date.now() - start,
      checkedAt: now,
      error: error.message,
    };

    _lastHealthCheck = response;
    _lastCheckedAt = now;

    return NextResponse.json(response);
  }
}
