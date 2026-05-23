import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { parseISO, startOfDay, endOfDay, format } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { date } = await params;

  const day = parseISO(date);
  const from = startOfDay(day);
  const to = endOfDay(day);

  const [entry, trades] = await Promise.all([
    prisma.journalEntry.findFirst({
      where: { userId: userId!, date: from },
    }),
    prisma.trade.findMany({
      where: { userId: userId!, entryTime: { gte: from, lte: to }, status: "CLOSED" },
      select: {
        id: true, symbol: true, side: true, setupType: true,
        entryPrice: true, exitPrice: true, quantity: true,
        netPnl: true, grossPnl: true, commission: true,
        rRatio: true, holdDuration: true, entryTime: true, exitTime: true,
        mistakeTags: true,
      },
      orderBy: { entryTime: "asc" },
    }),
  ]);

  // Auto-compute day stats from trades
  const dayStats = {
    dailyPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    dailyWins: trades.filter((t) => t.netPnl > 0).length,
    dailyLosses: trades.filter((t) => t.netPnl < 0).length,
    totalTrades: trades.length,
    winRate: trades.length > 0 ? (trades.filter((t) => t.netPnl > 0).length / trades.length) * 100 : 0,
    bestTrade: trades.length > 0 ? Math.max(...trades.map((t) => t.netPnl)) : 0,
    worstTrade: trades.length > 0 ? Math.min(...trades.map((t) => t.netPnl)) : 0,
    grossPnl: trades.reduce((s, t) => s + t.grossPnl, 0),
    commissions: trades.reduce((s, t) => s + t.commission, 0),
    profitFactor: (() => {
      const wins = trades.filter((t) => t.grossPnl > 0).reduce((s, t) => s + t.grossPnl, 0);
      const losses = Math.abs(trades.filter((t) => t.grossPnl < 0).reduce((s, t) => s + t.grossPnl, 0));
      return losses > 0 ? wins / losses : wins > 0 ? 999 : 0;
    })(),
    totalR: trades.reduce((s, t) => s + (t.rRatio ?? 0), 0),
  };

  return NextResponse.json({ entry, trades, dayStats });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { date } = await params;

  const day = startOfDay(parseISO(date));
  const body = await req.json();

  const {
    marketBias, prePlanning, postReview,
    whatWentWell, whatWentWrong, tomorrowPlan, grade,
    mood, energyLevel, focus, sleepQuality, stress,
    maxLossLimit, targetProfit, maxTrades,
    rulesFollowed, rulesBroken, tags,
  } = body;

  // Compute daily stats from trades for that day
  const trades = await prisma.trade.findMany({
    where: {
      userId: userId!,
      entryTime: { gte: day, lte: endOfDay(day) },
      status: "CLOSED",
    },
    select: { netPnl: true },
  });

  const dailyPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const dailyWins = trades.filter((t) => t.netPnl > 0).length;
  const dailyLosses = trades.filter((t) => t.netPnl < 0).length;
  const adherenceScore = rulesFollowed && rulesBroken
    ? (rulesFollowed.length / Math.max(rulesFollowed.length + rulesBroken.length, 1)) * 100
    : undefined;

  const entry = await prisma.journalEntry.upsert({
    where: { userId_date: { userId: userId!, date: day } },
    create: {
      userId: userId!, date: day,
      marketBias, prePlanning, postReview,
      whatWentWell, whatWentWrong, tomorrowPlan, grade,
      mood, energyLevel, focus, sleepQuality, stress,
      maxLossLimit, targetProfit, maxTrades,
      rulesFollowed: rulesFollowed ?? [],
      rulesBroken: rulesBroken ?? [],
      tags: tags ?? [],
      dailyPnl, dailyWins, dailyLosses, adherenceScore,
    },
    update: {
      ...(marketBias !== undefined && { marketBias }),
      ...(prePlanning !== undefined && { prePlanning }),
      ...(postReview !== undefined && { postReview }),
      ...(whatWentWell !== undefined && { whatWentWell }),
      ...(whatWentWrong !== undefined && { whatWentWrong }),
      ...(tomorrowPlan !== undefined && { tomorrowPlan }),
      ...(grade !== undefined && { grade }),
      ...(mood !== undefined && { mood }),
      ...(energyLevel !== undefined && { energyLevel }),
      ...(focus !== undefined && { focus }),
      ...(sleepQuality !== undefined && { sleepQuality }),
      ...(stress !== undefined && { stress }),
      ...(maxLossLimit !== undefined && { maxLossLimit }),
      ...(targetProfit !== undefined && { targetProfit }),
      ...(maxTrades !== undefined && { maxTrades }),
      ...(rulesFollowed !== undefined && { rulesFollowed }),
      ...(rulesBroken !== undefined && { rulesBroken }),
      ...(tags !== undefined && { tags }),
      dailyPnl, dailyWins, dailyLosses,
      ...(adherenceScore !== undefined && { adherenceScore }),
    },
  });

  return NextResponse.json(entry);
}
