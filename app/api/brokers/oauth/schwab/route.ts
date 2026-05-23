import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { buildSchwabAuthUrl } from "@/lib/broker-adapters/schwab";

// GET /api/brokers/oauth/schwab?connectionId={id}
// Returns a redirect URL to initiate Schwab OAuth
export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  const conn = await prisma.brokerConnection.findFirst({
    where: { id: connectionId, userId: userId! },
  });
  if (!conn?.apiKey) {
    return NextResponse.json({ error: "Connection not found or missing Client ID" }, { status: 400 });
  }

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/brokers/oauth/schwab/callback`;

  // State encodes connectionId so the callback knows which connection to update
  const state = Buffer.from(JSON.stringify({ connectionId, userId: userId! })).toString("base64url");

  const authUrl = buildSchwabAuthUrl(conn.apiKey, redirectUri, state);

  return NextResponse.json({ authUrl, redirectUri });
}
