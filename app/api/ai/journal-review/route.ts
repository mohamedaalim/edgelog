import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, parseISO } from "date-fns";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured — add ANTHROPIC_API_KEY to .env" }, { status: 503 });
  }

  const { date, journal } = await req.json();

  const day = parseISO(date);
  const trades = await prisma.trade.findMany({
    where: { userId: userId!, entryTime: { gte: startOfDay(day), lte: endOfDay(day) }, status: "CLOSED" },
    select: {
      symbol: true, side: true, setupType: true, netPnl: true, rRatio: true,
      holdDuration: true, mistakeTags: true, emotionBefore: true, emotionAfter: true, notes: true,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { name: true, accountSize: true, riskPerTrade: true },
  });

  const tradesSummary = trades.map((t) =>
    `${t.symbol} ${t.side} (${t.setupType ?? "no setup"}): $${t.netPnl.toFixed(2)} P&L, ${t.rRatio?.toFixed(2) ?? "?"}R${t.mistakeTags.length ? `, mistakes: ${t.mistakeTags.join(", ")}` : ""}`
  ).join("\n");

  const systemPrompt = `You are an expert trading coach and performance psychologist.
The trader's name is ${user?.name ?? "the trader"}.
Account size: $${user?.accountSize?.toLocaleString() ?? "unknown"}, Risk per trade: ${user?.riskPerTrade ?? 1}%.
Today's trades:\n${tradesSummary || "No trades today."}\n
Journal:\nPre-market plan: ${journal.prePlanning || "None written"}\nPost-market review: ${journal.postReview || "None written"}\nMood: ${journal.mood ?? "?"}/10, Focus: ${journal.focus ?? "?"}/10`;

  const userMessage = `Analyze today's trading session and journal entry. Be direct, honest, and specific to the actual data. Format your response with these sections:
1. **Session Overview** (2-3 sentences on overall performance)
2. **What Worked** (specific to their actual trades/setups)
3. **Areas to Improve** (quantified where possible)
4. **Discipline Score** (0-100 with brief justification)
5. **Tomorrow's Focus** (one concrete, actionable priority)

Keep the total response under 350 words. Reference specific trades and numbers.`;

  try {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
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
    console.error("AI journal review error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
