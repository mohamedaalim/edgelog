import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const rangeKey = searchParams.get("range") ?? "all";
  const accountId = searchParams.get("accountId");
  const { from, to } = getDateRange(rangeKey);

  const trades = await prisma.trade.findMany({
    where: {
      userId: userId!,
      status: "CLOSED",
      entryTime: { gte: from, lte: to },
      ...(accountId ? { accountId } : {}),
    },
    select: { netPnl: true, entryTime: true },
    orderBy: { entryTime: "asc" },
  });

  // Group by date
  const byDate = new Map<string, number>();
  for (const t of trades) {
    const key = format(t.entryTime, "yyyy-MM-dd");
    byDate.set(key, (byDate.get(key) ?? 0) + t.netPnl);
  }

  let cumulative = 0;
  const data = Array.from(byDate.entries()).map(([date, pnl]) => {
    cumulative += pnl;
    return { date, dailyPnl: pnl, cumulative };
  });

  return NextResponse.json(data);
}
