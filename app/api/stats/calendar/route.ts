import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { format, subMonths, startOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get("months") ?? "6");
  const from = subMonths(startOfDay(new Date()), months);

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, entryTime: { gte: from }, status: "CLOSED" },
    select: { entryTime: true, netPnl: true },
  });

  // Group by date
  const byDate = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of trades) {
    const key = format(t.entryTime, "yyyy-MM-dd");
    const cur = byDate.get(key) ?? { pnl: 0, count: 0, wins: 0 };
    byDate.set(key, { pnl: cur.pnl + t.netPnl, count: cur.count + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) });
  }

  const data = Array.from(byDate.entries()).map(([date, { pnl, count, wins }]) => ({
    date, pnl, count, winRate: count > 0 ? (wins / count) * 100 : 0,
  }));

  return NextResponse.json(data);
}
