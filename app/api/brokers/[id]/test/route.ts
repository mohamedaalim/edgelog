import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getAdapter } from "@/lib/broker-adapters/index";
import type { StoredConnection } from "@/lib/broker-adapters/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const conn = await prisma.brokerConnection.findFirst({ where: { id, userId: userId! } });
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stored: StoredConnection = {
    id: conn.id,
    broker: conn.broker,
    apiKey: conn.apiKey,
    apiSecret: conn.apiSecret,
    accountId: conn.accountId,
    environment: conn.environment,
    credentials: conn.credentials as Record<string, unknown> | null,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    tokenExpiresAt: conn.tokenExpiresAt,
  };

  try {
    const adapter = getAdapter(stored);
    const result = await adapter.testConnection();
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, message: (e as Error).message });
  }
}
