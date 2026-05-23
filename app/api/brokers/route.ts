import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const connections = await prisma.brokerConnection.findMany({
    where: { userId: userId! },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, broker: true, displayName: true, accountId: true,
      isActive: true, lastSyncAt: true, lastSyncStatus: true, lastSyncCount: true, createdAt: true,
    },
  });
  return NextResponse.json(connections);
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { broker, displayName, apiKey, apiSecret, accountId } = await req.json();
  if (!broker || !displayName) {
    return NextResponse.json({ error: "broker and displayName are required" }, { status: 400 });
  }

  const conn = await prisma.brokerConnection.create({
    data: { userId: userId!, broker, displayName, apiKey, apiSecret, accountId },
    select: { id: true, broker: true, displayName: true, accountId: true, isActive: true, lastSyncAt: true, lastSyncStatus: true, lastSyncCount: true, createdAt: true },
  });
  return NextResponse.json(conn, { status: 201 });
}
