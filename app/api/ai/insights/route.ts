import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { subDays, format, startOfWeek, endOfWeek } from "date-fns";
import { calcWinRate, calcProfitFactor, calcMaxDrawdown } from "@/lib/calculations";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ configured: false });
  }

  const range = new URL(req.url).searchParams.get("range") ?? "week";
  const since = range === "week" ? subDays(new Date(), 7) : range === "month" ? subDays(new Date(), 30) : subDays(new Date(), 14);

  const [user, trades, allTrades] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId! },
      select: { name: true, accountSize: true, riskPerTrade: true, aiModel: true },
    }),
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED", entryTime: { gte: since } },
      select: {
        symbol: true, side: true, setupType: true, netPnl: true, grossPnl: true, commission: true, rRatio: true,
        entryTime: true, holdDuration: true, mistakeTags: true,
        emotionBefore: true, emotionAfter: true, confidence: true,
      },
      orderBy: { entryTime: "asc" },
    }),
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED", entryTime: { gte: subDays(new Date(), 90) } },
      select: { netPnl: true, grossPnl: true, commission: true, rRatio: true, entryTime: true },
      orderBy: { entryTime: "asc" },
    }),
  ]);

  if (trades.length < 3) {
    return NextResponse.json({
      configured: true,
      insights: [{
        id: "no-data",
        type: "info",
        title: "Not enough data yet",
        content: `Log at least 3 trades in the selected period to receive AI insights.`,
        priority: 1,
      }],
    });
  }

  // Build compact stats for the AI
  const winRate = calcWinRate(trades);
  const profitFactor = calcProfitFactor(trades);
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const equityCurve = allTrades.map(((cum) => (t: { netPnl: number }) => { cum += t.netPnl; return cum; })(0));
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve);
  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl < 0);
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.netPnl, 0) / losers.length) : 0;

  // Mistake frequency
  const mistakeMap = new Map<string, number>();
  for (const t of trades) for (const m of t.mistakeTags) mistakeMap.set(m, (mistakeMap.get(m) ?? 0) + 1);
  const mistakes = [...mistakeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, c]) => `${m}(${c}x)`).join(", ");

  // Symbol performance
  const symMap = new Map<string, { pnl: number; count: number }>();
  for (const t of trades) {
    const cur = symMap.get(t.symbol) ?? { pnl: 0, count: 0 };
    symMap.set(t.symbol, { pnl: cur.pnl + t.netPnl, count: cur.count + 1 });
  }
  const symLines = [...symMap.entries()].sort((a, b) => b[1].pnl - a[1].pnl).map(([s, v]) => `${s}: $${v.pnl.toFixed(0)} (${v.count})`).join(", ");

  // Emotion stats
  const emotionTrades = trades.filter((t) => t.emotionBefore != null);
  const highEmoWins = emotionTrades.filter((t) => t.emotionBefore! >= 7 && t.netPnl > 0).length;
  const highEmoTotal = emotionTrades.filter((t) => t.emotionBefore! >= 7).length;
  const lowEmoWins = emotionTrades.filter((t) => t.emotionBefore! <= 4 && t.netPnl > 0).length;
  const lowEmoTotal = emotionTrades.filter((t) => t.emotionBefore! <= 4).length;

  const statsBlurb = `
Period: ${range} | Trades: ${trades.length} | Net P&L: $${netPnl.toFixed(0)}
Win Rate: ${winRate.toFixed(1)}% | Profit Factor: ${profitFactor.toFixed(2)} | Avg Win: $${avgWin.toFixed(0)} | Avg Loss: $${avgLoss.toFixed(0)}
Max Drawdown: $${maxDrawdown.toFixed(0)} (${maxDrawdownPct.toFixed(1)}%)
Top mistakes: ${mistakes || "none"}
By symbol: ${symLines || "N/A"}
High emotion (7-10) trades: ${highEmoTotal} trades, ${highEmoTotal > 0 ? ((highEmoWins / highEmoTotal) * 100).toFixed(0) : "?"}% win rate
Low emotion (1-4) trades: ${lowEmoTotal} trades, ${lowEmoTotal > 0 ? ((lowEmoWins / lowEmoTotal) * 100).toFixed(0) : "?"}% win rate
Account size: $${user?.accountSize ?? "?"} | Risk/trade: ${user?.riskPerTrade ?? 1}%`;

  const prompt = `You are an elite trading coach analyzing a trader's recent performance. Given the stats below, generate exactly 4 insight cards. Return ONLY a valid JSON array — no markdown, no explanation.

Stats:
${statsBlurb}

Each insight card must have:
- "id": unique string slug
- "type": one of "strength" | "warning" | "pattern" | "focus"
- "title": short title (5-8 words max)
- "content": 2-3 sentences, specific to the data, actionable
- "metric": optional { "label": string, "value": string } for a key number to highlight
- "priority": 1-4 (1 = most important)

Rules:
- "strength" = something working well
- "warning" = a risk or bad pattern to address urgently
- "pattern" = a behavioral/statistical pattern (neutral observation)
- "focus" = the #1 thing to work on this ${range}
- Be brutal and honest. Reference specific numbers from the stats.
- Return the array sorted by priority ascending.`;

  try {
    const response = await client.messages.create({
      model: user?.aiModel ?? "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip any markdown code fences if present
    const clean = text.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const insights = JSON.parse(clean);

    return NextResponse.json({ configured: true, insights });
  } catch (err) {
    console.error("AI insights error:", err);
    return NextResponse.json({ configured: true, insights: [], error: "Failed to generate insights" });
  }
}
