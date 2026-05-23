import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail, isMailConfigured, buildDailyDigestEmail, buildDrawdownAlertEmail } from "@/lib/mailer";
import { startOfDay, endOfDay, startOfWeek, format } from "date-fns";

// Vercel cron fires GET — auth via Authorization header (Vercel injects CRON_SECRET automatically)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDigest(req);
}

// Manual trigger via POST (scripts, GitHub Actions, etc.)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDigest(req);
}

async function runDigest(_req: NextRequest) {
  if (!isMailConfigured()) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 503 });
  }

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const dateStr = format(today, "yyyy-MM-dd");

  const users = await prisma.user.findMany({
    where: { emailAlerts: true },
    select: {
      id: true,
      name: true,
      email: true,
      alertEmail: true,
      alertDailyRecap: true,
      alertDrawdownPct: true,
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      const toAddr = user.alertEmail ?? user.email;

      // ── Today's closed trades ────────────────────────────────────────────────
      const todayTrades = await prisma.trade.findMany({
        where: { userId: user.id, status: "CLOSED", entryTime: { gte: dayStart, lte: dayEnd } },
        select: { netPnl: true, rRatio: true, commission: true, symbol: true, setupType: true },
      });

      // ── Daily recap email ────────────────────────────────────────────────────
      if (user.alertDailyRecap && todayTrades.length > 0) {
        // All-time trades for cumulative P&L + streak
        const allTrades = await prisma.trade.findMany({
          where: { userId: user.id, status: "CLOSED" },
          select: { netPnl: true },
          orderBy: { entryTime: "asc" },
        });

        // Week-to-date trades
        const wtdTrades = await prisma.trade.findMany({
          where: { userId: user.id, status: "CLOSED", entryTime: { gte: weekStart, lte: dayEnd } },
          select: { netPnl: true },
        });

        // Journal entry for today (grade)
        const journal = await prisma.journalEntry.findUnique({
          where: { userId_date: { userId: user.id, date: dayStart } },
          select: { grade: true },
        });

        // Aggregate today
        const totalPnl = todayTrades.reduce((s, t) => s + t.netPnl, 0);
        const winners = todayTrades.filter((t) => t.netPnl > 0);
        const losers = todayTrades.filter((t) => t.netPnl < 0);
        const winRate = todayTrades.length > 0 ? (winners.length / todayTrades.length) * 100 : 0;
        const bestTrade = winners.length > 0 ? Math.max(...winners.map((t) => t.netPnl)) : 0;
        const worstTrade = losers.length > 0 ? Math.min(...losers.map((t) => t.netPnl)) : 0;
        const totalCommission = todayTrades.reduce((s, t) => s + (t.commission ?? 0), 0);

        const rValues = todayTrades.map((t) => t.rRatio).filter((r): r is number => r !== null);
        const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : null;

        const cumulativePnl = allTrades.reduce((s, t) => s + t.netPnl, 0);
        const wtdPnl = wtdTrades.reduce((s, t) => s + t.netPnl, 0);

        // Win/loss streak from end of all-time trades
        let streak: { type: "win" | "loss"; count: number } | null = null;
        if (allTrades.length > 0) {
          const last = allTrades[allTrades.length - 1].netPnl >= 0 ? "win" : "loss";
          let count = 0;
          for (let i = allTrades.length - 1; i >= 0; i--) {
            const isWin = allTrades[i].netPnl >= 0;
            if ((last === "win" && isWin) || (last === "loss" && !isWin)) count++;
            else break;
          }
          if (count >= 2) streak = { type: last, count };
        }

        // Top symbol
        const symbolMap: Record<string, number> = {};
        for (const t of todayTrades) {
          symbolMap[t.symbol] = (symbolMap[t.symbol] ?? 0) + t.netPnl;
        }
        const topEntry = Object.entries(symbolMap).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
        const topSymbol = topEntry ? { symbol: topEntry[0], pnl: topEntry[1] } : null;

        // Setup breakdown
        const setupMap: Record<string, { pnl: number; count: number }> = {};
        for (const t of todayTrades) {
          const key = t.setupType ?? "No Setup";
          if (!setupMap[key]) setupMap[key] = { pnl: 0, count: 0 };
          setupMap[key].pnl += t.netPnl;
          setupMap[key].count++;
        }
        const setupBreakdown = Object.entries(setupMap)
          .map(([setup, v]) => ({ setup, ...v }))
          .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

        const html = buildDailyDigestEmail({
          name: user.name ?? "Trader",
          date: format(today, "EEEE, MMMM d, yyyy"),
          totalPnl,
          trades: todayTrades.length,
          winRate,
          bestTrade,
          worstTrade,
          cumulativePnl,
          avgR,
          commission: totalCommission,
          wtdPnl,
          streak,
          topSymbol,
          setupBreakdown,
          grade: journal?.grade ?? null,
          replayUrl: `${appUrl}/replay?date=${dateStr}`,
          appUrl,
        });

        await sendMail({
          to: toAddr,
          subject: `EdgeLog — ${format(today, "MMM d")} · ${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)} · ${todayTrades.length} trade${todayTrades.length !== 1 ? "s" : ""}`,
          html,
        });
        sent++;
      }

      // ── Drawdown alert ───────────────────────────────────────────────────────
      if (user.alertDrawdownPct && user.alertDrawdownPct > 0) {
        const allTrades = await prisma.trade.findMany({
          where: { userId: user.id, status: "CLOSED" },
          select: { netPnl: true },
          orderBy: { entryTime: "asc" },
        });
        let peak = 0;
        let cum = 0;
        for (const t of allTrades) {
          cum += t.netPnl;
          if (cum > peak) peak = cum;
        }
        const drawdownPct = peak > 0 ? ((peak - cum) / peak) * 100 : 0;
        if (drawdownPct >= user.alertDrawdownPct) {
          const html = buildDrawdownAlertEmail({
            name: user.name ?? "Trader",
            drawdownPct,
            drawdownAmt: cum - peak,
            threshold: user.alertDrawdownPct,
          });
          await sendMail({
            to: toAddr,
            subject: `⚠️ EdgeLog — Drawdown Alert ${drawdownPct.toFixed(1)}%`,
            html,
          });
          sent++;
        }
      }
    } catch (e: unknown) {
      errors.push(`${user.email}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ sent, errors, users: users.length });
}
