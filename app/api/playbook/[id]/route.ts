import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { format } from "date-fns";
import { calcProfitFactor } from "@/lib/calculations";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const playbook = await prisma.playbook.findUnique({
    where: { id },
    include: {
      trades: {
        where: { status: "CLOSED" },
        select: {
          id: true, symbol: true, side: true, netPnl: true, grossPnl: true, commission: true,
          rRatio: true, entryTime: true, holdDuration: true,
          rulesFollowed: true, rulesBroken: true, setupType: true,
        },
        orderBy: { entryTime: "desc" },
      },
    },
  });

  if (!playbook || playbook.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const t = playbook.trades;
  const winners = t.filter((x) => x.netPnl > 0);
  const losers = t.filter((x) => x.netPnl < 0);
  const netPnl = t.reduce((s, x) => s + x.netPnl, 0);
  const avgWin = winners.length > 0 ? winners.reduce((s, x) => s + x.netPnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, x) => s + x.netPnl, 0) / losers.length) : 0;
  const profitFactor = calcProfitFactor(t.map((x) => ({ netPnl: x.netPnl, grossPnl: x.grossPnl, commission: x.commission, rRatio: x.rRatio })));
  const avgR = t.length > 0 ? t.reduce((s, x) => s + (x.rRatio ?? 0), 0) / t.length : 0;
  const adherence = t.length > 0 ? (t.filter((x) => x.rulesFollowed === true).length / t.length) * 100 : null;

  // Rules broken frequency
  const brokenMap = new Map<string, number>();
  for (const trade of t) for (const r of trade.rulesBroken) brokenMap.set(r, (brokenMap.get(r) ?? 0) + 1);
  const topBrokenRules = [...brokenMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([rule, count]) => ({ rule, count }));

  // Equity curve
  let cum = 0;
  const equityCurve = [...t].reverse().map((x) => { cum += x.netPnl; return { date: format(x.entryTime, "yyyy-MM-dd"), cumulative: cum }; });

  return NextResponse.json({
    ...playbook,
    stats: {
      tradeCount: t.length, winners: winners.length, losers: losers.length,
      winRate: t.length > 0 ? (winners.length / t.length) * 100 : 0,
      netPnl, avgWin, avgLoss, profitFactor, avgR, adherence, topBrokenRules,
    },
    equityCurve,
    recentTrades: t.slice(0, 10),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.playbook.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, description, setupType, assetClass, timeframes, entryRules, exitRules, riskRules, tags, isActive } = body;

  const playbook = await prisma.playbook.update({
    where: { id },
    data: {
      name: name?.trim() ?? undefined, description: description ?? null,
      setupType: setupType ?? null, assetClass: assetClass ?? undefined,
      timeframes: timeframes ?? undefined, entryRules: entryRules ?? null,
      exitRules: exitRules ?? null, riskRules: riskRules ?? null,
      tags: tags ?? undefined, isActive: isActive ?? undefined,
    },
  });

  return NextResponse.json(playbook);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.playbook.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.playbook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
