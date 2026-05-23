import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format — use YYYY-MM-DD" }, { status: 400 });
  }

  let from: Date, to: Date;
  try {
    const parsed = parseISO(date);
    if (isNaN(parsed.getTime())) throw new Error();
    from = startOfDay(parsed);
    to = endOfDay(parsed);
  } catch {
    return NextResponse.json({ error: "Invalid date value" }, { status: 400 });
  }

  const [trades, journal] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: userId!, entryTime: { gte: from, lte: to } },
      select: {
        id: true,
        symbol: true,
        assetClass: true,
        side: true,
        status: true,
        quantity: true,
        entryPrice: true,
        exitPrice: true,
        stopLoss: true,
        takeProfit: true,
        entryTime: true,
        exitTime: true,
        holdDuration: true,
        grossPnl: true,
        netPnl: true,
        commission: true,
        rRatio: true,
        maxAdverseExcursion: true,
        maxFavorableExcursion: true,
        setupType: true,
        timeframe: true,
        marketCondition: true,
        emotionBefore: true,
        emotionAfter: true,
        confidence: true,
        mistakeTags: true,
        setupTags: true,
        notes: true,
        lessonsLearned: true,
        rulesFollowed: true,
        account: { select: { name: true, broker: true } },
        executions: {
          select: { id: true, type: true, side: true, quantity: true, price: true, timestamp: true, commission: true },
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { entryTime: "asc" },
    }),
    prisma.journalEntry.findFirst({
      where: { userId: userId!, date: { gte: from, lte: to } },
      select: {
        marketBias: true,
        prePlanning: true,
        postReview: true,
        whatWentWell: true,
        whatWentWrong: true,
        mood: true,
        energyLevel: true,
        focus: true,
        grade: true,
        maxLossLimit: true,
        targetProfit: true,
        rulesFollowed: true,
        rulesBroken: true,
      },
    }),
  ]);

  // Build chronological equity curve using entry times
  let cumPnl = 0;
  const equityCurve: { time: string; pnl: number; cumPnl: number; symbol: string }[] = [];
  for (const t of trades) {
    cumPnl += t.netPnl;
    equityCurve.push({
      time: format(t.exitTime ?? t.entryTime, "HH:mm"),
      pnl: t.netPnl,
      cumPnl,
      symbol: t.symbol,
    });
  }

  // Session stats
  const closed = trades.filter((t) => t.status === "CLOSED");
  const winners = closed.filter((t) => t.netPnl > 0);
  const losers = closed.filter((t) => t.netPnl < 0);
  const totalPnl = closed.reduce((s, t) => s + t.netPnl, 0);
  const totalCommissions = trades.reduce((s, t) => s + t.commission, 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.netPnl, 0) / losers.length : 0;
  const avgR = closed.length > 0 ? closed.reduce((s, t) => s + (t.rRatio ?? 0), 0) / closed.length : 0;

  // Max intraday drawdown from cumPnl
  let peak = 0;
  let maxDD = 0;
  for (const p of equityCurve) {
    if (p.cumPnl > peak) peak = p.cumPnl;
    const dd = peak - p.cumPnl;
    if (dd > maxDD) maxDD = dd;
  }

  return NextResponse.json({
    date,
    trades,
    equityCurve,
    journal,
    stats: {
      totalTrades: trades.length,
      closedTrades: closed.length,
      openTrades: trades.length - closed.length,
      winners: winners.length,
      losers: losers.length,
      winRate,
      totalPnl,
      totalCommissions,
      avgWin,
      avgLoss,
      avgR,
      maxIntradayDrawdown: maxDD,
      bestTrade: winners.length > 0 ? Math.max(...winners.map((t) => t.netPnl)) : 0,
      worstTrade: losers.length > 0 ? Math.min(...losers.map((t) => t.netPnl)) : 0,
    },
  });
}
