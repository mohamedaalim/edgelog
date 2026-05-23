import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: { symbol: true, netPnl: true, grossPnl: true, rRatio: true, holdDuration: true, side: true },
  });

  const map = new Map<string, { pnl: number; gross: number; count: number; wins: number; r: number; longs: number; shorts: number; best: number; worst: number }>();
  for (const t of trades) {
    const cur = map.get(t.symbol) ?? { pnl: 0, gross: 0, count: 0, wins: 0, r: 0, longs: 0, shorts: 0, best: -Infinity, worst: Infinity };
    map.set(t.symbol, {
      pnl: cur.pnl + t.netPnl, gross: cur.gross + t.grossPnl, count: cur.count + 1,
      wins: cur.wins + (t.netPnl > 0 ? 1 : 0), r: cur.r + (t.rRatio ?? 0),
      longs: cur.longs + (t.side === "LONG" ? 1 : 0), shorts: cur.shorts + (t.side === "SHORT" ? 1 : 0),
      best: Math.max(cur.best, t.netPnl), worst: Math.min(cur.worst, t.netPnl),
    });
  }

  const data = Array.from(map.entries()).map(([symbol, v]) => ({
    symbol, pnl: v.pnl, count: v.count,
    winRate: (v.wins / v.count) * 100,
    avgR: v.r / v.count, avgPnl: v.pnl / v.count,
    longs: v.longs, shorts: v.shorts,
    bestTrade: v.best === -Infinity ? 0 : v.best,
    worstTrade: v.worst === Infinity ? 0 : v.worst,
  })).sort((a, b) => b.pnl - a.pnl);

  return NextResponse.json(data);
}
