"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card } from "@/components/shared/Card";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { ByDow } from "@/components/charts/ByDow";
import { ByHour } from "@/components/charts/ByHour";
import { LongShortDonut } from "@/components/charts/LongShortDonut";
import { formatCurrency, formatPercent, formatR, formatDuration } from "@/lib/utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { label: "1W", value: "week" },
  { label: "1M", value: "month" },
  { label: "3M", value: "quarter" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

function fetcher(url: string) {
  return fetch(url).then((r) => r.json());
}

export default function DashboardPage() {
  const [equityRange, setEquityRange] = useState("all");

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", "month"],
    queryFn: () => fetcher("/api/stats/summary?range=month"),
  });

  const { data: equityCurve = [], isLoading: equityLoading } = useQuery({
    queryKey: ["equity-curve", equityRange],
    queryFn: () => fetcher(`/api/stats/equity-curve?range=${equityRange}`),
  });

  const { data: byDow = [] } = useQuery({
    queryKey: ["by-dow"],
    queryFn: () => fetcher("/api/stats/by-dow?range=all"),
  });

  const { data: byHour = [] } = useQuery({
    queryKey: ["by-hour"],
    queryFn: () => fetcher("/api/stats/by-hour?range=all"),
  });

  const { data: bySymbol = [] } = useQuery({
    queryKey: ["by-symbol"],
    queryFn: () => fetcher("/api/stats/by-symbol?range=all"),
  });

  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", "month"],
    queryFn: () => fetcher("/api/trades?range=month&limit=25"),
  });

  const trades = tradesData?.trades ?? [];

  // Compute long/short breakdown from recent trades (simple approximation)
  const longTrades = trades.filter((t: { side: string }) => t.side === "LONG");
  const shortTrades = trades.filter((t: { side: string }) => t.side === "SHORT");
  const longStats = {
    count: longTrades.length,
    pnl: longTrades.reduce((s: number, t: { netPnl: number }) => s + t.netPnl, 0),
    wins: longTrades.filter((t: { netPnl: number }) => t.netPnl > 0).length,
  };
  const shortStats = {
    count: shortTrades.length,
    pnl: shortTrades.reduce((s: number, t: { netPnl: number }) => s + t.netPnl, 0),
    wins: shortTrades.filter((t: { netPnl: number }) => t.netPnl > 0).length,
  };

  const s = summary ?? {};

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Metric cards */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <MetricCard
          label="Net P&L"
          value={formatCurrency(s.netPnl ?? 0)}
          sub={`${s.totalTrades ?? 0} trades`}
          positive={s.netPnl >= 0}
          loading={summaryLoading}
        />
        <MetricCard
          label="Win Rate"
          value={`${(s.winRate ?? 0).toFixed(1)}%`}
          sub={`${s.winners ?? 0}W / ${s.losers ?? 0}L`}
          positive={s.winRate >= 50}
          loading={summaryLoading}
        />
        <MetricCard
          label="Profit Factor"
          value={(s.profitFactor ?? 0) === Infinity ? "∞" : (s.profitFactor ?? 0).toFixed(2)}
          positive={(s.profitFactor ?? 0) >= 1}
          loading={summaryLoading}
        />
        <MetricCard
          label="Total R"
          value={formatR(s.totalR ?? 0)}
          positive={(s.totalR ?? 0) >= 0}
          loading={summaryLoading}
        />
        <MetricCard
          label="Avg Win"
          value={formatCurrency(s.avgWin ?? 0)}
          positive
          loading={summaryLoading}
        />
        <MetricCard
          label="Avg Loss"
          value={formatCurrency(s.avgLoss ?? 0)}
          positive={false}
          loading={summaryLoading}
        />
        <MetricCard
          label="Largest Win"
          value={formatCurrency(s.largestWin ?? 0)}
          positive
          loading={summaryLoading}
        />
        <MetricCard
          label="Max Drawdown"
          value={formatCurrency(s.maxDrawdown ?? 0)}
          sub={`${(s.maxDrawdownPct ?? 0).toFixed(1)}%`}
          positive={false}
          loading={summaryLoading}
        />
      </div>

      {/* Equity Curve */}
      <Card
        title="Equity Curve"
        action={
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setEquityRange(o.value)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors",
                  equityRange === o.value
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)]"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="px-5 pb-5 h-64">
          {equityLoading ? (
            <div className="h-full bg-[var(--card-border)] rounded animate-pulse" />
          ) : (
            <EquityCurve data={equityCurve} />
          )}
        </div>
      </Card>

      {/* Day of Week + Hour */}
      <div className="grid grid-cols-2 gap-5">
        <Card title="P&L by Day of Week">
          <div className="px-5 pb-5 h-48">
            <ByDow data={byDow} />
          </div>
        </Card>
        <Card title="P&L by Time of Day">
          <div className="px-5 pb-5 h-48">
            <ByHour data={byHour} />
          </div>
        </Card>
      </div>

      {/* Long/Short + Top Symbols */}
      <div className="grid grid-cols-3 gap-5">
        <Card title="Long vs Short">
          <div className="px-5 pb-5 h-44">
            <LongShortDonut longs={longStats} shorts={shortStats} />
          </div>
        </Card>

        <Card title="Top Symbols" className="col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  {["Symbol", "Trades", "Win Rate", "Net P&L", "Avg R"].map((h) => (
                    <th key={h} className="text-left text-xs text-[var(--muted)] font-medium px-5 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySymbol.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-[var(--muted)] text-sm">No data</td></tr>
                ) : (
                  bySymbol.map((row: { symbol: string; count: number; winRate: number; pnl: number; avgR: number }) => (
                    <tr key={row.symbol} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)] transition-colors">
                      <td className="px-5 py-2.5 font-medium text-white">{row.symbol}</td>
                      <td className="px-5 py-2.5 text-[var(--muted)]">{row.count}</td>
                      <td className="px-5 py-2.5 text-[var(--muted)]">{row.winRate.toFixed(1)}%</td>
                      <td className={cn("px-5 py-2.5 font-medium", row.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                        {formatCurrency(row.pnl)}
                      </td>
                      <td className={cn("px-5 py-2.5", row.avgR >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                        {formatR(row.avgR)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card title="Recent Trades" action={
        <a href="/journal" className="text-xs text-[var(--accent)] hover:underline">View all →</a>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                {["Date", "Symbol", "Side", "Setup", "Entry", "Exit", "Qty", "Net P&L", "R", "Duration"].map((h) => (
                  <th key={h} className="text-left text-xs text-[var(--muted)] font-medium px-4 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tradesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--card-border)]">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-[var(--card-border)] rounded animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : trades.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--muted)]">No trades yet. Log your first trade!</td></tr>
              ) : (
                trades.map((t: {
                  id: string;
                  entryTime: string;
                  symbol: string;
                  side: string;
                  setupType?: string;
                  entryPrice: number;
                  exitPrice?: number;
                  quantity: number;
                  netPnl: number;
                  rRatio?: number;
                  holdDuration?: number;
                }) => (
                  <tr key={t.id} className="border-b border-[var(--card-border)] hover:bg-[var(--card-border)] transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 text-[var(--muted)] whitespace-nowrap text-xs">
                      {format(new Date(t.entryTime), "MMM d HH:mm")}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-white">{t.symbol}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", t.side === "LONG" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]")}>
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-xs">{t.setupType ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)]">${t.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)]">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)]">{t.quantity}</td>
                    <td className={cn("px-4 py-2.5 font-medium", t.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                      {formatCurrency(t.netPnl)}
                    </td>
                    <td className={cn("px-4 py-2.5 text-xs", (t.rRatio ?? 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                      {t.rRatio != null ? formatR(t.rRatio) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-xs">
                      {t.holdDuration ? formatDuration(t.holdDuration) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
