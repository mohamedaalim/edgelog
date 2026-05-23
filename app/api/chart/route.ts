import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import yahooFinance from "yahoo-finance2";

// GET /api/chart?symbol=AAPL&date=2024-01-15&range=1d&interval=5m
export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const date = searchParams.get("date"); // yyyy-MM-dd
  const interval = (searchParams.get("interval") ?? "5m") as
    | "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1h" | "1d";

  if (!symbol || !date) {
    return NextResponse.json({ error: "symbol and date required" }, { status: 400 });
  }

  // Fetch the day's 5-min candles — period from market open to close + buffer
  const start = new Date(`${date}T09:00:00`);
  const end = new Date(`${date}T17:00:00`);

  try {
    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval,
    }) as { quotes?: Array<{ date: Date; open?: number | null; high?: number | null; low?: number | null; close?: number | null; volume?: number | null }> };

    const quotes = result.quotes ?? [];
    if (!quotes.length) {
      return NextResponse.json({ candles: [], symbol, date });
    }

    const candles = quotes
      .filter((q) => q.open != null && q.high != null && q.low != null && q.close != null)
      .map((q) => ({
        time: Math.floor(new Date(q.date).getTime() / 1000) as number,
        open: q.open!,
        high: q.high!,
        low: q.low!,
        close: q.close!,
        volume: q.volume ?? 0,
      }));

    return NextResponse.json({ candles, symbol, date });
  } catch (err) {
    console.error("Yahoo Finance fetch error:", err);
    return NextResponse.json({ candles: [], symbol, date, error: "Could not fetch market data" });
  }
}
