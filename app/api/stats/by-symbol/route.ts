import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const rangeKey = searchParams.get("range") ?? "all";
  const { from, to } = getDateRange(rangeKey);

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: { symbol: true, netPnl: true, rRatio: true },
  });

  const map = new Map<string, { pnl: number; count: number; wins: number; r: number }>();
  for (const t of trades) {
    const cur = map.get(t.symbol) ?? { pnl: 0, count: 0, wins: 0, r: 0 };
    map.set(t.symbol, {
      pnl: cur.pnl + t.netPnl,
      count: cur.count + 1,
      wins: cur.wins + (t.netPnl > 0 ? 1 : 0),
      r: cur.r + (t.rRatio ?? 0),
    });
  }

  const data = Array.from(map.entries())
    .map(([symbol, { pnl, count, wins, r }]) => ({
      symbol,
      pnl,
      count,
      winRate: (wins / count) * 100,
      avgR: r / count,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 10);

  return NextResponse.json(data);
}
