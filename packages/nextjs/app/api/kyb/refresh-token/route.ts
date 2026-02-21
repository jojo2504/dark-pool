/**
 * GET /api/kyb/refresh-token
 * Refreshes Sumsub access token for WebSDK
 *
 * Query: ?wallet=0x...
 * Returns: { token: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~~/lib/prisma";
import { generateAccessToken } from "~~/lib/sumsub";

export async function GET(req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!institution || !institution.sumsubExternalId) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    // In demo mode, return a new demo token
    if (!process.env.SUMSUB_APP_TOKEN || !process.env.SUMSUB_SECRET_KEY) {
      return NextResponse.json({
        token: `demo-token-${walletAddress.slice(2, 10)}-${Date.now()}`,
        demo: true,
      });
    }

    // Generate new access token
    const accessToken = await generateAccessToken(institution.sumsubExternalId);

    return NextResponse.json({
      token: accessToken.token,
      demo: false,
    });
  } catch (error) {
    console.error("[KYB Refresh Token]", error);
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}
