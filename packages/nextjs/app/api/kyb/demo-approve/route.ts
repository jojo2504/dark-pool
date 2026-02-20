/**
 * POST /api/kyb/demo-approve?wallet=0x...
 * DEMO ONLY — instantly approves a KYB application and triggers on-chain credentialing.
 * Only available when SUMSUB_APP_TOKEN is not set (i.e. no real Sumsub integration).
 *
 * 📋 ROADMAP: Replace with real Sumsub webhook flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { onChainVerifyInstitution } from "~~/lib/onchain-credentials";
import { prisma } from "~~/lib/prisma";

export async function POST(req: NextRequest) {
  // Guard: only available in demo mode (no real Sumsub credentials)
  if (process.env.SUMSUB_APP_TOKEN) {
    return NextResponse.json({ error: "Not available in production mode" }, { status: 403 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[0-9a-f]{40}$/i.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const institution = await prisma.institution.findUnique({ where: { walletAddress: wallet } });
  if (!institution) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  // Mark as verified in DB
  await prisma.institution.update({
    where: { walletAddress: wallet },
    data: {
      kybStatus: "verified",
      lastScreenedAt: new Date(),
      sanctionHit: false,
    },
  });

  // Attempt on-chain credentialing
  let txHash: string | undefined;
  try {
    txHash = await onChainVerifyInstitution(
      wallet as `0x${string}`,
      institution.isAccredited,
      institution.jurisdiction ?? "",
    );
    await prisma.institution.update({
      where: { walletAddress: wallet },
      data: { onChainVerified: true, onChainTxHash: txHash },
    });
  } catch (e) {
    console.warn("[demo-approve] On-chain verify skipped:", e instanceof Error ? e.message : e);
  }

  await prisma.kybAuditLog.create({
    data: {
      walletAddress: wallet,
      action: "demo_approve",
      fromStatus: institution.kybStatus,
      toStatus: "verified",
      meta: JSON.stringify({ txHash }),
    },
  });

  return NextResponse.json({ ok: true, kybStatus: "verified", onChainVerified: !!txHash, txHash });
}
