/**
 * GET /api/kyb/status?wallet=0x...
 * Returns KYB status for a wallet address.
 */
import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json(institution);
}
