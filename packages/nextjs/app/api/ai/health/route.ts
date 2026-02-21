import { NextResponse } from "next/server";

const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  providerCount: number;
  latencyMs: number;
  checkedAt: number;
  services?: Array<{ model: string; serviceType: string; provider: string }>;
  error?: string;
}

// Cache du dernier health check — évite de spammer le réseau 0G
let _lastHealthCheck: HealthResponse | null = null;
let _lastCheckedAt = 0;
const HEALTH_CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Lightweight RPC ping — just calls eth_blockNumber.
 * No private key required, no broker initialization.
 */
async function pingRPC(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(OG_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const latencyMs = Date.now() - start;
    return { ok: !!data.result, latencyMs };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * Deeper check using the broker — lists services and filters for LLM types.
 * Accepts "chatbot", "inference", "chat", "llm" serviceTypes.
 */
async function checkBrokerProviders(): Promise<{
  count: number;
  services: Array<{ model: string; serviceType: string; provider: string }>;
} | null> {
  try {
    if (!process.env.OG_PRIVATE_KEY) return null;
    const { getBroker } = await import("~~/services/og/broker");
    const broker = await getBroker();
    const services = await broker.inference.listService();

    console.log("[0G Health] Tous les services :", JSON.stringify(services));

    // Accepter chatbot ET inference comme types LLM valides
    const llmTypes = ["chatbot", "inference", "chat", "llm"];
    const llmProviders = services.filter((s: any) => llmTypes.includes(s.serviceType?.toLowerCase()));

    return {
      count: llmProviders.length,
      services: services.map((s: any) => ({
        model: s.model,
        serviceType: s.serviceType,
        provider: typeof s.provider === "string" ? s.provider.slice(0, 10) + "..." : "unknown",
      })),
    };
  } catch (e) {
    console.error("[0G Health] Broker check failed:", e);
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  // Return cache if still fresh
  if (_lastHealthCheck && now - _lastCheckedAt < HEALTH_CACHE_TTL_MS) {
    return NextResponse.json(_lastHealthCheck);
  }

  // Step 1: lightweight RPC ping (always works, no key needed)
  const rpc = await pingRPC();

  if (!rpc.ok) {
    const response: HealthResponse = {
      status: "down",
      providerCount: 0,
      latencyMs: rpc.latencyMs,
      checkedAt: now,
      error: "RPC unreachable",
    };
    _lastHealthCheck = response;
    _lastCheckedAt = now;
    return NextResponse.json(response);
  }

  // Step 2: try broker provider check (optional, needs OG_PRIVATE_KEY)
  const brokerResult = await checkBrokerProviders();

  const response: HealthResponse = {
    status: brokerResult === null ? "ok" : brokerResult.count > 0 ? "ok" : "degraded",
    providerCount: brokerResult?.count ?? -1, // -1 = not checked (no key)
    latencyMs: rpc.latencyMs,
    checkedAt: now,
    services: brokerResult?.services,
  };

  _lastHealthCheck = response;
  _lastCheckedAt = now;

  return NextResponse.json(response);
}
