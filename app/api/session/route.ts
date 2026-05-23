import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { sendPushNotification, isPushConfigured } from "@/lib/webpush";

// GET /api/session — returns today's trading session stats + account limits
export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const account = await prisma.account.findFirst({
    where: { userId: userId!, isDefault: true },
    select: {
      id: true,
      name: true,
      dailyLossLimit: true,
      maxDailyTrades: true,
      currentBalance: true,
    },
  });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const trades = await prisma.trade.findMany({
    where: {
      userId: userId!,
      accountId: account.id,
      entryTime: { gte: todayStart },
      status: "CLOSED",
    },
    select: {
      netPnl: true,
      side: true,
      entryTime: true,
    },
    orderBy: { entryTime: "asc" },
  });

  // Also count open positions today
  const openCount = await prisma.trade.count({
    where: {
      userId: userId!,
      accountId: account.id,
      entryTime: { gte: todayStart },
      status: "OPEN",
    },
  });

  const totalTrades = trades.length + openCount;
  const netPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const losses = trades.filter((t) => t.netPnl < 0).length;
  const winRate = trades.length > 0 ? wins / trades.length : null;

  const dailyLossLimit = account.dailyLossLimit ?? null;
  const maxDailyTrades = account.maxDailyTrades ?? null;

  // Determine status
  let status: "safe" | "warning" | "halt" = "safe";
  if (dailyLossLimit !== null && netPnl <= -dailyLossLimit) {
    status = "halt";
  } else if (dailyLossLimit !== null && netPnl <= -dailyLossLimit * 0.75) {
    status = "warning";
  } else if (maxDailyTrades !== null && totalTrades >= maxDailyTrades) {
    status = "halt";
  } else if (maxDailyTrades !== null && totalTrades >= maxDailyTrades * 0.8) {
    status = "warning";
  }

  // Fire push if transitioning into halt (only once per day, keyed by a simple check)
  if (status === "halt" && isPushConfigured()) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: userId! } });
    if (subs.length) {
      const haltReason =
        dailyLossLimit !== null && netPnl <= -dailyLossLimit
          ? `Daily loss limit of $${dailyLossLimit} reached`
          : `Max ${maxDailyTrades} trades reached for today`;
      // Best-effort — don't block response
      Promise.allSettled(
        subs.map((s) =>
          sendPushNotification(s, {
            title: "Daily Limit Hit — Stop Trading",
            body: haltReason,
            url: "/dashboard",
            tag: "session-halt",
          })
        )
      ).catch(() => {});
    }
  }

  return NextResponse.json({
    accountId: account.id,
    accountName: account.name,
    netPnl,
    totalTrades,
    wins,
    losses,
    winRate,
    openPositions: openCount,
    dailyLossLimit,
    maxDailyTrades,
    status,
  });
}

// PATCH /api/session — update account daily limits
export async function PATCH(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { dailyLossLimit, maxDailyTrades } = await req.json();

  const account = await prisma.account.findFirst({
    where: { userId: userId!, isDefault: true },
    select: { id: true },
  });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  await prisma.account.update({
    where: { id: account.id },
    data: {
      dailyLossLimit: dailyLossLimit != null ? parseFloat(dailyLossLimit) || null : null,
      maxDailyTrades: maxDailyTrades != null ? parseInt(maxDailyTrades) || null : null,
    },
  });

  return NextResponse.json({ ok: true });
}
