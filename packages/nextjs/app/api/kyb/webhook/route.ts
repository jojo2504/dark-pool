/**
 * POST /api/kyb/webhook
 * 📋 ROADMAP: Will handle KYB provider webhooks when real verification is integrated.
 * Currently unused — KYB approval is handled via /api/kyb/demo-approve.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}
