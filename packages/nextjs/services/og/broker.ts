import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

let _brokerInstance: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

/**
 * Initialise le broker 0G Compute avec la clé privée serveur.
 * Utilise un singleton pour éviter de réinitialiser le ledger à chaque appel.
 * ATTENTION : ce module ne doit JAMAIS être importé dans du code client/React.
 */
export async function getBroker() {
  if (_brokerInstance) return _brokerInstance;

  const privateKey = process.env.OG_PRIVATE_KEY;
  if (!privateKey) throw new Error("OG_PRIVATE_KEY manquant dans les variables d'environnement serveur");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  const broker = await createZGComputeNetworkBroker(wallet);
  _brokerInstance = broker;
  return broker;
}

/**
 * Vérifie le solde du ledger et crée/alimente le compte si nécessaire.
 * Minimum recommandé : 0.1 OG (~10 000 requêtes d'inférence).
 */
export async function ensureLedgerFunded(broker: OGBroker) {
  try {
    const account = await broker.ledger.getLedger();
    const balance = parseFloat(ethers.formatEther((account as any).balance ?? 0n));

    if (balance < 0.01) {
      await broker.ledger.addLedger(0.1 as any);
      console.log("[0G] Ledger créé et alimenté : 0.1 OG");
    }
  } catch {
    // Le ledger n'existe pas encore, on le crée
    try {
      await broker.ledger.addLedger(0.1 as any);
      console.log("[0G] Nouveau ledger créé : 0.1 OG");
    } catch (e) {
      console.error("[0G] Impossible de créer le ledger :", e);
      throw new Error("Solde OG insuffisant sur le wallet serveur. Utilise le faucet 0G.");
    }
  }
}

export type OGBroker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

/**
 * Récupère le meilleur provider LLM disponible sur le réseau 0G.
 * Filtre par type de service "inference" et présence d'un modèle de langage.
 */
export async function selectBestLLMProvider(broker: OGBroker): Promise<string> {
  const services = await broker.inference.listService();

  if (!services || services.length === 0) {
    throw new Error("Aucun service disponible sur 0G Compute. Réseau indisponible ou timeout.");
  }

  // Priorité : modèles LLM connus (llama, deepseek, qwen, mistral, gpt)
  const llmKeywords = ["llama", "deepseek", "qwen", "mistral", "gpt", "llm", "chat"];

  const llmService =
    services.find(
      (s: any) => s.serviceType === "inference" && llmKeywords.some(kw => s.model?.toLowerCase().includes(kw)),
    ) ||
    services.find((s: any) => s.serviceType === "inference") ||
    services[0];

  if (!llmService) throw new Error("Aucun provider LLM trouvé sur le réseau 0G");

  // Obligatoire avant d'utiliser un provider pour la première fois
  try {
    await broker.inference.acknowledgeProviderSigner((llmService as any).provider);
  } catch {
    // Déjà acquitté — ignorer l'erreur
  }

  return (llmService as any).provider;
}

// ─── Cache provider côté serveur ────────────────────────────────────────────

interface CachedProvider {
  address: string;
  model: string;
  endpoint: string;
  cachedAt: number;
}

let _providerCache: CachedProvider | null = null;
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Version cachée de selectBestLLMProvider.
 * Évite de refaire listService() à chaque requête API.
 * Le cache est invalidé automatiquement après 5 minutes ou si le provider échoue.
 */
export async function getCachedProvider(broker: OGBroker): Promise<CachedProvider> {
  const now = Date.now();

  if (_providerCache && now - _providerCache.cachedAt < PROVIDER_CACHE_TTL_MS) {
    return _providerCache;
  }

  const providerAddress = await selectBestLLMProvider(broker);
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);

  _providerCache = {
    address: providerAddress,
    model,
    endpoint,
    cachedAt: now,
  };

  console.log(`[0G Cache] Provider cached: ${model} @ ${endpoint}`);
  return _providerCache;
}

/**
 * Invalide le cache provider (à appeler si une requête échoue avec ce provider).
 */
export function invalidateProviderCache(): void {
  _providerCache = null;
  console.log("[0G Cache] Provider cache invalidated");
}

/**
 * Effectue une requête d'inférence complète sur 0G Compute.
 * Gère automatiquement la sélection de provider (cache), les headers, la requête
 * et le règlement des frais. Invalide le cache en cas d'erreur réseau.
 */
export async function runInference(
  broker: OGBroker,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 600,
): Promise<string> {
  let cached: CachedProvider;
  try {
    cached = await getCachedProvider(broker);
  } catch {
    throw new Error("Impossible de trouver un provider 0G disponible. Réseau indisponible.");
  }

  // CRITIQUE : les headers sont à usage unique — générer pour chaque requête
  const headers = await broker.inference.getRequestHeaders(cached.address, userPrompt);

  let response: Response;
  try {
    response = await fetch(`${cached.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        model: cached.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });
  } catch (networkError) {
    invalidateProviderCache();
    throw new Error(`Network error reaching 0G provider: ${networkError}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    invalidateProviderCache();
    throw new Error(`0G Compute HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error("Réponse vide de 0G Compute");

  // Règlement des frais après réception — OBLIGATOIRE selon le protocole 0G
  try {
    await broker.inference.processResponse(cached.address, content);
  } catch (e) {
    console.warn("[0G] processResponse échoué (non bloquant) :", e);
  }

  return content;
}
