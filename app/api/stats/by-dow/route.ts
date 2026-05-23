import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function localWeekday(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).formatToParts(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
}

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const rangeKey = searchParams.get("range") ?? "all";
  const { from, to } = getDateRange(rangeKey);

  const [trades, user] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
      select: { netPnl: true, entryTime: true },
    }),
    prisma.user.findUnique({ where: { id: userId! }, select: { timezone: true } }),
  ]);

  const tz = user?.timezone ?? "America/New_York";
  const buckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const d of DAYS) buckets[d] = { pnl: 0, count: 0, wins: 0 };

  for (const t of trades) {
    const dow = localWeekday(t.entryTime, tz);
    const key = DAYS[dow - 1];
    if (key && buckets[key]) {
      buckets[key].pnl += t.netPnl;
      buckets[key].count++;
      if (t.netPnl > 0) buckets[key].wins++;
    }
  }

  const data = DAYS.map((day) => ({
    day,
    pnl: buckets[day].pnl,
    count: buckets[day].count,
    winRate: buckets[day].count > 0 ? (buckets[day].wins / buckets[day].count) * 100 : 0,
  }));

  return NextResponse.json(data);
}
