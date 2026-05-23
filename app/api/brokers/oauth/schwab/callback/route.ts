import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeSchwabCode } from "@/lib/broker-adapters/schwab";

// GET /api/brokers/oauth/schwab/callback?code=...&state=...
// Called by Schwab after user grants authorization
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/settings?tab=Brokers&error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?tab=Brokers&error=missing_params`);
  }

  let connectionId: string;
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    connectionId = decoded.connectionId;
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?tab=Brokers&error=invalid_state`);
  }

  const conn = await prisma.brokerConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!conn?.apiKey || !conn.apiSecret) {
    return NextResponse.redirect(`${appUrl}/settings?tab=Brokers&error=connection_not_found`);
  }

  const redirectUri = `${appUrl}/api/brokers/oauth/schwab/callback`;

  try {
    const tokens = await exchangeSchwabCode(code, conn.apiKey, conn.apiSecret, redirectUri);

    await prisma.brokerConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
    });

    return NextResponse.redirect(`${appUrl}/settings?tab=Brokers&connected=schwab`);
  } catch (e: unknown) {
    const msg = encodeURIComponent((e as Error).message);
    return NextResponse.redirect(`${appUrl}/settings?tab=Brokers&error=${msg}`);
  }
}
