/**
 * POST /api/kyb/webhook
 * Handles Sumsub review result webhooks.
 * Triggers on-chain verifyInstitution when review is approved.
 */
import { NextRequest, NextResponse } from "next/server";
import { onChainVerifyInstitution } from "~~/lib/onchain-credentials";
import { prisma } from "~~/lib/prisma";
import { hasSanctionHit, screenEntity } from "~~/lib/sanctions";
import { verifyWebhookSignature } from "~~/lib/sumsub";

interface SumsubWebhookPayload {
  type: string;
  externalUserId: string;
  applicantId: string;
  reviewResult?: {
    reviewAnswer: "GREEN" | "RED";
    rejectLabels?: string[];
  };
  reviewStatus: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get("x-payload-digest") ?? "";

    if (!verifyWebhookSignature(payload, signature)) {
      console.warn("[kyb/webhook] Invalid signature");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = JSON.parse(payload) as SumsubWebhookPayload;
    const walletAddress = event.externalUserId.toLowerCase() as `0x${string}`;

    if (event.type !== "applicantReviewed") {
      return NextResponse.json({ ok: true });
    }

    const institution = await prisma.institution.findUnique({ where: { walletAddress } });
    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const approved = event.reviewResult?.reviewAnswer === "GREEN";
    const fromStatus = institution.kybStatus;
    let newStatus = approved ? "verified" : "rejected";

    if (approved) {
      // Run sanctions screening before on-chain credentialing
      let sanctionHit = false;
      let sanctionDetails: string | undefined;

      if (institution.legalName) {
        try {
          const result = await screenEntity(institution.legalName, institution.jurisdiction ?? undefined);
          sanctionHit = hasSanctionHit(result);
          if (sanctionHit) {
            sanctionDetails = JSON.stringify(result.hits.slice(0, 3));
            newStatus = "suspended";
          }
        } catch (e) {
          console.error("[kyb/webhook] Sanctions check failed:", e);
          // Don't block on sanctions failure — flag for manual review
          newStatus = "under_review";
        }
      }

      // Update DB
      await prisma.institution.update({
        where: { walletAddress },
        data: {
          kybStatus: newStatus,
          lastScreenedAt: new Date(),
          sanctionHit,
          sanctionHitDetails: sanctionDetails,
        },
      });

      // Credential on-chain only if clean
      if (newStatus === "verified") {
        try {
          const txHash = await onChainVerifyInstitution(
            walletAddress,
            institution.isAccredited,
            institution.jurisdiction ?? "",
          );
          await prisma.institution.update({
            where: { walletAddress },
            data: { onChainVerified: true, onChainTxHash: txHash },
          });
        } catch (e) {
          console.error("[kyb/webhook] On-chain verify failed:", e);
        }
      }
    } else {
      await prisma.institution.update({
        where: { walletAddress },
        data: { kybStatus: newStatus },
      });
    }

    // Audit log
    await prisma.kybAuditLog.create({
      data: {
        walletAddress,
        action: approved ? "webhook_approved" : "webhook_rejected",
        fromStatus,
        toStatus: newStatus,
        meta: JSON.stringify({ applicantId: event.applicantId }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[kyb/webhook]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
