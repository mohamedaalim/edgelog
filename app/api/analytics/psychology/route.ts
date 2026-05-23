import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: { netPnl: true, mistakeTags: true, emotionBefore: true, emotionAfter: true, confidence: true, entryTime: true },
  });

  // Emotion vs performance (scatter data)
  const emotionScatter = trades
    .filter((t) => t.emotionBefore != null)
    .map((t) => ({ emotion: t.emotionBefore!, pnl: t.netPnl }));

  // By emotion level
  const emotionBuckets: Record<number, { pnl: number; count: number; wins: number }> = {};
  for (let i = 1; i <= 10; i++) emotionBuckets[i] = { pnl: 0, count: 0, wins: 0 };
  for (const t of trades.filter((t) => t.emotionBefore != null)) {
    const k = t.emotionBefore!;
    emotionBuckets[k].pnl += t.netPnl; emotionBuckets[k].count++; if (t.netPnl > 0) emotionBuckets[k].wins++;
  }
  const byEmotion = Array.from({ length: 10 }, (_, i) => ({
    level: i + 1, pnl: emotionBuckets[i + 1].pnl, count: emotionBuckets[i + 1].count,
    winRate: emotionBuckets[i + 1].count > 0 ? (emotionBuckets[i + 1].wins / emotionBuckets[i + 1].count) * 100 : 0,
  }));

  // Mistake analysis
  const mistakeMap = new Map<string, { count: number; pnl: number }>();
  for (const t of trades) {
    for (const m of t.mistakeTags) {
      const cur = mistakeMap.get(m) ?? { count: 0, pnl: 0 };
      mistakeMap.set(m, { count: cur.count + 1, pnl: cur.pnl + t.netPnl });
    }
  }
  const mistakes = Array.from(mistakeMap.entries())
    .map(([tag, { count, pnl }]) => ({ tag, count, totalPnl: pnl, avgPnl: pnl / count }))
    .sort((a, b) => b.count - a.count);

  // Monthly discipline score (% trades with no mistake tags)
  const byMonth = new Map<string, { total: number; clean: number }>();
  for (const t of trades) {
    const key = format(t.entryTime, "yyyy-MM");
    const cur = byMonth.get(key) ?? { total: 0, clean: 0 };
    byMonth.set(key, { total: cur.total + 1, clean: cur.clean + (t.mistakeTags.length === 0 ? 1 : 0) });
  }
  const disciplineTrend = Array.from(byMonth.entries())
    .map(([month, { total, clean }]) => ({ month, score: total > 0 ? (clean / total) * 100 : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({ emotionScatter, byEmotion, mistakes, disciplineTrend });
}
