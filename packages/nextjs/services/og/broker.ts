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
 * Utilise depositFund (API officielle 0G) — prend un number en argument.
 */
export async function ensureLedgerFunded(broker: OGBroker) {
  try {
    const account = await broker.ledger.getLedger();
    const balance = parseFloat(ethers.formatEther((account as any).balance ?? 0n));
    console.log(`[0G] Solde ledger : ${balance} OG`);

    if (balance < 0.01) {
      console.log("[0G] Solde insuffisant, tentative de dépôt...");
      await broker.ledger.depositFund(1); // 1 OG token
      console.log("[0G] Dépôt effectué : 1 OG");
    }
  } catch {
    // Ledger inexistant — créer avec depositFund
    try {
      await broker.ledger.depositFund(1);
      console.log("[0G] Ledger créé avec 1 OG");
    } catch (e2: any) {
      console.error("[0G] Impossible de créer le ledger :", e2.message);
      // Non bloquant — continuer même sans ledger (le fallback prendra le relais)
    }
  }
}

export type OGBroker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

/**
 * Récupère le meilleur provider LLM disponible sur le réseau 0G.
 * IMPORTANT : le testnet 0G utilise serviceType "chatbot" (PAS "inference").
 * Les deux sont acceptés ici pour compatibilité.
 */
export async function selectBestLLMProvider(broker: OGBroker): Promise<string> {
  const services = await broker.inference.listService();

  console.log("[0G] Services disponibles :", JSON.stringify(services, null, 2));

  if (!services || services.length === 0) {
    throw new Error("Aucun service disponible sur 0G Compute.");
  }

  // IMPORTANT : selon la doc officielle 0G, le serviceType LLM est "chatbot"
  // pas "inference". Les deux sont acceptés ici pour compatibilité.
  const llmKeywords = ["llama", "deepseek", "qwen", "mistral", "gpt", "llm", "chat", "glm"];
  const llmTypes = ["chatbot", "inference", "chat", "llm"];

  const llmService =
    // Priorité 1 : chatbot avec modèle LLM connu
    services.find(
      (s: any) =>
        llmTypes.includes(s.serviceType?.toLowerCase()) && llmKeywords.some(kw => s.model?.toLowerCase().includes(kw)),
    ) ||
    // Priorité 2 : n'importe quel chatbot/inference
    services.find((s: any) => llmTypes.includes(s.serviceType?.toLowerCase())) ||
    // Priorité 3 : premier service disponible
    services[0];

  if (!llmService) throw new Error("Aucun provider LLM trouvé sur le réseau 0G");

  const providerAddress = (llmService as any).provider;
  console.log(
    `[0G] Provider sélectionné : ${(llmService as any).model} (${(llmService as any).serviceType}) @ ${providerAddress}`,
  );

  // Obligatoire avant d'utiliser un provider pour la première fois
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    console.log("[0G] Provider acquitté");
  } catch {
    // Déjà acquitté — ignorer l'erreur
  }

  return providerAddress;
}

/**
 * Transfère des fonds vers le sub-account du provider.
 * Requis par le protocole 0G avant de faire des requêtes.
 */
export async function ensureProviderFunded(broker: OGBroker, providerAddress: string) {
  try {
    await (broker as any).transferFund(providerAddress, 0.5);
    console.log(`[0G] 0.5 OG transférés vers le provider ${providerAddress.slice(0, 10)}...`);
  } catch {
    // Essayer via ledger si la méthode n'est pas sur le broker principal
    try {
      await (broker.ledger as any).transferFund(providerAddress, 0.5);
      console.log(`[0G] 0.5 OG transférés (via ledger) vers ${providerAddress.slice(0, 10)}...`);
    } catch (e2: any) {
      // Non bloquant — continuer sans transfert, le fallback prendra le relais
      console.warn("[0G] transferFund non-bloquant :", e2.message);
    }
  }
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
    console.log(`[0G Cache] Provider depuis cache : ${_providerCache.model}`);
    return _providerCache;
  }

  const providerAddress = await selectBestLLMProvider(broker);
  await ensureProviderFunded(broker, providerAddress);
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);

  console.log(`[0G] Metadata provider — model: ${model}, endpoint: ${endpoint}`);

  _providerCache = {
    address: providerAddress,
    model,
    endpoint,
    cachedAt: now,
  };

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

  // Extraire chatID depuis les headers de réponse (méthode officielle 0G)
  const chatID = response.headers.get("ZG-Res-Key") || response.headers.get("zg-res-key") || undefined;

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

  // Extraire usage depuis la réponse
  const usage = data.usage ? JSON.stringify(data.usage) : undefined;

  // Règlement des frais — 3 arguments selon le protocole 0G officiel
  // (providerAddress, chatID | undefined, usage | undefined)
  try {
    await broker.inference.processResponse(cached.address, chatID, usage);
    console.log("[0G] processResponse OK — frais réglés");
  } catch (e) {
    console.warn("[0G] processResponse non-bloquant :", e);
  }

  return content;
}
