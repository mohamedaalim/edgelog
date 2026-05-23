import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";

// 9:30, 10:00, 10:30, …, 15:30 — 13 half-hour slots
const HOURS = Array.from({ length: 13 }, (_, i) => {
  const totalMinutes = 9 * 60 + 30 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Use Intl to get ET hour — works correctly on UTC servers and handles DST
function etHour(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  return `${h}:${m >= 30 ? "30" : "00"}`;
}

function etDow(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "weekday")?.value ?? "";
}

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const trades = await prisma.trade.findMany({
    where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
    select: {
      netPnl: true,
      entryTime: true,
      symbol: true,
      setupType: true,
    },
  });

  // Time-of-day × day-of-week heatmap (pnl and trade count)
  const grid: Record<string, Record<string, { pnl: number; count: number; wins: number }>> = {};
  for (const day of DAYS) {
    grid[day] = {};
    for (const h of HOURS) grid[day][h] = { pnl: 0, count: 0, wins: 0 };
  }

  for (const t of trades) {
    const dow = etDow(t.entryTime);
    const hour = etHour(t.entryTime);
    if (grid[dow]?.[hour]) {
      grid[dow][hour].pnl += t.netPnl;
      grid[dow][hour].count++;
      if (t.netPnl > 0) grid[dow][hour].wins++;
    }
  }

  // Flatten to array
  const timeHeatmap = DAYS.flatMap((day) =>
    HOURS.map((hour) => {
      const cell = grid[day][hour];
      return {
        day,
        hour,
        pnl: cell.pnl,
        count: cell.count,
        winRate: cell.count > 0 ? (cell.wins / cell.count) * 100 : 0,
      };
    })
  );

  // Symbol × setup matrix
  const symbolSetupMap: Record<string, Record<string, { pnl: number; count: number; wins: number }>> = {};
  const symbols = new Set<string>();
  const setups = new Set<string>();

  for (const t of trades) {
    const sym = t.symbol;
    const setup = t.setupType ?? "No Setup";
    symbols.add(sym);
    setups.add(setup);
    if (!symbolSetupMap[sym]) symbolSetupMap[sym] = {};
    if (!symbolSetupMap[sym][setup]) symbolSetupMap[sym][setup] = { pnl: 0, count: 0, wins: 0 };
    symbolSetupMap[sym][setup].pnl += t.netPnl;
    symbolSetupMap[sym][setup].count++;
    if (t.netPnl > 0) symbolSetupMap[sym][setup].wins++;
  }

  // Top 8 symbols by trade count
  const topSymbols = Array.from(symbols)
    .map((s) => ({
      symbol: s,
      total: Object.values(symbolSetupMap[s]).reduce((sum, v) => sum + v.count, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((s) => s.symbol);

  const setupList = Array.from(setups);

  const symbolHeatmap = topSymbols.flatMap((sym) =>
    setupList.map((setup) => {
      const cell = symbolSetupMap[sym]?.[setup] ?? { pnl: 0, count: 0, wins: 0 };
      return {
        symbol: sym,
        setup,
        pnl: cell.pnl,
        count: cell.count,
        winRate: cell.count > 0 ? (cell.wins / cell.count) * 100 : 0,
      };
    })
  );

  return NextResponse.json({
    timeHeatmap,
    symbolHeatmap,
    hours: HOURS,
    days: DAYS,
    symbols: topSymbols,
    setups: setupList,
  });
}
