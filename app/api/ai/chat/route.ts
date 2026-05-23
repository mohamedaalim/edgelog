import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { subDays, format } from "date-fns";
import { calcWinRate, calcProfitFactor, calcExpectedValue } from "@/lib/calculations";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChatMessage { role: "user" | "assistant"; content: string; }

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured — add ANTHROPIC_API_KEY to .env" }, { status: 503 });
  }

  const { messages }: { messages: ChatMessage[] } = await req.json();
  if (!messages?.length) return NextResponse.json({ error: "messages required" }, { status: 400 });

  // Pull rich context: last 60 days of trades + user profile
  const since = subDays(new Date(), 60);
  const [user, recentTrades, allTrades] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId! },
      select: { name: true, accountSize: true, riskPerTrade: true, currency: true, aiModel: true },
    }),
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED", entryTime: { gte: since } },
      select: {
        symbol: true, side: true, setupType: true, netPnl: true, grossPnl: true, commission: true, rRatio: true,
        entryTime: true, holdDuration: true, mistakeTags: true,
        emotionBefore: true, emotionAfter: true, confidence: true, notes: true,
      },
      orderBy: { entryTime: "desc" },
      take: 100,
    }),
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED" },
      select: { netPnl: true, grossPnl: true, commission: true, rRatio: true },
    }),
  ]);

  // Compute stats
  const winRate = calcWinRate(recentTrades);
  const profitFactor = calcProfitFactor(recentTrades);
  const ev = calcExpectedValue(recentTrades);
  const netPnl60d = recentTrades.reduce((s, t) => s + t.netPnl, 0);
  const allTimeNetPnl = allTrades.reduce((s, t) => s + t.netPnl, 0);

  // Top symbols (60d)
  const symbolMap = new Map<string, { pnl: number; count: number }>();
  for (const t of recentTrades) {
    const cur = symbolMap.get(t.symbol) ?? { pnl: 0, count: 0 };
    symbolMap.set(t.symbol, { pnl: cur.pnl + t.netPnl, count: cur.count + 1 });
  }
  const topSymbols = [...symbolMap.entries()].sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 5)
    .map(([sym, v]) => `${sym}: $${v.pnl.toFixed(0)} (${v.count} trades)`).join(", ");

  // Top mistakes
  const mistakeMap = new Map<string, number>();
  for (const t of recentTrades) for (const m of t.mistakeTags) mistakeMap.set(m, (mistakeMap.get(m) ?? 0) + 1);
  const topMistakes = [...mistakeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([m, c]) => `${m} (${c}x)`).join(", ");

  // Best/worst recent trades for reference
  const sorted = [...recentTrades].sort((a, b) => b.netPnl - a.netPnl);
  const bestTrades = sorted.slice(0, 3).map((t) => `${t.symbol} ${t.side} $${t.netPnl.toFixed(0)}`).join(", ");
  const worstTrades = sorted.slice(-3).reverse().map((t) => `${t.symbol} ${t.side} $${t.netPnl.toFixed(0)}`).join(", ");

  // Avg emotion
  const emotionTrades = recentTrades.filter((t) => t.emotionBefore != null);
  const avgEmotion = emotionTrades.length > 0 ? (emotionTrades.reduce((s, t) => s + t.emotionBefore!, 0) / emotionTrades.length).toFixed(1) : "N/A";

  const systemPrompt = `You are EdgeLog AI — an elite trading coach, performance analyst, and trading psychologist embedded in a professional trading journal application.

## Trader Profile
- Name: ${user?.name ?? "Trader"}
- Account size: $${user?.accountSize?.toLocaleString() ?? "unknown"} | Risk per trade: ${user?.riskPerTrade ?? 1}%
- Total trades (all time): ${allTrades.length} | All-time net P&L: $${allTimeNetPnl.toFixed(2)}

## Last 60 Days Performance (${recentTrades.length} trades)
- Net P&L: $${netPnl60d.toFixed(2)}
- Win Rate: ${winRate.toFixed(1)}%
- Profit Factor: ${profitFactor.toFixed(2)}
- Expected Value/trade: $${ev.toFixed(2)}
- Top symbols by P&L: ${topSymbols || "N/A"}
- Best trades: ${bestTrades || "N/A"}
- Worst trades: ${worstTrades || "N/A"}
- Top mistakes: ${topMistakes || "None recorded"}
- Avg pre-trade emotion (1-10): ${avgEmotion}

## Instructions
- Be direct, specific, and data-driven. Reference the trader's actual numbers when relevant.
- Focus on actionable insights. Don't give generic advice.
- When discussing risks, be honest — even if uncomfortable.
- Keep responses concise and structured (use markdown: bold, bullets, headers).
- You have access to the trader's stats above. If they ask about something not in your context, say so and suggest they check the specific analytics page.
- Today's date: ${format(new Date(), "MMMM d, yyyy")}`;

  try {
    const model = user?.aiModel ?? "claude-sonnet-4-6";
    const stream = await client.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
