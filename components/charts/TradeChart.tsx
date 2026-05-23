"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type SeriesMarker,
  type Time,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface TradeChartProps {
  symbol: string;
  date: string; // yyyy-MM-dd
  entryTime: string; // ISO
  exitTime?: string | null;
  entryPrice: number;
  exitPrice?: number | null;
  side: "LONG" | "SHORT";
  stopLoss?: number | null;
  takeProfit?: number | null;
  interval?: "1m" | "2m" | "5m" | "15m";
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const CHART_BG = "#0f1117";
const GRID_COLOR = "rgba(255,255,255,0.04)";
const TEXT_COLOR = "#6b7280";
const GREEN = "#00d97e";
const RED = "#e84393";

export function TradeChart({
  symbol,
  date,
  entryTime,
  exitTime,
  entryPrice,
  exitPrice,
  side,
  stopLoss,
  takeProfit,
  interval = "5m",
}: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [selectedInterval, setSelectedInterval] = useState(interval);

  const { data, isLoading, isError } = useQuery<{ candles: Candle[]; error?: string }>({
    queryKey: ["chart", symbol, date, selectedInterval],
    queryFn: () =>
      fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&date=${date}&interval=${selectedInterval}`)
        .then((r) => r.json()),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT_COLOR,
        fontSize: 11,
        fontFamily: "'Inter', 'SF Mono', monospace",
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: GRID_COLOR,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: GRID_COLOR,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: GREEN,
      downColor: RED,
      borderUpColor: GREEN,
      borderDownColor: RED,
      wickUpColor: GREEN,
      wickDownColor: RED,
    });

    // Volume histogram in bottom portion of the same pane
    const volSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(255,255,255,0.10)",
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Store vol series in a ref-like closure via dataset attribute
    containerRef.current.dataset.hasVol = "1";
    (containerRef.current as HTMLDivElement & { _volSeries: typeof volSeries })._volSeries = volSeries;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // Feed data + markers whenever candles or settings change
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || !data?.candles?.length) return;

    const sorted = [...data.candles].sort((a, b) => a.time - b.time);

    const candleData: CandlestickData[] = sorted.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(candleData);

    // Volume
    const el = containerRef.current as (HTMLDivElement & { _volSeries?: ISeriesApi<"Histogram"> }) | null;
    if (el?._volSeries) {
      el._volSeries.setData(
        sorted.map((c) => ({ time: c.time as Time, value: c.volume, color: c.close >= c.open ? "rgba(0,217,126,0.15)" : "rgba(232,67,147,0.15)" }))
      );
    }

    // Entry / exit markers via createSeriesMarkers plugin
    const markers: SeriesMarker<Time>[] = [];

    const entryTs = Math.floor(new Date(entryTime).getTime() / 1000) as Time;
    markers.push({
      time: entryTs,
      position: side === "LONG" ? "belowBar" : "aboveBar",
      color: GREEN,
      shape: side === "LONG" ? "arrowUp" : "arrowDown",
      text: `Entry ${entryPrice.toFixed(2)}`,
      size: 1.5,
    });

    if (exitTime && exitPrice) {
      const exitTs = Math.floor(new Date(exitTime).getTime() / 1000) as Time;
      const win = side === "LONG" ? exitPrice > entryPrice : exitPrice < entryPrice;
      markers.push({
        time: exitTs,
        position: side === "LONG" ? "aboveBar" : "belowBar",
        color: win ? GREEN : RED,
        shape: side === "LONG" ? "arrowDown" : "arrowUp",
        text: `Exit ${exitPrice.toFixed(2)}`,
        size: 1.5,
      });
    }

    createSeriesMarkers(candleSeries, markers);

    // Price lines for stop and take profit
    if (stopLoss) {
      candleSeries.createPriceLine({
        price: stopLoss,
        color: RED,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "SL",
      });
    }
    if (takeProfit) {
      candleSeries.createPriceLine({
        price: takeProfit,
        color: GREEN,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "TP",
      });
    }

    // Zoom to trade window ±15 min
    const times = markers.map((m) => m.time as number);
    const minTime = Math.min(...times) - 900;
    const maxTime = Math.max(...times) + 900;
    chart.timeScale().setVisibleRange({ from: minTime as Time, to: maxTime as Time });
  }, [data, entryTime, exitTime, entryPrice, exitPrice, side, stopLoss, takeProfit]);

  const intervals: Array<{ label: string; value: "1m" | "2m" | "5m" | "15m" }> = [
    { label: "1m", value: "1m" },
    { label: "2m", value: "2m" },
    { label: "5m", value: "5m" },
    { label: "15m", value: "15m" },
  ];

  const pnl = exitPrice ? (side === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice) : null;
  const isWin = pnl !== null && pnl > 0;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{symbol}</span>
          {pnl !== null && (
            <span className={`flex items-center gap-1 text-xs font-medium ${isWin ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {isWin ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} pts
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {intervals.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setSelectedInterval(iv.value)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                selectedInterval === iv.value
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-white/10"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div className="relative rounded-lg overflow-hidden" style={{ height: 320 }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)]/80 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
              <span className="text-xs text-[var(--muted)]">Fetching market data…</span>
            </div>
          </div>
        )}

        {!isLoading && (isError || data?.error || !data?.candles?.length) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)] rounded-lg">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <AlertTriangle className="w-6 h-6 text-[var(--muted)]" />
              <p className="text-xs text-[var(--muted)]">
                {data?.error ?? "No market data available for this symbol/date"}
              </p>
              <p className="text-xs text-white/30">Futures, crypto, and pre/post-market may not be available</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[var(--green)] inline-block" /> Entry
        </span>
        {exitTime && (
          <span className="flex items-center gap-1">
            <span className={`w-3 h-0.5 inline-block ${isWin ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} /> Exit
          </span>
        )}
        {stopLoss && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[var(--red)] inline-block opacity-70" /> SL
          </span>
        )}
        {takeProfit && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[var(--green)] inline-block opacity-70" /> TP
          </span>
        )}
      </div>
    </div>
  );
}
