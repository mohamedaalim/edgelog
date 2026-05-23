import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import {
  calcWinRate, calcProfitFactor, calcMaxDrawdown,
  calcSharpeRatio, calcSharpeRatioPct, calcKellyCriterion, calcConsecutiveStreaks, calcExpectedValue,
} from "@/lib/calculations";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "all";
  const { from, to } = getDateRange(range);

  const [trades, user] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
      select: { netPnl: true, grossPnl: true, commission: true, rRatio: true, entryTime: true, holdDuration: true },
      orderBy: { entryTime: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId! }, select: { accountSize: true } }),
  ]);

  if (!trades.length) return NextResponse.json({ empty: true });

  const winningTrades = trades.filter((t) => t.netPnl > 0);
  const losingTrades = trades.filter((t) => t.netPnl < 0);
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
  const commissions = trades.reduce((s, t) => s + t.commission, 0);
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.netPnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + t.netPnl, 0) / losingTrades.length) : 0;
  const winRate = calcWinRate(trades);
  const profitFactor = calcProfitFactor(trades);
  const ev = calcExpectedValue(trades);
  const kelly = calcKellyCriterion(winRate, avgWin, avgLoss);
  const { maxWinStreak, maxLossStreak } = calcConsecutiveStreaks(trades);

  // Equity + drawdown
  let cum = 0;
  const equityCurve = trades.map((t) => { cum += t.netPnl; return cum; });
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve);

  // Daily returns for Sharpe
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const key = format(t.entryTime, "yyyy-MM-dd");
    byDay.set(key, (byDay.get(key) ?? 0) + t.netPnl);
  }
  const dailyReturns = Array.from(byDay.values());
  const sharpe = calcSharpeRatio(dailyReturns);
  const sharpeStartEquity = (user?.accountSize ?? 0) > 0 ? user!.accountSize : (equityCurve[0] ?? 0);
  const sharpePct = calcSharpeRatioPct(trades, sharpeStartEquity);

  // Drawdown periods
  const drawdownPeriods: { start: string; end: string; depth: number; depthPct: number }[] = [];
  let ddPeak = 0; let ddPeakDate = ""; let inDrawdown = false; let ddStart = ""; let ddTrough = 0;
  for (let i = 0; i < trades.length; i++) {
    const cur = equityCurve[i] ?? 0;
    const dateStr = format(trades[i].entryTime, "yyyy-MM-dd");
    if (cur > ddPeak) {
      if (inDrawdown) {
        const depth = ddPeak - ddTrough;
        drawdownPeriods.push({ start: ddStart, end: dateStr, depth, depthPct: ddPeak > 0 ? (depth / ddPeak) * 100 : 0 });
        inDrawdown = false;
      }
      ddPeak = cur; ddPeakDate = dateStr;
    } else if (cur < ddPeak) {
      if (!inDrawdown) { inDrawdown = true; ddStart = ddPeakDate; ddTrough = cur; }
      else if (cur < ddTrough) { ddTrough = cur; }
    }
  }

  // R-distribution
  const rBuckets: Record<string, number> = {};
  for (const t of trades) {
    if (t.rRatio == null) continue;
    const bucket = `${Math.floor(t.rRatio)}`;
    rBuckets[bucket] = (rBuckets[bucket] ?? 0) + 1;
  }
  const rDistribution = Object.entries(rBuckets).map(([r, count]) => ({ r: parseFloat(r), count })).sort((a, b) => a.r - b.r);

  // Monthly returns
  const byMonth = new Map<string, number>();
  for (const t of trades) {
    const key = format(t.entryTime, "yyyy-MM");
    byMonth.set(key, (byMonth.get(key) ?? 0) + t.netPnl);
  }
  const monthlyReturns = Array.from(byMonth.entries()).map(([month, pnl]) => ({ month, pnl })).sort((a, b) => a.month.localeCompare(b.month));

  const avgHoldDuration = trades.filter((t) => t.holdDuration).reduce((s, t) => s + (t.holdDuration ?? 0), 0) / (trades.filter((t) => t.holdDuration).length || 1);

  return NextResponse.json({
    totalTrades: trades.length,
    winners: winningTrades.length,
    losers: losingTrades.length,
    netPnl, grossPnl, commissions,
    winRate, profitFactor, ev, kelly, sharpe, sharpePct,
    avgWin, avgLoss,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.netPnl)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.netPnl)) : 0,
    maxDrawdown, maxDrawdownPct, maxWinStreak, maxLossStreak,
    avgHoldDuration, totalR: trades.reduce((s, t) => s + (t.rRatio ?? 0), 0),
    equityCurve: trades.map((t, i) => ({ date: format(t.entryTime, "yyyy-MM-dd"), cumulative: equityCurve[i] ?? 0 })),
    rDistribution, monthlyReturns, drawdownPeriods: drawdownPeriods.slice(0, 10),
  });
}
