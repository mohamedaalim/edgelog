import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const trade = await prisma.trade.findFirst({ where: { id, userId: userId! } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find similar by same setup OR same symbol, excluding itself
  const similar = await prisma.trade.findMany({
    where: {
      userId: userId!,
      id: { not: id },
      status: "CLOSED",
      OR: [
        { setupType: trade.setupType ?? undefined, symbol: trade.symbol },
        { setupType: trade.setupType ?? undefined },
        { symbol: trade.symbol, side: trade.side },
      ],
    },
    orderBy: { entryTime: "desc" },
    take: 5,
    select: {
      id: true, symbol: true, side: true, setupType: true, entryTime: true,
      netPnl: true, rRatio: true, holdDuration: true, entryPrice: true, exitPrice: true,
    },
  });

  return NextResponse.json(similar);
}
