/**
 * Sumsub KYB API client
 * Docs: https://developers.sumsub.com/
 */
import crypto from "crypto";

const BASE_URL = "https://api.sumsub.com";
const APP_TOKEN = process.env.SUMSUB_APP_TOKEN ?? "";
const SECRET_KEY = process.env.SUMSUB_SECRET_KEY ?? "";

/** Build HMAC-SHA256 signature required by Sumsub */
function buildSignature(ts: number, method: string, path: string, body?: string): string {
  const data = ts + method.toUpperCase() + path + (body ?? "");
  return crypto.createHmac("sha256", SECRET_KEY).update(data).digest("hex");
}

async function sumsubFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const ts = Math.floor(Date.now() / 1000);
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const sig = buildSignature(ts, method, path, bodyStr);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "X-App-Token": APP_TOKEN,
      "X-App-Access-Ts": String(ts),
      "X-App-Access-Sig": sig,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sumsub ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export interface SumsubApplicant {
  id: string;
  externalUserId: string;
  review: {
    reviewResult?: { reviewAnswer: "GREEN" | "RED" };
    reviewStatus: string;
  };
}

/** Create or retrieve an applicant and return the SDK access token */
export async function getOrCreateApplicant(walletAddress: string): Promise<{
  applicantId: string;
  token: string;
}> {
  // Try to create a new applicant
  const applicant = await sumsubFetch<SumsubApplicant>("POST", `/resources/applicants?levelName=basic-kyb-level`, {
    externalUserId: walletAddress,
    type: "company",
  });

  const tokenResp = await sumsubFetch<{ token: string }>(
    "POST",
    `/resources/accessTokens?userId=${walletAddress}&ttlInSecs=1800`,
  );

  return { applicantId: applicant.id, token: tokenResp.token };
}

/** Get full applicant review status */
export async function getApplicantStatus(applicantId: string): Promise<SumsubApplicant> {
  return sumsubFetch<SumsubApplicant>("GET", `/resources/applicants/${applicantId}/one`);
}

/** Verify Sumsub webhook signature */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
