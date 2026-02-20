import { NextResponse } from "next/server";

const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

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
 * Optional deeper check using the broker (requires OG_PRIVATE_KEY).
 * Returns provider count or null if unavailable.
 */
async function checkBrokerProviders(): Promise<number | null> {
  try {
    if (!process.env.OG_PRIVATE_KEY) return null;
    // Dynamic import to avoid failing when key is missing
    const { getBroker } = await import("~~/services/og/broker");
    const broker = await getBroker();
    const services = await broker.inference.listService();
    return services.filter((s: any) => s.serviceType === "inference").length;
  } catch {
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
  const providerCount = await checkBrokerProviders();

  const response: HealthResponse = {
    status: providerCount === null ? "ok" : providerCount > 0 ? "ok" : "degraded",
    providerCount: providerCount ?? -1, // -1 = not checked (no key)
    latencyMs: rpc.latencyMs,
    checkedAt: now,
  };

  _lastHealthCheck = response;
  _lastCheckedAt = now;

  return NextResponse.json(response);
}
