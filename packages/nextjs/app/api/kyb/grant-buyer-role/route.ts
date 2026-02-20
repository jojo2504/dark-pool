/**
 * POST /api/kyb/grant-buyer-role?wallet=0x...
 * Admin-only: grants BUYER_ROLE on the factory to an already-KYB-verified wallet.
 *
 * Use this for wallets that were verified BEFORE the grantBuyerRole step was
 * added to onChainVerifyInstitution. Without BUYER_ROLE, createVault reverts
 * with "AccessControl: missing role" which ZKSync-based ADI Chain surfaces to
 * MetaMask as the misleading "insufficient funds" error.
 *
 * Authorization: requires PLATFORM_ADMIN_API_KEY header to match env var.
 * Falls back to open in demo mode (no real Sumsub credentials configured).
 */
import { NextRequest, NextResponse } from "next/server";
import { onChainGrantBuyerRole } from "~~/lib/onchain-credentials";
import { prisma } from "~~/lib/prisma";

export async function POST(req: NextRequest) {
  // Simple admin guard
  const apiKey = req.headers.get("x-admin-key");
  const expectedKey = process.env.PLATFORM_ADMIN_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[0-9a-f]{40}$/i.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Verify the wallet is KYB-approved in the DB before granting on-chain role
  const institution = await prisma.institution.findUnique({ where: { walletAddress: wallet } });
  if (!institution) {
    return NextResponse.json({ error: "Institution not found in DB — submit KYB first" }, { status: 404 });
  }
  if (institution.kybStatus !== "verified") {
    return NextResponse.json(
      { error: `KYB status is '${institution.kybStatus}', must be 'verified' first` },
      { status: 400 },
    );
  }

  let txHash: string | undefined;
  try {
    txHash = await onChainGrantBuyerRole(wallet as `0x${string}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "On-chain grantBuyerRole failed: " + msg }, { status: 500 });
  }

  await prisma.kybAuditLog.create({
    data: {
      walletAddress: wallet,
      action: "grant_buyer_role",
      fromStatus: institution.kybStatus,
      toStatus: institution.kybStatus,
      meta: JSON.stringify({ txHash }),
    },
  });

  return NextResponse.json({ ok: true, wallet, txHash });
}
