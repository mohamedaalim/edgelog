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
    select: { netPnl: true, entryTime: true },
  });

  // Build 30-min buckets 9:30 – 16:00
  const buckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (let h = 9; h <= 15; h++) {
    for (const m of [0, 30]) {
      if (h === 9 && m === 0) continue;
      const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      buckets[key] = { pnl: 0, count: 0, wins: 0 };
    }
  }

  for (const t of trades) {
    const h = t.entryTime.getUTCHours() - 5; // Adjust for ET (rough)
    const m = t.entryTime.getUTCMinutes() < 30 ? 0 : 30;
    const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (buckets[key]) {
      buckets[key].pnl += t.netPnl;
      buckets[key].count++;
      if (t.netPnl > 0) buckets[key].wins++;
    }
  }

  const data = Object.entries(buckets).map(([time, { pnl, count, wins }]) => ({
    time,
    pnl,
    count,
    winRate: count > 0 ? (wins / count) * 100 : 0,
  }));

  return NextResponse.json(data);
}
