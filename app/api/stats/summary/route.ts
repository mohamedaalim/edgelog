import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { calcWinRate, calcProfitFactor, calcTotalR, calcMaxDrawdown } from "@/lib/calculations";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const rangeKey = searchParams.get("range") ?? "month";
  const accountId = searchParams.get("accountId");
  const { from, to } = getDateRange(rangeKey);

  const where = {
    userId: userId!,
    status: "CLOSED" as const,
    entryTime: { gte: from, lte: to },
    ...(accountId ? { accountId } : {}),
  };

  const trades = await prisma.trade.findMany({
    where,
    select: { netPnl: true, grossPnl: true, commission: true, rRatio: true, entryTime: true },
    orderBy: { entryTime: "asc" },
  });

  const totalTrades = trades.length;
  const winners = trades.filter((t) => t.netPnl > 0).length;
  const losers = trades.filter((t) => t.netPnl < 0).length;
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
  const commissions = trades.reduce((s, t) => s + t.commission, 0);
  const winRate = calcWinRate(trades);
  const profitFactor = calcProfitFactor(trades);
  const totalR = calcTotalR(trades);

  const winningTrades = trades.filter((t) => t.netPnl > 0);
  const losingTrades = trades.filter((t) => t.netPnl < 0);
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.netPnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((s, t) => s + t.netPnl, 0) / losingTrades.length : 0;
  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.netPnl)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.netPnl)) : 0;

  // Equity curve for drawdown
  let cumulative = 0;
  const equityCurve = trades.map((t) => { cumulative += t.netPnl; return cumulative; });
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve);

  return NextResponse.json({
    totalTrades,
    winners,
    losers,
    netPnl,
    grossPnl,
    commissions,
    winRate,
    profitFactor,
    totalR,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    maxDrawdown,
    maxDrawdownPct,
  });
}
