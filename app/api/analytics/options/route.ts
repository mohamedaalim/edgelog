import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { getDateRange } from "@/lib/dateRange";
import { differenceInCalendarDays } from "date-fns";

function dteBucket(dte: number): string {
  if (dte <= 7) return "0–7 DTE";
  if (dte <= 21) return "8–21 DTE";
  if (dte <= 45) return "22–45 DTE";
  if (dte <= 90) return "46–90 DTE";
  return "90+ DTE";
}

function ivRankBucket(ivr: number): string {
  if (ivr < 25) return "0–25";
  if (ivr < 50) return "25–50";
  if (ivr < 75) return "50–75";
  return "75–100";
}

const DTE_ORDER = ["0–7 DTE", "8–21 DTE", "22–45 DTE", "46–90 DTE", "90+ DTE"];
const IVR_ORDER = ["0–25", "25–50", "50–75", "75–100"];

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const rangeKey = new URL(req.url).searchParams.get("range") ?? "all";
  const { from, to } = getDateRange(rangeKey);

  const trades = await prisma.trade.findMany({
    where: {
      userId: userId!,
      status: "CLOSED",
      assetClass: "OPTION",
      entryTime: { gte: from, lte: to },
    },
    select: {
      netPnl: true, grossPnl: true, commission: true,
      entryTime: true, optionExpiry: true,
      strike: true, optionType: true,
      ivAtEntry: true, ivRank: true,
      delta: true, gamma: true, theta: true, vega: true,
      symbol: true,
    },
    orderBy: { entryTime: "asc" },
  });

  if (trades.length === 0) {
    return NextResponse.json({ empty: true, totalTrades: 0 });
  }

  // ── Call vs Put ──
  const calls = trades.filter((t) => t.optionType?.toUpperCase() === "CALL");
  const puts  = trades.filter((t) => t.optionType?.toUpperCase() === "PUT");
  const callWinners = calls.filter((t) => t.netPnl > 0);
  const putWinners  = puts.filter((t) => t.netPnl > 0);

  // ── By Expiry ──
  const expiryMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of trades) {
    if (!t.optionExpiry) continue;
    const key = t.optionExpiry.toISOString().split("T")[0];
    const cur = expiryMap.get(key) ?? { pnl: 0, trades: 0, wins: 0 };
    expiryMap.set(key, {
      pnl: cur.pnl + t.netPnl,
      trades: cur.trades + 1,
      wins: cur.wins + (t.netPnl > 0 ? 1 : 0),
    });
  }
  const byExpiry = [...expiryMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([expiry, v]) => ({ expiry, pnl: v.pnl, trades: v.trades, winRate: (v.wins / v.trades) * 100 }));

  // ── By DTE at entry ──
  const dteMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of trades) {
    if (!t.optionExpiry) continue;
    const dte = differenceInCalendarDays(t.optionExpiry, t.entryTime);
    const bucket = dteBucket(Math.max(0, dte));
    const cur = dteMap.get(bucket) ?? { pnl: 0, trades: 0, wins: 0 };
    dteMap.set(bucket, { pnl: cur.pnl + t.netPnl, trades: cur.trades + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) });
  }
  const byDTE = DTE_ORDER
    .filter((b) => dteMap.has(b))
    .map((b) => { const v = dteMap.get(b)!; return { bucket: b, pnl: v.pnl, trades: v.trades, winRate: (v.wins / v.trades) * 100 }; });

  // ── By IV Rank ──
  const ivrMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of trades) {
    if (t.ivRank == null) continue;
    const bucket = ivRankBucket(t.ivRank);
    const cur = ivrMap.get(bucket) ?? { pnl: 0, trades: 0, wins: 0 };
    ivrMap.set(bucket, { pnl: cur.pnl + t.netPnl, trades: cur.trades + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) });
  }
  const byIVRank = IVR_ORDER
    .filter((b) => ivrMap.has(b))
    .map((b) => { const v = ivrMap.get(b)!; return { bucket: b, pnl: v.pnl, trades: v.trades, winRate: (v.wins / v.trades) * 100 }; });

  // ── By Symbol ──
  const symMap = new Map<string, { pnl: number; trades: number; wins: number; strikes: number[] }>();
  for (const t of trades) {
    const root = t.symbol.split(" ")[0];
    const cur = symMap.get(root) ?? { pnl: 0, trades: 0, wins: 0, strikes: [] };
    cur.pnl += t.netPnl;
    cur.trades++;
    if (t.netPnl > 0) cur.wins++;
    if (t.strike != null) cur.strikes.push(t.strike);
    symMap.set(root, cur);
  }
  const bySymbol = [...symMap.entries()]
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .slice(0, 10)
    .map(([symbol, v]) => ({
      symbol,
      pnl: v.pnl,
      trades: v.trades,
      winRate: (v.wins / v.trades) * 100,
      avgStrike: v.strikes.length > 0 ? v.strikes.reduce((s, x) => s + x, 0) / v.strikes.length : null,
    }));

  // ── Greeks averages (trades that have them) ──
  function avg(arr: (number | null)[]): number {
    const vals = arr.filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }

  const greeks = {
    avgIV:     avg(trades.map((t) => t.ivAtEntry)),
    avgIVRank: avg(trades.map((t) => t.ivRank)),
    avgDelta:  avg(trades.map((t) => t.delta)),
    avgGamma:  avg(trades.map((t) => t.gamma)),
    avgTheta:  avg(trades.map((t) => t.theta)),
    avgVega:   avg(trades.map((t) => t.vega)),
    hasData:   trades.some((t) => t.delta != null || t.ivAtEntry != null),
  };

  return NextResponse.json({
    empty: false,
    totalTrades: trades.length,
    totalPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    callTrades: calls.length,
    putTrades: puts.length,
    callPnl: calls.reduce((s, t) => s + t.netPnl, 0),
    putPnl:  puts.reduce((s, t) => s + t.netPnl, 0),
    callWinRate: calls.length > 0 ? (callWinners.length / calls.length) * 100 : 0,
    putWinRate:  puts.length > 0  ? (putWinners.length  / puts.length)  * 100 : 0,
    greeks,
    byExpiry,
    byDTE,
    byIVRank,
    bySymbol,
  });
}
