import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const challenges = await prisma.propChallenge.findMany({
    where: { userId: userId! },
    orderBy: { createdAt: "desc" },
  });

  // Augment each challenge with today's P&L and live status
  const today = new Date();
  const enriched = await Promise.all(challenges.map(async (c) => {
    if (!c.accountId) return { ...c, todayPnl: 0, totalPnl: 0, drawdownFromPeak: 0 };

    const [todayTrades, allTrades] = await Promise.all([
      prisma.trade.aggregate({
        where: {
          userId: userId!, accountId: c.accountId, status: "CLOSED",
          exitTime: { gte: startOfDay(today), lte: endOfDay(today) },
        },
        _sum: { netPnl: true },
      }),
      prisma.trade.aggregate({
        where: {
          userId: userId!, accountId: c.accountId, status: "CLOSED",
          exitTime: { gte: c.startDate },
        },
        _sum: { netPnl: true },
      }),
    ]);

    const todayPnl = todayTrades._sum.netPnl ?? 0;
    const totalPnl = allTrades._sum.netPnl ?? 0;
    const currentEquity = c.accountSize + totalPnl;
    const drawdownFromPeak = Math.max(0, c.highWaterMark - currentEquity);

    return { ...c, todayPnl, totalPnl, currentEquity, drawdownFromPeak };
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const {
    firm, phase, accountSize, maxDailyLossPct, maxTotalDrawdownPct,
    profitTargetPct, minTradingDays, isTrailingDrawdown, startDate, endDate,
    accountId, notes,
  } = body;

  if (!firm || !accountSize || !maxDailyLossPct || !maxTotalDrawdownPct || !profitTargetPct || !startDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const challenge = await prisma.propChallenge.create({
    data: {
      userId: userId!,
      firm,
      phase: phase ?? "challenge",
      accountSize,
      maxDailyLossPct,
      maxTotalDrawdownPct,
      profitTargetPct,
      minTradingDays,
      isTrailingDrawdown: isTrailingDrawdown ?? false,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      accountId: accountId ?? null,
      notes,
      currentEquity: accountSize,
      highWaterMark: accountSize,
    },
  });

  return NextResponse.json(challenge, { status: 201 });
}
