import crypto from "crypto";

// ─── Configuration ─────────────────────────────────────────────────────────────

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY;
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || "https://api.sumsub.com";

// ─── Signature Helpers ───────────────────────────────────────────────────────

/**
 * Creates HMAC signature for Sumsub API authentication
 */
function createApiSignature(method: string, url: string, body: string | null, ts: number): string {
  const data = ts + method.toUpperCase() + url + (body || "");
  return crypto.createHmac("sha256", SUMSUB_SECRET_KEY!).update(data).digest("hex");
}

/**
 * Creates EIP-712 hash for webhook signature verification
 */
export function hashWebhookPayload(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

/**
 * Makes authenticated requests to Sumsub API
 */
async function sumsubRequest(
  method: string,
  endpoint: string,
  body?: object | FormData,
  isFormData = false,
): Promise<Response> {
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    throw new Error("SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be set in environment");
  }

  const ts = Math.floor(Date.now() / 1000);
  const bodyStr = body && !isFormData ? JSON.stringify(body) : null;

  const sig = createApiSignature(method, endpoint, bodyStr, ts);

  const headers: Record<string, string> = {
    "X-App-Token": SUMSUB_APP_TOKEN,
    "X-App-Access-Sig": sig,
    "X-App-Access-Ts": ts.toString(),
  };

  if (!isFormData && body) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${SUMSUB_BASE_URL}${endpoint}`;

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Sumsub API error ${res.status}: ${errorText.substring(0, 200)}`);
  }

  return res;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Creates a new applicant for KYB verification
 * Docs: https://docs.sumsub.com/reference/createapplicant
 */
export async function createApplicant(
  externalUserId: string,
  levelName = "business-kyb",
  metadata?: { [key: string]: string },
): Promise<{
  id: string;
  externalUserId: string;
  inspectLink: string;
  requiredIdDocsStatus: string;
}> {
  const res = await sumsubRequest("POST", "/resources/applicants", {
    externalUserId,
    type: "company",
    levelName,
    ...(metadata && { metadata }),
  });

  return res.json();
}

/**
 * Gets applicant status and document requirements
 * Docs: https://docs.sumsub.com/reference/getapplicantstatus
 */
export async function getApplicantStatus(applicantId: string): Promise<{
  id: string;
  externalUserId: string;
  requiredIdDocsStatus: string;
  review: {
    reviewId: string;
    reviewAnswer: "GREEN" | "RED" | "PENDING";
    rejectLabels?: string[];
    reviewNote?: string;
  }[];
}> {
  const res = await sumsubRequest("GET", `/resources/applicants/${applicantId}/requiredIdDocsStatus`);

  return res.json();
}

/**
 * Generates access token for WebSDK
 * Docs: https://docs.sumsub.com/reference/generateaccesstoken
 */
export async function generateAccessToken(
  externalUserId: string,
  levelName = "business-kyb",
  ttlInSecs = 3600,
): Promise<{
  token: string;
  userId: string;
  lifespan: number;
  permissions: string[];
}> {
  const endpoint = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${levelName}&ttlInSecs=${ttlInSecs}`;
  const res = await sumsubRequest("POST", endpoint);
  return res.json();
}

/**
 * Refreshes an existing access token
 */
export async function refreshAccessToken(token: string): Promise<{ token: string }> {
  const res = await sumsubRequest("POST", `/resources/accessTokens/refresh?token=${token}`);
  return res.json();
}

/**
 * Retrieves application data with all documents
 */
export async function getApplication(applicantId: string): Promise<{
  id: string;
  externalUserId: string;
  inspectionId: string;
  createdAt: string;
  review: {
    reviewId: string;
    reviewAnswer: string;
    rejectLabels?: string[];
  }[];
  desiredCountry: string;
  documentInfo: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    country: string;
  }>;
  applicantData: object[];
}> {
  const res = await sumsubRequest("GET", `/resources/applicants/${applicantId}/info`);
  return res.json();
}

/**
 * Deletes an applicant (for GDPR compliance)
 */
export async function deleteApplicant(applicantId: string): Promise<{ ok: true }> {
  const res = await sumsubRequest("DELETE", `/resources/applicants/${applicantId}`);
  return res.json();
}

// ─── Webhook Verification ─────────────────────────────────────────────────────

/**
 * Verifies Sumsub webhook signature using the webhook secret
 * The webhook payload should be verified before processing
 *
 * Expected header: X-Payload-Digest (or x-payload-digest)
 */
export function verifyWebhookSignature(payload: string, receivedSignature: string): boolean {
  if (!process.env.SUMSUB_WEBHOOK_SECRET) {
    throw new Error("SUMSUB_WEBHOOK_SECRET must be set");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.SUMSUB_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));
}

/**
 * Parses and validates Sumsub webhook payload
 * Doc: https://docs.sumsub.com/reference/webhooks
 */
export type SumsubWebhookPayload =
  | {
      type: "applicantReviewed";
      externalUserId: string;
      reviewResult: {
        reviewAnswer: "GREEN" | "RED";
        rejectLabels?: string[];
        reviewNote?: string;
      };
      Timestamp: string;
    }
  | {
      type: "applicantPending";
      externalUserId: string;
      inspectStatus: string;
      Timestamp: string;
    }
  | {
      type: "idCheckStatusChanged";
      externalUserId: string;
      idCheckStatus: string;
      Timestamp: string;
    };

/**
 * Verifies and parses a webhook payload
 */
export async function parseAndVerifyWebhook(rawBody: string, signatureHeader: string): Promise<SumsubWebhookPayload> {
  const isValid = verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(rawBody) as SumsubWebhookPayload;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Maps Sumsub review answer to internal KYB status
 */
export function mapReviewAnswerToStatus(reviewAnswer: string): "verified" | "rejected" | "under_review" {
  switch (reviewAnswer) {
    case "GREEN":
      return "verified";
    case "RED":
      return "rejected";
    default:
      return "under_review";
  }
}

/**
 * Gets human-readable label for reject reasons
 */
export function mapRejectLabels(labels: string[]): string[] {
  const labelMap: Record<string, string> = {
    "document.not.recognized": "Document not recognized",
    "document.expired": "Document expired",
    "document.invalid": "Invalid document",
    "selfie.mismatch": "Selfie does not match document",
    "address.not.verified": "Address not verified",
    "politically.exposed.person": "Politically exposed person",
    "sanctions.match": "Sanctions match detected",
    "adverse.media": "Adverse media found",
  };

  return labels.map(l => labelMap[l] || l);
}
