import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — no auth required
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const trade = await prisma.trade.findFirst({
    where: { shareToken: token, isPublic: true },
    select: {
      id: true, symbol: true, assetClass: true, side: true, status: true,
      quantity: true, entryPrice: true, exitPrice: true,
      entryTime: true, exitTime: true, holdDuration: true,
      grossPnl: true, netPnl: true, commission: true,
      rRatio: true, setupType: true, timeframe: true,
      stopLoss: true, takeProfit: true,
      notes: true, lessonsLearned: true,
      mistakeTags: true, setupTags: true,
      emotionBefore: true, emotionAfter: true, confidence: true,
      screenshots: { select: { url: true, label: true }, orderBy: { order: "asc" }, take: 1 },
      user: { select: { name: true } },
    },
  });

  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trade);
}
