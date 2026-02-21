/**
 * GET /api/kyb/status?wallet=0x...
 * Returns KYB status for a wallet address.
 * Falls back to on-chain check if DB says not verified.
 */
import { NextRequest, NextResponse } from "next/server";
import { isVerifiedOnChain } from "~~/lib/onchain-credentials";
import { prisma } from "~~/lib/prisma";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();

  if (!wallet || !/^0x[0-9a-f]{40}$/i.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const institution = await prisma.institution.findUnique({
    where: { walletAddress: wallet },
    select: {
      kybStatus: true,
      isAccredited: true,
      jurisdiction: true,
      legalName: true,
      onChainVerified: true,
      lastScreenedAt: true,
      sanctionHit: true,
    },
  });

  if (!institution) {
    return NextResponse.json({ kybStatus: "not_found" });
  }

  // If DB says not verified, double-check on-chain (self-heals stale DB state)
  if (!institution.onChainVerified) {
    try {
      const onChain = await isVerifiedOnChain(wallet as `0x${string}`);
      if (onChain) {
        await prisma.institution.update({
          where: { walletAddress: wallet },
          data: { onChainVerified: true },
        });
        institution.onChainVerified = true;
      }
    } catch {
      // On-chain check failed — keep DB value
    }
  }

  return NextResponse.json(institution);
}
