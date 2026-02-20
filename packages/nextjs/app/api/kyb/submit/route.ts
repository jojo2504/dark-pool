/**
 * POST /api/kyb/submit
 * Body: { walletAddress: string, legalName?: string, jurisdiction?: string, contactEmail?: string }
 * Returns: { token: string } — Sumsub SDK token for the WebSDK
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~~/lib/prisma";
import { getOrCreateApplicant } from "~~/lib/sumsub";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      walletAddress?: string;
      legalName?: string;
      jurisdiction?: string;
      contactEmail?: string;
    };

    const walletAddress = body.walletAddress?.toLowerCase();
    if (!walletAddress || !/^0x[0-9a-f]{40}$/i.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    // Create or upsert institution record
    let institution = await prisma.institution.findUnique({ where: { walletAddress } });

    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          walletAddress,
          legalName: body.legalName,
          jurisdiction: body.jurisdiction,
          contactEmail: body.contactEmail,
          kybStatus: "pending",
        },
      });
    } else if (institution.kybStatus === "not_found") {
      institution = await prisma.institution.update({
        where: { walletAddress },
        data: { kybStatus: "pending", legalName: body.legalName, jurisdiction: body.jurisdiction },
      });
    }

    // Get Sumsub SDK token
    const { applicantId, token } = await getOrCreateApplicant(walletAddress);

    // Store applicant ID
    if (!institution.sumsubApplicantId) {
      await prisma.institution.update({
        where: { walletAddress },
        data: { sumsubApplicantId: applicantId, kybStatus: "pending" },
      });
    }

    // Audit log
    await prisma.kybAuditLog.create({
      data: {
        walletAddress,
        action: "submit",
        fromStatus: institution.kybStatus,
        toStatus: "pending",
        meta: JSON.stringify({ applicantId }),
      },
    });

    return NextResponse.json({ token });
  } catch (e: unknown) {
    console.error("[kyb/submit]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
