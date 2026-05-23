import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const trade = await prisma.trade.findFirst({
    where: { id, userId: userId! },
    include: { executions: { orderBy: { timestamp: "asc" } }, screenshots: true, account: { select: { name: true } } },
  });

  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trade);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.trade.findFirst({ where: { id, userId: userId! } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    symbol, side, quantity, entryPrice, exitPrice, entryTime, exitTime,
    stopLoss, takeProfit, commission, setupType, timeframe, marketCondition,
    emotionBefore, emotionAfter, confidence, notes, lessonsLearned,
    mistakeTags, setupTags, customTags, rulesBroken, rulesFollowed, playbookId, currency,
  } = body;

  const direction = (side ?? existing.side) === "LONG" ? 1 : -1;
  const ep = exitPrice ?? existing.exitPrice;
  const en = entryPrice ?? existing.entryPrice;
  const qty = quantity ?? existing.quantity;
  const com = commission ?? existing.commission;
  const grossPnl = ep ? direction * qty * (ep - en) : existing.grossPnl;
  const netPnl = grossPnl - com;
  const et = exitTime ? new Date(exitTime) : existing.exitTime;
  const ent = entryTime ? new Date(entryTime) : existing.entryTime;
  const holdDuration = et ? Math.floor((et.getTime() - ent.getTime()) / 1000) : existing.holdDuration;
  const sl = stopLoss ?? existing.stopLoss;
  const rRatio = sl && ep ? parseFloat(((direction * (ep - en)) / Math.abs(en - sl)).toFixed(2)) : existing.rRatio;

  const trade = await prisma.trade.update({
    where: { id },
    data: {
      ...(symbol && { symbol: symbol.toUpperCase() }),
      ...(side && { side }),
      ...(quantity && { quantity }),
      ...(entryPrice && { entryPrice }),
      exitPrice: ep,
      ...(entryTime && { entryTime: ent }),
      exitTime: et,
      holdDuration,
      grossPnl,
      netPnl,
      commission: com,
      stopLoss: sl,
      ...(takeProfit !== undefined && { takeProfit }),
      rRatio,
      ...(setupType !== undefined && { setupType }),
      ...(timeframe !== undefined && { timeframe }),
      ...(marketCondition !== undefined && { marketCondition }),
      ...(emotionBefore !== undefined && { emotionBefore }),
      ...(emotionAfter !== undefined && { emotionAfter }),
      ...(confidence !== undefined && { confidence }),
      ...(notes !== undefined && { notes }),
      ...(lessonsLearned !== undefined && { lessonsLearned }),
      ...(mistakeTags && { mistakeTags }),
      ...(setupTags && { setupTags }),
      ...(customTags && { customTags }),
      ...(rulesBroken && { rulesBroken }),
      ...(rulesFollowed !== undefined && { rulesFollowed }),
      ...(playbookId !== undefined && { playbookId }),
      ...(currency && { currency }),
      status: ep ? "CLOSED" : "OPEN",
    },
  });

  return NextResponse.json(trade);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.trade.findFirst({ where: { id, userId: userId! } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trade.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
