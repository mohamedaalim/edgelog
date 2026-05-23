import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import {
  startOfYear, endOfYear, startOfMonth, endOfMonth,
  eachMonthOfInterval, format, getDaysInMonth, setDate,
} from "date-fns";
import { calcWinRate, calcProfitFactor, calcMaxDrawdown } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const accountId = searchParams.get("accountId");

  const from = startOfYear(new Date(year, 0, 1));
  const to = endOfYear(new Date(year, 0, 1));

  const trades = await prisma.trade.findMany({
    where: {
      userId: userId!,
      status: "CLOSED",
      entryTime: { gte: from, lte: to },
      ...(accountId ? { accountId } : {}),
    },
    select: { netPnl: true, grossPnl: true, commission: true, rRatio: true, entryTime: true },
    orderBy: { entryTime: "asc" },
  });

  // Group by month
  const months = eachMonthOfInterval({ start: from, end: to });

  const monthData = months.map((monthDate) => {
    const ms = startOfMonth(monthDate);
    const me = endOfMonth(monthDate);
    const mt = trades.filter((t) => t.entryTime >= ms && t.entryTime <= me);

    const netPnl = mt.reduce((s, t) => s + t.netPnl, 0);
    const grossPnl = mt.reduce((s, t) => s + t.grossPnl, 0);
    const commissions = mt.reduce((s, t) => s + t.commission, 0);
    const winners = mt.filter((t) => t.netPnl > 0).length;
    const losers = mt.filter((t) => t.netPnl < 0).length;
    const winRate = calcWinRate(mt);
    const profitFactor = calcProfitFactor(mt);
    const avgR = mt.length > 0 ? mt.reduce((s, t) => s + (t.rRatio ?? 0), 0) / mt.length : 0;

    // Daily equity for sparkline
    const byDay = new Map<string, number>();
    for (const t of mt) {
      const key = format(t.entryTime, "d");
      byDay.set(key, (byDay.get(key) ?? 0) + t.netPnl);
    }
    let cum = 0;
    const sparkline = Array.from({ length: getDaysInMonth(monthDate) }, (_, i) => {
      cum += byDay.get(String(i + 1)) ?? 0;
      return cum;
    });

    return {
      month: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMM"),
      netPnl, grossPnl, commissions,
      totalTrades: mt.length, winners, losers,
      winRate, profitFactor, avgR,
      sparkline,
      hasTrades: mt.length > 0,
    };
  });

  // Year-level stats
  const yearNetPnl = monthData.reduce((s, m) => s + m.netPnl, 0);
  const profitableMonths = monthData.filter((m) => m.netPnl > 0).length;
  const bestMonth = monthData.reduce((a, b) => (a.netPnl > b.netPnl ? a : b), monthData[0]);
  const worstMonth = monthData.reduce((a, b) => (a.netPnl < b.netPnl ? a : b), monthData[0]);
  const allTradesMeta = { winRate: calcWinRate(trades), profitFactor: calcProfitFactor(trades), totalTrades: trades.length };
  let cum = 0;
  const equityCurve = trades.map((t) => { cum += t.netPnl; return cum; });
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve);

  return NextResponse.json({
    year, months: monthData,
    yearNetPnl, profitableMonths,
    bestMonth: bestMonth?.month, worstMonth: worstMonth?.month,
    ...allTradesMeta, maxDrawdown, maxDrawdownPct,
  });
}
