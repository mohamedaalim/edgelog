import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOLD_BUCKETS = [
  { label: "<5m", max: 300 }, { label: "5-15m", max: 900 }, { label: "15-60m", max: 3600 },
  { label: "1-4h", max: 14400 }, { label: "4h+", max: Infinity },
];

function localWeekday(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).formatToParts(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
}

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { from, to } = getDateRange(new URL(req.url).searchParams.get("range") ?? "all");

  const [trades, user] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: userId!, status: "CLOSED", entryTime: { gte: from, lte: to } },
      select: { netPnl: true, entryTime: true, holdDuration: true },
    }),
    prisma.user.findUnique({ where: { id: userId! }, select: { timezone: true } }),
  ]);

  const tz = user?.timezone ?? "America/New_York";

  // By hour in ET — use Intl to handle DST correctly on UTC servers
  const getEtSlot = (date: Date): string => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    return `${h}:${m >= 30 ? "30" : "00"}`;
  };
  // Build ordered slots 9:30 → 15:30
  const HOUR_SLOTS = Array.from({ length: 13 }, (_, i) => {
    const total = 9 * 60 + 30 + i * 30;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });
  const hourBuckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const slot of HOUR_SLOTS) hourBuckets[slot] = { pnl: 0, count: 0, wins: 0 };
  for (const t of trades) {
    const slot = getEtSlot(t.entryTime);
    if (hourBuckets[slot]) { hourBuckets[slot].pnl += t.netPnl; hourBuckets[slot].count++; if (t.netPnl > 0) hourBuckets[slot].wins++; }
  }
  const byHour = HOUR_SLOTS.map((time) => {
    const v = hourBuckets[time];
    return { time, pnl: v.pnl, count: v.count, winRate: v.count > 0 ? (v.wins / v.count) * 100 : 0 };
  });

  // By day of week
  const dowBuckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const d of DAYS) dowBuckets[d] = { pnl: 0, count: 0, wins: 0 };
  for (const t of trades) {
    const dow = localWeekday(t.entryTime, tz);
    const key = DAYS[dow - 1];
    if (key && dowBuckets[key]) { dowBuckets[key].pnl += t.netPnl; dowBuckets[key].count++; if (t.netPnl > 0) dowBuckets[key].wins++; }
  }
  const byDow = DAYS.map((d) => ({ day: d, pnl: dowBuckets[d].pnl, count: dowBuckets[d].count, winRate: dowBuckets[d].count > 0 ? (dowBuckets[d].wins / dowBuckets[d].count) * 100 : 0 }));

  // Hold duration vs P&L
  const holdBuckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const b of HOLD_BUCKETS) holdBuckets[b.label] = { pnl: 0, count: 0, wins: 0 };
  for (const t of trades) {
    if (!t.holdDuration) continue;
    const bucket = HOLD_BUCKETS.find((b) => t.holdDuration! <= b.max)?.label;
    if (bucket && holdBuckets[bucket]) { holdBuckets[bucket].pnl += t.netPnl; holdBuckets[bucket].count++; if (t.netPnl > 0) holdBuckets[bucket].wins++; }
  }
  const byHoldDuration = HOLD_BUCKETS.map(({ label }) => ({ label, pnl: holdBuckets[label].pnl, count: holdBuckets[label].count, winRate: holdBuckets[label].count > 0 ? (holdBuckets[label].wins / holdBuckets[label].count) * 100 : 0 }));

  return NextResponse.json({ byHour, byDow, byHoldDuration });
}
