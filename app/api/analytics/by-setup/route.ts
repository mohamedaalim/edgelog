import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { calcProfitFactor } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: { setupType: true, netPnl: true, grossPnl: true, rRatio: true, holdDuration: true },
  });

  const map = new Map<string, { pnl: number; gross: number; count: number; wins: number; r: number; grossList: number[] }>();
  for (const t of trades) {
    const key = t.setupType ?? "No Setup";
    const cur = map.get(key) ?? { pnl: 0, gross: 0, count: 0, wins: 0, r: 0, grossList: [] };
    map.set(key, {
      pnl: cur.pnl + t.netPnl, gross: cur.gross + t.grossPnl, count: cur.count + 1,
      wins: cur.wins + (t.netPnl > 0 ? 1 : 0), r: cur.r + (t.rRatio ?? 0),
      grossList: [...cur.grossList, t.grossPnl],
    });
  }

  const data = Array.from(map.entries()).map(([setup, v]) => ({
    setup, pnl: v.pnl, count: v.count,
    winRate: (v.wins / v.count) * 100,
    avgR: v.r / v.count,
    profitFactor: calcProfitFactor(v.grossList.map((g) => ({ grossPnl: g, netPnl: g, commission: 0, rRatio: null }))),
    ev: v.pnl / v.count,
    hasEdge: (v.wins / v.count) > 0.5 && v.pnl > 0,
  })).sort((a, b) => b.winRate - a.winRate);

  return NextResponse.json(data);
}
