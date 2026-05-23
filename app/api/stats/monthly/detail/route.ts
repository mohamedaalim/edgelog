import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { startOfMonth, endOfMonth, parseISO, format, eachWeekOfInterval, endOfWeek, startOfWeek } from "date-fns";
import { calcWinRate, calcProfitFactor, calcMaxDrawdown, calcConsecutiveStreaks } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "YYYY-MM"
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Invalid month format — use YYYY-MM" }, { status: 400 });

  let from: Date, to: Date;
  try {
    from = startOfMonth(parseISO(`${month}-01`));
    to = endOfMonth(parseISO(`${month}-01`));
    if (isNaN(from.getTime())) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid month value" }, { status: 400 });
  }

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: {
      id: true, symbol: true, side: true, setupType: true,
      netPnl: true, grossPnl: true, commission: true, rRatio: true,
      entryTime: true, exitTime: true, holdDuration: true,
    },
    orderBy: { entryTime: "asc" },
  });

  // Daily P&L
  const byDay = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of trades) {
    const key = format(t.entryTime, "yyyy-MM-dd");
    const cur = byDay.get(key) ?? { pnl: 0, count: 0, wins: 0 };
    byDay.set(key, { pnl: cur.pnl + t.netPnl, count: cur.count + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) });
  }
  let cum = 0;
  const dailyPnl = Array.from(byDay.entries()).map(([date, { pnl, count, wins }]) => {
    cum += pnl;
    return { date, pnl, count, winRate: count > 0 ? (wins / count) * 100 : 0, cumulative: cum };
  });

  // Weekly P&L
  const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
  const weeklyPnl = weeks.map((ws) => {
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const wt = trades.filter((t) => t.entryTime >= ws && t.entryTime <= we);
    return {
      week: format(ws, "MMM d"),
      pnl: wt.reduce((s, t) => s + t.netPnl, 0),
      count: wt.length,
    };
  });

  // By symbol
  const symbolMap = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of trades) {
    const cur = symbolMap.get(t.symbol) ?? { pnl: 0, count: 0, wins: 0 };
    symbolMap.set(t.symbol, { pnl: cur.pnl + t.netPnl, count: cur.count + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) });
  }
  const bySymbol = Array.from(symbolMap.entries())
    .map(([symbol, { pnl, count, wins }]) => ({ symbol, pnl, count, winRate: count > 0 ? (wins / count) * 100 : 0 }))
    .sort((a, b) => b.pnl - a.pnl).slice(0, 8);

  // By setup
  const setupMap = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of trades) {
    const key = t.setupType ?? "No Setup";
    const cur = setupMap.get(key) ?? { pnl: 0, count: 0, wins: 0 };
    setupMap.set(key, { pnl: cur.pnl + t.netPnl, count: cur.count + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) });
  }
  const bySetup = Array.from(setupMap.entries())
    .map(([setup, { pnl, count, wins }]) => ({ setup, pnl, count, winRate: count > 0 ? (wins / count) * 100 : 0 }))
    .sort((a, b) => b.winRate - a.winRate);

  // Core stats
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
  const commissions = trades.reduce((s, t) => s + t.commission, 0);
  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl < 0);
  const equityCurve = trades.map(((cum = 0) => (t: { netPnl: number }) => (cum += t.netPnl))());
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve);
  const { maxWinStreak, maxLossStreak } = calcConsecutiveStreaks(trades);

  return NextResponse.json({
    netPnl, grossPnl, commissions,
    totalTrades: trades.length,
    winners: winners.length, losers: losers.length,
    winRate: calcWinRate(trades),
    profitFactor: calcProfitFactor(trades),
    avgR: trades.length > 0 ? trades.reduce((s, t) => s + (t.rRatio ?? 0), 0) / trades.length : 0,
    bestDay: dailyPnl.length > 0 ? Math.max(...dailyPnl.map((d) => d.pnl)) : 0,
    worstDay: dailyPnl.length > 0 ? Math.min(...dailyPnl.map((d) => d.pnl)) : 0,
    avgDay: dailyPnl.length > 0 ? netPnl / dailyPnl.length : 0,
    bestTrade: winners.length > 0 ? Math.max(...winners.map((t) => t.netPnl)) : 0,
    worstTrade: losers.length > 0 ? Math.min(...losers.map((t) => t.netPnl)) : 0,
    avgWin: winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0,
    avgLoss: losers.length > 0 ? losers.reduce((s, t) => s + t.netPnl, 0) / losers.length : 0,
    maxDrawdown, maxDrawdownPct,
    maxWinStreak, maxLossStreak,
    dailyPnl, weeklyPnl, bySymbol, bySetup,
  });
}
