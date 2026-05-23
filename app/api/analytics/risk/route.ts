import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { calcKellyCriterion, calcMaxDrawdown } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: { netPnl: true, rRatio: true, entryTime: true, stopLoss: true, entryPrice: true, exitPrice: true, quantity: true, side: true },
    orderBy: { entryTime: "asc" },
  });

  if (!trades.length) return NextResponse.json({ empty: true });

  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl < 0);
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.netPnl, 0) / losers.length) : 0;
  const winRate = trades.length > 0 ? winners.length / trades.length : 0;
  const kelly = calcKellyCriterion(winRate * 100, avgWin, avgLoss);

  // MAE / MFE approximation from R-ratio distribution
  const rValues = trades.filter((t) => t.rRatio != null).map((t) => t.rRatio!);
  const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0;
  const negRValues = rValues.filter((r) => r < 0);
  const posRValues = rValues.filter((r) => r > 0);
  const avgMae = negRValues.length > 0 ? Math.abs(negRValues.reduce((a, b) => a + b, 0) / negRValues.length) : 0;
  const avgMfe = posRValues.length > 0 ? posRValues.reduce((a, b) => a + b, 0) / posRValues.length : 0;

  // Equity curve + drawdown
  let cum = 0;
  const equityCurve = trades.map((t) => { cum += t.netPnl; return cum; });
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve);

  // Risk of ruin (simplified — probability of losing 50% of account)
  // Using formula: ((1 - winRate) / winRate) ^ (ruinThreshold / avgBet)
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 1;
  const riskOfRuin = winRate > 0 && winRate < 1
    ? Math.pow((1 - winRate) / winRate, 20) * (payoffRatio < 1 ? 1 : 1 / payoffRatio)
    : winRate === 0 ? 1 : 0;

  // Consecutive loss analysis — breakeven (netPnl===0) resets neither streak
  let maxConsecLoss = 0; let curConsecLoss = 0;
  let maxConsecWin = 0; let curConsecWin = 0;
  for (const t of trades) {
    if (t.netPnl > 0) { curConsecWin++; curConsecLoss = 0; maxConsecWin = Math.max(maxConsecWin, curConsecWin); }
    else if (t.netPnl < 0) { curConsecLoss++; curConsecWin = 0; maxConsecLoss = Math.max(maxConsecLoss, curConsecLoss); }
  }

  // Daily P&L for volatility calculation
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const key = t.entryTime.toISOString().split("T")[0];
    byDay.set(key, (byDay.get(key) ?? 0) + t.netPnl);
  }
  const dailyPnls = Array.from(byDay.values());
  const meanDaily = dailyPnls.reduce((a, b) => a + b, 0) / (dailyPnls.length || 1);
  const variance = dailyPnls.reduce((s, v) => s + (v - meanDaily) ** 2, 0) / (dailyPnls.length || 1);
  const dailyVolatility = Math.sqrt(variance);

  // Drawdown distribution — how often drawdowns of various sizes occur
  const ddSizes = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
  let peakVal = 0;
  const ddEvents: number[] = [];
  let inDD = false; let ddLow = 0;
  for (const val of equityCurve) {
    if (val > peakVal) {
      if (inDD && peakVal > 0) { ddEvents.push((peakVal - ddLow) / peakVal); }
      peakVal = val; inDD = false; ddLow = val;
    } else if (val < peakVal) { inDD = true; ddLow = Math.min(ddLow, val); }
  }
  const ddDistribution = ddSizes.map((threshold) => ({
    threshold: threshold * 100,
    occurrences: ddEvents.filter((d) => d >= threshold).length,
  }));

  // R multiples histogram
  const rBuckets: Record<string, number> = { "<-3": 0, "-3 to -2": 0, "-2 to -1": 0, "-1 to 0": 0, "0 to 1": 0, "1 to 2": 0, "2 to 3": 0, ">3": 0 };
  for (const r of rValues) {
    if (r < -3) rBuckets["<-3"]++;
    else if (r < -2) rBuckets["-3 to -2"]++;
    else if (r < -1) rBuckets["-2 to -1"]++;
    else if (r < 0) rBuckets["-1 to 0"]++;
    else if (r < 1) rBuckets["0 to 1"]++;
    else if (r < 2) rBuckets["1 to 2"]++;
    else if (r < 3) rBuckets["2 to 3"]++;
    else rBuckets[">3"]++;
  }
  const rHistogram = Object.entries(rBuckets).map(([range, count]) => ({ range, count }));

  return NextResponse.json({
    avgWin, avgLoss, winRate: winRate * 100, kelly, avgR, avgMae, avgMfe,
    maxDrawdown, maxDrawdownPct, riskOfRuin: Math.min(riskOfRuin * 100, 100),
    maxConsecLoss, maxConsecWin, dailyVolatility, payoffRatio,
    ddDistribution, rHistogram,
    totalTrades: trades.length,
  });
}
