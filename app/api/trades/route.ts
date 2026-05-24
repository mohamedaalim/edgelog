import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { checkMilestones } from "@/lib/milestones";

const TradeSchema = z.object({
  accountId:    z.string().min(1),
  symbol:       z.string().min(1).max(20),
  side:         z.enum(["LONG", "SHORT"]),
  assetClass:   z.enum(["STOCK", "OPTION", "FUTURE", "FOREX", "CRYPTO", "COMMODITY"]).optional(),
  quantity:     z.number().positive(),
  entryPrice:   z.number().positive(),
  exitPrice:    z.number().positive().optional().nullable(),
  entryTime:    z.string().datetime({ offset: true }).or(z.string().min(1)),
  exitTime:     z.string().optional().nullable(),
  stopLoss:     z.number().positive().optional().nullable(),
  takeProfit:   z.number().positive().optional().nullable(),
  commission:   z.number().min(0).optional(),
  contractMultiplier: z.number().positive().optional(),
  setupType:    z.string().max(100).optional().nullable(),
  timeframe:    z.string().max(20).optional().nullable(),
  marketCondition: z.string().max(50).optional().nullable(),
  emotionBefore: z.number().int().min(1).max(10).optional().nullable(),
  emotionAfter:  z.number().int().min(1).max(10).optional().nullable(),
  confidence:    z.number().int().min(1).max(10).optional().nullable(),
  notes:         z.string().max(5000).optional().nullable(),
  lessonsLearned: z.string().max(5000).optional().nullable(),
  mistakeTags:   z.array(z.string()).optional(),
  setupTags:     z.array(z.string()).optional(),
  customTags:    z.array(z.string()).optional(),
  // Options fields
  optionExpiry:  z.string().optional().nullable(),
  strike:        z.number().positive().optional().nullable(),
  optionType:    z.enum(["call", "put"]).optional().nullable(),
  ivAtEntry:     z.number().min(0).optional().nullable(),
  ivRank:        z.number().min(0).max(100).optional().nullable(),
  delta:         z.number().optional().nullable(),
  gamma:         z.number().optional().nullable(),
  theta:         z.number().optional().nullable(),
  vega:          z.number().optional().nullable(),
  underlyingPrice: z.number().positive().optional().nullable(),
  // Multi-leg
  legGroupId:    z.string().optional().nullable(),
  legLabel:      z.string().max(50).optional().nullable(),
  // Currency
  currency:      z.string().length(3).optional(),
});

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const rangeKey = searchParams.get("range") ?? "month";
  const accountId = searchParams.get("accountId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "25")));
  const { from, to } = getDateRange(rangeKey);

  const where = {
    userId: userId!,
    entryTime: { gte: from, lte: to },
    ...(accountId ? { accountId } : {}),
  };

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { entryTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { account: { select: { name: true } } },
    }),
    prisma.trade.count({ where }),
  ]);

  return NextResponse.json({ trades, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const raw = await req.json();
  const parsed = TradeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { accountId, symbol, side, quantity, entryPrice, exitPrice, entryTime, exitTime,
    stopLoss, takeProfit, commission, setupType, timeframe, marketCondition,
    emotionBefore, emotionAfter, notes, lessonsLearned, mistakeTags, setupTags, customTags,
    assetClass, contractMultiplier,
    optionExpiry, strike, optionType, ivAtEntry, ivRank, delta, gamma, theta, vega, underlyingPrice,
    legGroupId, legLabel, currency,
  } = parsed.data;

  // contractMultiplier handles futures (ES=50, NQ=20, MES=5) and option contracts (=100)
  const multiplier = Number(contractMultiplier ?? 1) || 1;
  const direction = side === "LONG" ? 1 : -1;
  const grossPnl = exitPrice ? direction * quantity * (exitPrice - entryPrice) * multiplier : 0;
  const netPnl = grossPnl - (commission ?? 0);
  const holdDuration = exitTime ? Math.floor((new Date(exitTime).getTime() - new Date(entryTime).getTime()) / 1000) : null;
  const rRatio = stopLoss && exitPrice ? parseFloat(((direction * (exitPrice - entryPrice)) / Math.abs(entryPrice - stopLoss)).toFixed(2)) : null;

  const trade = await prisma.trade.create({
    data: {
      userId: userId!,
      accountId,
      symbol: symbol.toUpperCase(),
      assetClass: assetClass ?? "STOCK",
      side,
      status: exitPrice ? "CLOSED" : "OPEN",
      quantity,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      entryTime: new Date(entryTime),
      exitTime: exitTime ? new Date(exitTime) : null,
      holdDuration,
      grossPnl,
      netPnl,
      commission: commission ?? 0,
      rRatio,
      contractMultiplier: multiplier,
      setupType,
      timeframe,
      marketCondition,
      emotionBefore,
      emotionAfter,
      notes,
      lessonsLearned,
      mistakeTags: mistakeTags ?? [],
      setupTags: setupTags ?? [],
      customTags: customTags ?? [],
      rulesBroken: [],
      isManual: true,
      // Options fields
      optionExpiry: optionExpiry ? new Date(optionExpiry) : null,
      strike, optionType, ivAtEntry, ivRank, delta, gamma, theta, vega, underlyingPrice,
      // Multi-leg
      legGroupId: legGroupId ?? null,
      legLabel: legLabel ?? null,
      // Currency
      currency: currency ?? "USD",
    },
  });

  // Fire-and-forget milestone check — does not block trade save response
  checkMilestones(userId!).catch(() => null);

  return NextResponse.json(trade, { status: 201 });
}
