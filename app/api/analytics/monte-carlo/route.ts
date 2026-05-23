import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";

const ITERATIONS = 1000;
const PROJECTION_TRADES = 252; // ~1 year of trading days

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: { netPnl: true },
    orderBy: { entryTime: "asc" },
  });

  if (trades.length < 10) return NextResponse.json({ empty: true, reason: "Need at least 10 trades for simulation" });

  const returns = trades.map((t) => t.netPnl);

  // Run Monte Carlo simulation
  const finalEquities: number[] = [];
  const maxDrawdowns: number[] = [];
  const percentiles = { p10: [] as number[], p25: [] as number[], p50: [] as number[], p75: [] as number[], p90: [] as number[] };
  const pathsAtStep: number[][] = Array.from({ length: PROJECTION_TRADES }, () => []);

  for (let i = 0; i < ITERATIONS; i++) {
    let equity = 0;
    let peak = 0;
    let maxDD = 0;
    const path: number[] = [];

    for (let j = 0; j < PROJECTION_TRADES; j++) {
      const randomIndex = Math.floor(Math.random() * returns.length);
      equity += returns[randomIndex];
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
      path.push(equity);
    }

    finalEquities.push(equity);
    maxDrawdowns.push(maxDD * 100);
    for (let j = 0; j < PROJECTION_TRADES; j++) pathsAtStep[j].push(path[j]);
  }

  // Sort for percentiles
  finalEquities.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const getPercentile = (arr: number[], p: number) => arr[Math.floor((p / 100) * arr.length)] ?? 0;

  // Build fan chart data (sampled every 20 steps to keep response size small)
  const fanData: { step: number; p10: number; p25: number; p50: number; p75: number; p90: number }[] = [];
  for (let j = 0; j < PROJECTION_TRADES; j += 5) {
    const sorted = [...pathsAtStep[j]].sort((a, b) => a - b);
    fanData.push({
      step: j + 1,
      p10: getPercentile(sorted, 10),
      p25: getPercentile(sorted, 25),
      p50: getPercentile(sorted, 50),
      p75: getPercentile(sorted, 75),
      p90: getPercentile(sorted, 90),
    });
  }

  // Drawdown distribution histogram
  const ddBuckets = [5, 10, 15, 20, 25, 30, 40, 50, 100];
  const ddHistogram = ddBuckets.map((threshold, i) => {
    const lo = ddBuckets[i - 1] ?? 0;
    const hi = threshold;
    const count = maxDrawdowns.filter((d) => d >= lo && d < hi).length;
    return { range: `${lo}-${hi}%`, count, probability: (count / ITERATIONS) * 100 };
  });

  // Outcome distribution
  const negCount = finalEquities.filter((e) => e < 0).length;
  const smallPosCount = finalEquities.filter((e) => e >= 0 && e < getPercentile(finalEquities, 50)).length;
  const largePosCount = finalEquities.filter((e) => e >= getPercentile(finalEquities, 50)).length;

  return NextResponse.json({
    iterations: ITERATIONS,
    projectionTrades: PROJECTION_TRADES,
    finalEquity: {
      p10: getPercentile(finalEquities, 10),
      p25: getPercentile(finalEquities, 25),
      p50: getPercentile(finalEquities, 50),
      p75: getPercentile(finalEquities, 75),
      p90: getPercentile(finalEquities, 90),
      worst: finalEquities[0],
      best: finalEquities[ITERATIONS - 1],
    },
    maxDrawdown: {
      p50: getPercentile(maxDrawdowns, 50),
      p75: getPercentile(maxDrawdowns, 75),
      p90: getPercentile(maxDrawdowns, 90),
      p95: getPercentile(maxDrawdowns, 95),
    },
    probabilityOfProfit: ((ITERATIONS - negCount) / ITERATIONS) * 100,
    fanData,
    ddHistogram,
    outcomeBreakdown: {
      loss: (negCount / ITERATIONS) * 100,
      smallGain: (smallPosCount / ITERATIONS) * 100,
      largeGain: (largePosCount / ITERATIONS) * 100,
    },
  });
}
