import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const conn = await prisma.brokerConnection.findFirst({
    where: { id, userId: userId! },
    select: {
      id: true, broker: true, displayName: true, accountId: true, environment: true,
      isActive: true, lastSyncAt: true, lastSyncStatus: true, lastSyncCount: true,
      tokenExpiresAt: true, createdAt: true,
    },
  });
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(conn);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const conn = await prisma.brokerConnection.findFirst({ where: { id, userId: userId! } });
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { displayName, accountId, environment, apiKey, apiSecret, credentials, accessToken, refreshToken, tokenExpiresAt, isActive } = await req.json();

  const updated = await prisma.brokerConnection.update({
    where: { id },
    data: {
      displayName: displayName ?? undefined,
      accountId: accountId ?? undefined,
      environment: environment ?? undefined,
      apiKey: apiKey ?? undefined,
      apiSecret: apiSecret ?? undefined,
      credentials: credentials ?? undefined,
      accessToken: accessToken ?? undefined,
      refreshToken: refreshToken ?? undefined,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
      isActive: isActive ?? undefined,
    },
    select: { id: true, broker: true, displayName: true, accountId: true, environment: true, isActive: true, lastSyncAt: true, lastSyncStatus: true, lastSyncCount: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const conn = await prisma.brokerConnection.findFirst({ where: { id, userId: userId! } });
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.brokerConnection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
