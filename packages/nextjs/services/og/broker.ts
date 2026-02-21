import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

let _brokerInstance: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

/**
 * Initialise le broker 0G Compute avec la clé privée serveur.
 * Utilise un singleton pour éviter de réinitialiser le ledger à chaque appel.
 * ATTENTION : ce module ne doit JAMAIS être importé dans du code client/React.
 */
export async function getBroker() {
  if (_brokerInstance) return _brokerInstance;

  const privateKey = process.env.OG_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("OG_PRIVATE_KEY manquant dans .env.local — vérifier la configuration");
  }

  // S'assurer que la clé commence par 0x
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

  const rpcUrl = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Test de connectivité avant d'initialiser le broker
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("RPC timeout (10s)")), 10_000)),
    ]);
    console.log("[0G] Connecté au réseau :", (network as any).chainId);

    const wallet = new ethers.Wallet(formattedKey, provider);
    const broker = await createZGComputeNetworkBroker(wallet);
    _brokerInstance = broker;
    return broker;
  } catch (e: any) {
    throw new Error(`Impossible d'initialiser le broker 0G : ${e.message}`);
  }
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
 *
 * Inclut un timeout de 30 secondes et une protection contre les réponses vides.
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
    throw new Error("Aucun provider 0G disponible");
  }

  // CRITIQUE : les headers sont à usage unique — générer pour chaque requête
  const headers = await broker.inference.getRequestHeaders(cached.address, userPrompt);

  // Timeout de 30 secondes
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
      signal: controller.signal,
    });
  } catch (networkError: any) {
    invalidateProviderCache();
    if (networkError.name === "AbortError") {
      throw new Error("Timeout 0G Compute (30s) — provider trop lent, bascule sur fallback");
    }
    throw new Error(`Erreur réseau 0G : ${networkError.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "Réponse illisible");
    invalidateProviderCache();
    throw new Error(`0G HTTP ${response.status}: ${errText}`);
  }

  // Lire le body avec protection contre les réponses vides
  const rawText = await response.text().catch(() => "");
  if (!rawText || rawText.trim() === "") {
    invalidateProviderCache();
    throw new Error("0G Compute a retourné une réponse vide");
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`0G Compute réponse non-JSON : ${rawText.slice(0, 100)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim() === "") {
    throw new Error("Contenu vide dans la réponse 0G Compute");
  }

  // Règlement des frais après réception — OBLIGATOIRE selon le protocole 0G
  try {
    await broker.inference.processResponse(cached.address, content);
  } catch (e) {
    console.warn("[0G] processResponse non-bloquant :", e);
  }

  return content;
}
