"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────
type Range = "week" | "month" | "quarter" | "ytd" | "6m" | "all";

interface SummaryData {
  empty?: boolean;
  totalTrades: number; winners: number; losers: number;
  netPnl: number; grossPnl: number; commissions: number;
  winRate: number; profitFactor: number; ev: number; kelly: number; sharpe: number; sharpePct: number;
  avgWin: number; avgLoss: number; largestWin: number; largestLoss: number;
  maxDrawdown: number; maxDrawdownPct: number; maxWinStreak: number; maxLossStreak: number;
  avgHoldDuration: number; totalR: number;
  equityCurve: { date: string; cumulative: number }[];
  rDistribution: { r: number; count: number }[];
  monthlyReturns: { month: string; pnl: number }[];
  drawdownPeriods: { start: string; end: string; depth: number; depthPct: number }[];
}
interface SymbolRow { symbol: string; pnl: number; count: number; winRate: number; avgR: number; avgPnl: number; longs: number; shorts: number; bestTrade: number; worstTrade: number; }
interface SetupRow { setup: string; pnl: number; count: number; winRate: number; avgR: number; profitFactor: number; ev: number; hasEdge: boolean; }
interface TimeData { byHour: { time: string; pnl: number; count: number; winRate: number }[]; byDow: { day: string; pnl: number; count: number; winRate: number }[]; byHoldDuration: { label: string; pnl: number; count: number; winRate: number }[]; }
interface PsychData { emotionScatter: { emotion: number; pnl: number }[]; byEmotion: { level: number; pnl: number; count: number; winRate: number }[]; mistakes: { tag: string; count: number; totalPnl: number; avgPnl: number }[]; disciplineTrend: { month: string; score: number }[]; }
interface RiskData { empty?: boolean; avgWin: number; avgLoss: number; winRate: number; kelly: number; avgR: number; avgMae: number; avgMfe: number; maxDrawdown: number; maxDrawdownPct: number; riskOfRuin: number; maxConsecLoss: number; maxConsecWin: number; dailyVolatility: number; payoffRatio: number; ddDistribution: { threshold: number; occurrences: number }[]; rHistogram: { range: string; count: number }[]; totalTrades: number; }
interface MonteCarloData { empty?: boolean; reason?: string; iterations: number; projectionTrades: number; finalEquity: { p10: number; p25: number; p50: number; p75: number; p90: number; worst: number; best: number }; maxDrawdown: { p50: number; p75: number; p90: number; p95: number }; probabilityOfProfit: number; fanData: { step: number; p10: number; p25: number; p50: number; p75: number; p90: number }[]; ddHistogram: { range: string; count: number; probability: number }[]; outcomeBreakdown: { loss: number; smallGain: number; largeGain: number }; }
interface HeatmapCell { day: string; hour: string; pnl: number; count: number; winRate: number; }
interface SymbolHeatCell { symbol: string; setup: string; pnl: number; count: number; winRate: number; }
interface HeatmapData { timeHeatmap: HeatmapCell[]; symbolHeatmap: SymbolHeatCell[]; hours: string[]; days: string[]; symbols: string[]; setups: string[]; }
interface OptionsData { empty: boolean; totalTrades: number; totalPnl: number; callTrades: number; putTrades: number; callPnl: number; putPnl: number; callWinRate: number; putWinRate: number; greeks: { avgIV: number; avgIVRank: number; avgDelta: number; avgGamma: number; avgTheta: number; avgVega: number; hasData: boolean; }; byExpiry: { expiry: string; pnl: number; trades: number; winRate: number }[]; byDTE: { bucket: string; pnl: number; trades: number; winRate: number }[]; byIVRank: { bucket: string; pnl: number; trades: number; winRate: number }[]; bySymbol: { symbol: string; pnl: number; trades: number; winRate: number; avgStrike: number | null }[]; }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined, prefix = "$") => { const n = v ?? 0; return `${prefix}${n >= 0 ? "" : "-"}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
const fmtPct = (v: number | null | undefined) => `${(v ?? 0).toFixed(1)}%`;
const pnlColor = (v: number | null | undefined) => ((v ?? 0) >= 0 ? "var(--green)" : "var(--red)");

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "1W", value: "week" }, { label: "1M", value: "month" }, { label: "3M", value: "quarter" },
  { label: "YTD", value: "ytd" }, { label: "6M", value: "6m" }, { label: "All", value: "all" },
];

const TABS = ["Performance", "Patterns", "Risk", "Psychology", "Options"] as const;
type Tab = (typeof TABS)[number];

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
      <p className="text-[var(--muted)] text-xs mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? "white" }}>{value}</p>
      {sub && <p className="text-[var(--muted)] text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">{children}</h3>;
}

// ── Performance Tab ───────────────────────────────────────────────────────────
function PerformanceTab({ summary, range }: { summary: SummaryData; range: Range }) {
  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Net P&L" value={fmt(summary.netPnl)} color={pnlColor(summary.netPnl)} />
        <StatCard label="Win Rate" value={fmtPct(summary.winRate)} sub={`${summary.winners}W / ${summary.losers}L`} />
        <StatCard label="Profit Factor" value={(summary.profitFactor ?? 0).toFixed(2)} sub={(summary.profitFactor ?? 0) >= 1.5 ? "Strong edge" : (summary.profitFactor ?? 0) >= 1 ? "Marginal" : "No edge"} color={(summary.profitFactor ?? 0) >= 1.5 ? "var(--green)" : (summary.profitFactor ?? 0) >= 1 ? "white" : "var(--red)"} />
        <StatCard label="Expected Value" value={fmt(summary.ev)} color={pnlColor(summary.ev)} sub="per trade" />
        <StatCard label="Sharpe ($)" value={(summary.sharpe ?? 0).toFixed(2)} sub="absolute P&L" color={(summary.sharpe ?? 0) >= 1 ? "var(--green)" : "var(--red)"} />
        <StatCard label="Sharpe (%)" value={(summary.sharpePct ?? 0).toFixed(2)} sub="% returns" color={(summary.sharpePct ?? 0) >= 1 ? "var(--green)" : "var(--red)"} />
        <StatCard label="Total R" value={`${(summary.totalR ?? 0) >= 0 ? "+" : ""}${(summary.totalR ?? 0).toFixed(1)}R`} color={pnlColor(summary.totalR ?? 0)} />
        <StatCard label="Avg Win" value={fmt(summary.avgWin)} color="var(--green)" />
        <StatCard label="Avg Loss" value={fmt(Math.abs(summary.avgLoss))} color="var(--red)" />
        <StatCard label="Largest Win" value={fmt(summary.largestWin)} color="var(--green)" />
        <StatCard label="Largest Loss" value={fmt(Math.abs(summary.largestLoss))} color="var(--red)" />
        <StatCard label="Max Drawdown" value={fmt(summary.maxDrawdown)} sub={fmtPct(summary.maxDrawdownPct)} color="var(--red)" />
        <StatCard label="Kelly %" value={fmtPct(summary.kelly)} sub="optimal risk" />
      </div>

      {/* Equity curve */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>Equity Curve</SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={summary.equityCurve} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
            <Tooltip formatter={(v: unknown) => [fmt(v as number), "Cumulative P&L"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} itemStyle={{ color: "var(--green)" }} />
            <ReferenceLine y={0} stroke="var(--card-border)" />
            <Area type="monotone" dataKey="cumulative" stroke="var(--green)" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly returns + R distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Monthly P&L</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.monthlyReturns} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip formatter={(v: unknown) => [fmt(v as number), "P&L"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {summary.monthlyReturns.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>R Multiple Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.rDistribution} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="r" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${v}R`} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} />
              <Tooltip formatter={(v: unknown) => [v as number, "Trades"]} labelFormatter={(v) => `${v}R`} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine x={0} stroke="var(--card-border)" />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {summary.rDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.r >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drawdown periods */}
      {summary.drawdownPeriods.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Drawdown Periods</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--card-border)]">
                {["Start", "End", "Depth ($)", "Depth (%)"].map((h) => (
                  <th key={h} className="text-left text-[var(--muted)] font-medium py-2 pr-6 text-xs">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {summary.drawdownPeriods.map((d, i) => (
                  <tr key={i} className="border-b border-[var(--card-border)] hover:bg-white/5">
                    <td className="py-2 pr-6 text-[var(--muted)]">{d.start}</td>
                    <td className="py-2 pr-6 text-[var(--muted)]">{d.end}</td>
                    <td className="py-2 pr-6 text-[var(--red)]">{fmt(d.depth)}</td>
                    <td className="py-2 pr-6 text-[var(--red)]">{fmtPct(d.depthPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Patterns Tab ─────────────────────────────────────────────────────────────
function PatternsTab({ time, symbols, setups, heatmap }: { time: TimeData; symbols: SymbolRow[]; setups: SetupRow[]; heatmap: HeatmapData | undefined }) {
  return (
    <div className="space-y-6">
      {/* By hour + by DOW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>P&L by Time of Day (ET)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={time.byHour} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 9 }} tickLine={false} interval={1} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "P&L"] : [fmtPct(v as number), "Win Rate"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {time.byHour.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>P&L by Day of Week</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={time.byDow} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "P&L"] : [fmtPct(v as number), "Win Rate"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {time.byDow.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hold duration */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>P&L by Hold Duration</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={time.byHoldDuration} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "P&L"] : [v as number, "Trades"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
            <ReferenceLine y={0} stroke="var(--card-border)" />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {time.byHoldDuration.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By symbol */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>Performance by Symbol</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--card-border)]">
              {["Symbol", "Trades", "Net P&L", "Win Rate", "Avg R", "Avg P&L", "Long/Short", "Best", "Worst"].map((h) => (
                <th key={h} className="text-left text-[var(--muted)] font-medium py-2 pr-5 text-xs">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {symbols.map((s) => (
                <tr key={s.symbol} className="border-b border-[var(--card-border)] hover:bg-white/5">
                  <td className="py-2 pr-5 font-semibold text-white">{s.symbol}</td>
                  <td className="py-2 pr-5 text-[var(--muted)]">{s.count}</td>
                  <td className="py-2 pr-5 font-mono" style={{ color: pnlColor(s.pnl) }}>{fmt(s.pnl)}</td>
                  <td className="py-2 pr-5 text-white">{fmtPct(s.winRate)}</td>
                  <td className="py-2 pr-5 font-mono" style={{ color: pnlColor(s.avgR) }}>{(s.avgR ?? 0).toFixed(2)}R</td>
                  <td className="py-2 pr-5 font-mono" style={{ color: pnlColor(s.avgPnl) }}>{fmt(s.avgPnl)}</td>
                  <td className="py-2 pr-5 text-[var(--muted)]">{s.longs}L / {s.shorts}S</td>
                  <td className="py-2 pr-5 font-mono text-[var(--green)]">{fmt(s.bestTrade)}</td>
                  <td className="py-2 pr-5 font-mono text-[var(--red)]">{fmt(s.worstTrade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By setup */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>Performance by Setup</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--card-border)]">
              {["Setup", "Trades", "Net P&L", "Win Rate", "Avg R", "Profit Factor", "EV/Trade", "Edge?"].map((h) => (
                <th key={h} className="text-left text-[var(--muted)] font-medium py-2 pr-5 text-xs">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {setups.map((s) => (
                <tr key={s.setup} className="border-b border-[var(--card-border)] hover:bg-white/5">
                  <td className="py-2 pr-5 font-semibold text-white">{s.setup}</td>
                  <td className="py-2 pr-5 text-[var(--muted)]">{s.count}</td>
                  <td className="py-2 pr-5 font-mono" style={{ color: pnlColor(s.pnl) }}>{fmt(s.pnl)}</td>
                  <td className="py-2 pr-5 text-white">{fmtPct(s.winRate)}</td>
                  <td className="py-2 pr-5 font-mono" style={{ color: pnlColor(s.avgR) }}>{(s.avgR ?? 0).toFixed(2)}R</td>
                  <td className="py-2 pr-5" style={{ color: (s.profitFactor ?? 0) >= 1.5 ? "var(--green)" : (s.profitFactor ?? 0) >= 1 ? "white" : "var(--red)" }}>{(s.profitFactor ?? 0).toFixed(2)}</td>
                  <td className="py-2 pr-5 font-mono" style={{ color: pnlColor(s.ev) }}>{fmt(s.ev)}</td>
                  <td className="py-2 pr-5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.hasEdge ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]"}`}>
                      {s.hasEdge ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correlation heatmaps */}
      {heatmap && heatmap.timeHeatmap.length > 0 && (
        <div className="space-y-4">
          {/* Time-of-day × DOW P&L heatmap */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
            <SectionTitle>P&L Heatmap — Time × Day</SectionTitle>
            <p className="text-xs text-[var(--muted)] mb-4">Darker green = profitable slot, darker red = losing slot. Empty = no trades.</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-0.5">
                <thead>
                  <tr>
                    <th className="text-[var(--muted)] font-normal pr-2 pb-1 text-right w-14">ET</th>
                    {heatmap.days.map((d) => (
                      <th key={d} className="text-[var(--muted)] font-medium pb-1 text-center w-16">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.hours.map((hour) => (
                    <tr key={hour}>
                      <td className="text-[var(--muted)] text-right pr-2 py-0.5 whitespace-nowrap">{hour}</td>
                      {heatmap.days.map((day) => {
                        const cell = heatmap.timeHeatmap.find((c) => c.day === day && c.hour === hour);
                        const pnl = cell?.pnl ?? 0;
                        const count = cell?.count ?? 0;
                        const intensity = count === 0 ? 0 : Math.min(Math.abs(pnl) / 200, 1);
                        const bg = count === 0
                          ? "rgba(255,255,255,0.04)"
                          : pnl >= 0
                          ? `rgba(0,200,120,${0.1 + intensity * 0.6})`
                          : `rgba(255,70,70,${0.1 + intensity * 0.6})`;
                        return (
                          <td key={day} title={count > 0 ? `${day} ${hour}: ${count} trades, $${pnl.toFixed(2)}` : "No trades"}
                            className="rounded w-16 h-8 text-center cursor-default transition-opacity hover:opacity-80"
                            style={{ background: bg }}>
                            {count > 0 && (
                              <span className={`font-medium ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                                {pnl >= 0 ? "+" : ""}{pnl >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Symbol × Setup heatmap */}
          {heatmap.symbols.length > 0 && heatmap.setups.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
              <SectionTitle>P&L Heatmap — Symbol × Setup</SectionTitle>
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-0.5">
                  <thead>
                    <tr>
                      <th className="text-[var(--muted)] font-normal pr-2 pb-1 text-right w-16">Symbol</th>
                      {heatmap.setups.map((s) => (
                        <th key={s} className="text-[var(--muted)] font-medium pb-1 text-center px-1 max-w-20 truncate">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.symbols.map((sym) => (
                      <tr key={sym}>
                        <td className="text-white font-semibold text-right pr-2 py-0.5">{sym}</td>
                        {heatmap.setups.map((setup) => {
                          const cell = heatmap.symbolHeatmap.find((c) => c.symbol === sym && c.setup === setup);
                          const pnl = cell?.pnl ?? 0;
                          const count = cell?.count ?? 0;
                          const intensity = count === 0 ? 0 : Math.min(Math.abs(pnl) / 300, 1);
                          const bg = count === 0
                            ? "rgba(255,255,255,0.04)"
                            : pnl >= 0
                            ? `rgba(0,200,120,${0.1 + intensity * 0.6})`
                            : `rgba(255,70,70,${0.1 + intensity * 0.6})`;
                          return (
                            <td key={setup} title={count > 0 ? `${sym} / ${setup}: ${count} trades, $${pnl.toFixed(2)}` : "No trades"}
                              className="rounded w-20 h-8 text-center cursor-default transition-opacity hover:opacity-80"
                              style={{ background: bg }}>
                              {count > 0 && (
                                <span className={`font-medium ${pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                                  {pnl >= 0 ? "+" : ""}{pnl >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Risk Tab ──────────────────────────────────────────────────────────────────
function RiskTab({ risk, monteCarlo }: { risk: RiskData; monteCarlo: MonteCarloData }) {
  const OUTCOME_COLORS = ["var(--red)", "var(--accent)", "var(--green)"];
  const outcomeData = monteCarlo.empty ? [] : [
    { name: "Loss", value: monteCarlo.outcomeBreakdown.loss },
    { name: "Small Gain", value: monteCarlo.outcomeBreakdown.smallGain },
    { name: "Large Gain", value: monteCarlo.outcomeBreakdown.largeGain },
  ];

  return (
    <div className="space-y-6">
      {/* Risk KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Kelly Criterion" value={fmtPct(risk.kelly)} sub="optimal position size" color={risk.kelly > 0 ? "var(--green)" : "var(--red)"} />
        <StatCard label="Payoff Ratio" value={(risk.payoffRatio ?? 0).toFixed(2)} sub="avg win / avg loss" />
        <StatCard label="Risk of Ruin" value={fmtPct(risk.riskOfRuin)} color={risk.riskOfRuin < 5 ? "var(--green)" : risk.riskOfRuin < 20 ? "white" : "var(--red)"} sub="est. probability" />
        <StatCard label="Daily Volatility" value={fmt(risk.dailyVolatility)} sub="std dev of daily P&L" />
        <StatCard label="Max Consec Losses" value={String(risk.maxConsecLoss)} color="var(--red)" />
        <StatCard label="Max Consec Wins" value={String(risk.maxConsecWin)} color="var(--green)" />
        <StatCard label="Avg MAE (R)" value={`${(risk.avgMae ?? 0).toFixed(2)}R`} sub="max adverse excursion" />
        <StatCard label="Avg MFE (R)" value={`${(risk.avgMfe ?? 0).toFixed(2)}R`} sub="max favorable excursion" />
      </div>

      {/* R histogram */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>R Multiple Distribution</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={risk.rHistogram} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} />
            <Tooltip formatter={(v: unknown) => [v as number, "Trades"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {risk.rHistogram.map((entry, i) => (
                <Cell key={i} fill={entry.range.startsWith("-") || entry.range.startsWith("<-") ? "var(--red)" : "var(--green)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monte Carlo section */}
      {monteCarlo.empty ? (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-8 text-center text-[var(--muted)]">
          {monteCarlo.reason ?? "Not enough trades for Monte Carlo simulation."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Prob. of Profit" value={fmtPct(monteCarlo.probabilityOfProfit)} color={monteCarlo.probabilityOfProfit >= 60 ? "var(--green)" : "var(--red)"} sub={`${monteCarlo.iterations.toLocaleString()} simulations`} />
            <StatCard label="Median Outcome" value={fmt(monteCarlo.finalEquity.p50)} color={pnlColor(monteCarlo.finalEquity.p50)} />
            <StatCard label="Best 10% Outcome" value={fmt(monteCarlo.finalEquity.p90)} color="var(--green)" />
            <StatCard label="Worst 10% Outcome" value={fmt(monteCarlo.finalEquity.p10)} color="var(--red)" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
              <SectionTitle>Monte Carlo Fan Chart ({monteCarlo.projectionTrades} trades forward)</SectionTitle>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monteCarlo.fanData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="step" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} label={{ value: "Trade #", position: "insideBottom", offset: -2, fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                  <Tooltip formatter={(v: unknown, name: unknown) => [fmt(v as number), name as string]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
                  <ReferenceLine y={0} stroke="var(--card-border)" />
                  <Line type="monotone" dataKey="p10" stroke="var(--red)" strokeWidth={1.5} dot={false} name="P10" />
                  <Line type="monotone" dataKey="p25" stroke="#f97316" strokeWidth={1.5} dot={false} name="P25" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="p50" stroke="white" strokeWidth={2} dot={false} name="Median" />
                  <Line type="monotone" dataKey="p75" stroke="#86efac" strokeWidth={1.5} dot={false} name="P75" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="p90" stroke="var(--green)" strokeWidth={1.5} dot={false} name="P90" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
              <SectionTitle>Outcome Distribution</SectionTitle>
              <div className="flex items-center justify-center" style={{ height: 240 }}>
                <PieChart width={280} height={220}>
                  <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {outcomeData.map((_, i) => <Cell key={i} fill={OUTCOME_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [fmtPct(v as number), ""]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
                  <Legend formatter={(v) => <span style={{ color: "var(--muted)", fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </div>
            </div>
          </div>

          {/* Drawdown expectations */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
            <SectionTitle>Expected Drawdown (Monte Carlo)</SectionTitle>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "50th Percentile DD", value: fmtPct(monteCarlo.maxDrawdown.p50) },
                { label: "75th Percentile DD", value: fmtPct(monteCarlo.maxDrawdown.p75) },
                { label: "90th Percentile DD", value: fmtPct(monteCarlo.maxDrawdown.p90) },
                { label: "95th Percentile DD", value: fmtPct(monteCarlo.maxDrawdown.p95) },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 bg-[var(--red-dim)] rounded-lg">
                  <p className="text-[var(--muted)] text-xs mb-1">{item.label}</p>
                  <p className="text-[var(--red)] text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Psychology Tab ────────────────────────────────────────────────────────────
function PsychologyTab({ psych }: { psych: PsychData }) {
  return (
    <div className="space-y-6">
      {/* Win rate by emotion level */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>P&L by Emotion Level (Pre-Trade)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={psych.byEmotion} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="level" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}`} label={{ value: "Emotion (1–10)", position: "insideBottom", offset: -2, fill: "var(--muted)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "Total P&L"] : [fmtPct(v as number), "Win Rate"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {psych.byEmotion.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Emotion vs P&L (Scatter)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis type="number" dataKey="emotion" name="Emotion" domain={[1, 10]} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} label={{ value: "Pre-trade emotion", position: "insideBottom", offset: -2, fill: "var(--muted)", fontSize: 10 }} />
              <YAxis type="number" dataKey="pnl" name="P&L" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => [name === "pnl" ? fmt(v as number) : v as number, name === "pnl" ? "P&L" : "Emotion"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Scatter data={psych.emotionScatter} fill="var(--accent)" opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Discipline trend */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>Monthly Discipline Score (% trades with no mistake tags)</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={psych.disciplineTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="discGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: unknown) => [fmtPct(v as number), "Discipline Score"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
            <ReferenceLine y={80} stroke="var(--green)" strokeDasharray="4 2" label={{ value: "Target 80%", fill: "var(--green)", fontSize: 10 }} />
            <Area type="monotone" dataKey="score" stroke="var(--accent)" fill="url(#discGrad)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Mistakes table */}
      {psych.mistakes.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Mistake Analysis</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--card-border)]">
                {["Mistake Tag", "Occurrences", "Total P&L Impact", "Avg P&L Impact"].map((h) => (
                  <th key={h} className="text-left text-[var(--muted)] font-medium py-2 pr-6 text-xs">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {psych.mistakes.map((m) => (
                  <tr key={m.tag} className="border-b border-[var(--card-border)] hover:bg-white/5">
                    <td className="py-2 pr-6 font-semibold text-white">{m.tag}</td>
                    <td className="py-2 pr-6 text-[var(--muted)]">{m.count}</td>
                    <td className="py-2 pr-6 font-mono" style={{ color: pnlColor(m.totalPnl) }}>{fmt(m.totalPnl)}</td>
                    <td className="py-2 pr-6 font-mono" style={{ color: pnlColor(m.avgPnl) }}>{fmt(m.avgPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Options Tab ───────────────────────────────────────────────────────────────
function OptionsTab({ data }: { data: OptionsData }) {
  const callPct = data.totalTrades > 0 ? (data.callTrades / data.totalTrades) * 100 : 0;
  const putPct = data.totalTrades > 0 ? (data.putTrades / data.totalTrades) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Call vs Put summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Options Trades" value={String(data.totalTrades)} />
        <StatCard label="Options P&L" value={fmt(data.totalPnl)} color={pnlColor(data.totalPnl)} />
        <StatCard label="Calls" value={String(data.callTrades)} sub={`${callPct.toFixed(0)}% of trades · ${fmtPct(data.callWinRate)} WR`} color="var(--green)" />
        <StatCard label="Puts" value={String(data.putTrades)} sub={`${putPct.toFixed(0)}% of trades · ${fmtPct(data.putWinRate)} WR`} color="var(--red)" />
      </div>

      {/* Call vs Put P&L comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Call vs Put P&L</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[{ name: "Calls", pnl: data.callPnl }, { name: "Puts", pnl: data.putPnl }]} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip formatter={(v: unknown) => [fmt(v as number), "P&L"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                <Cell fill="var(--green)" />
                <Cell fill="var(--red)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* P&L by IV Rank bucket */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>P&L by IV Rank Bucket</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byIVRank} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "P&L"] : [fmtPct(v as number), "Win Rate"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {data.byIVRank.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* P&L by DTE */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
        <SectionTitle>P&L by Days-to-Expiry (DTE) at Entry</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byDTE} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
            <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "P&L"] : name === "winRate" ? [fmtPct(v as number), "Win Rate"] : [v as number, "Trades"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
            <ReferenceLine y={0} stroke="var(--card-border)" />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {data.byDTE.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* P&L by expiry date */}
      {data.byExpiry.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>P&L by Expiration Cycle</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byExpiry} margin={{ top: 4, right: 8, left: 8, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
              <XAxis dataKey="expiry" tick={{ fill: "var(--muted)", fontSize: 9 }} tickLine={false} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip formatter={(v: unknown, name: unknown) => name === "pnl" ? [fmt(v as number), "P&L"] : [v as number, "Trades"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceLine y={0} stroke="var(--card-border)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {data.byExpiry.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "var(--green)" : "var(--red)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Greeks averages */}
      {data.greeks.hasData && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Average Greeks at Entry</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Avg IV" value={`${data.greeks.avgIV.toFixed(1)}%`} sub="implied volatility" />
            <StatCard label="Avg IV Rank" value={`${data.greeks.avgIVRank.toFixed(0)}`} sub="0–100 percentile" color={data.greeks.avgIVRank >= 50 ? "var(--green)" : "var(--red)"} />
            <StatCard label="Avg Delta" value={data.greeks.avgDelta.toFixed(3)} sub="directional exposure" />
            <StatCard label="Avg Gamma" value={data.greeks.avgGamma.toFixed(4)} sub="delta sensitivity" />
            <StatCard label="Avg Theta" value={data.greeks.avgTheta.toFixed(3)} sub="daily decay" color="var(--green)" />
            <StatCard label="Avg Vega" value={data.greeks.avgVega.toFixed(3)} sub="IV sensitivity" />
          </div>
        </div>
      )}

      {/* By symbol table */}
      {data.bySymbol.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
          <SectionTitle>Top Underlying Symbols</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--card-border)]">
                {["Symbol", "Trades", "Net P&L", "Win Rate", "Avg Strike"].map((h) => (
                  <th key={h} className="text-left text-[var(--muted)] font-medium py-2 pr-6 text-xs">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.bySymbol.map((s) => (
                  <tr key={s.symbol} className="border-b border-[var(--card-border)] hover:bg-white/5">
                    <td className="py-2 pr-6 font-semibold text-white">{s.symbol}</td>
                    <td className="py-2 pr-6 text-[var(--muted)]">{s.trades}</td>
                    <td className="py-2 pr-6 font-mono" style={{ color: pnlColor(s.pnl) }}>{fmt(s.pnl)}</td>
                    <td className="py-2 pr-6 text-white">{fmtPct(s.winRate)}</td>
                    <td className="py-2 pr-6 text-[var(--muted)]">{s.avgStrike != null ? fmt(s.avgStrike, "$") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("Performance");
  const [range, setRange] = useState<Range>("all");

  const qs = `range=${range}`;

  const summary = useQuery<SummaryData>({ queryKey: ["analytics-summary", range], queryFn: () => fetch(`/api/analytics/summary?${qs}`).then((r) => r.json()) });
  const symbols = useQuery<SymbolRow[]>({ queryKey: ["analytics-symbols", range], queryFn: () => fetch(`/api/analytics/by-symbol?${qs}`).then((r) => r.json()), enabled: tab === "Patterns" });
  const setups = useQuery<SetupRow[]>({ queryKey: ["analytics-setups", range], queryFn: () => fetch(`/api/analytics/by-setup?${qs}`).then((r) => r.json()), enabled: tab === "Patterns" });
  const timeData = useQuery<TimeData>({ queryKey: ["analytics-time", range], queryFn: () => fetch(`/api/analytics/by-time?${qs}`).then((r) => r.json()), enabled: tab === "Patterns" });
  const heatmap = useQuery<HeatmapData>({ queryKey: ["analytics-heatmap", range], queryFn: () => fetch(`/api/analytics/heatmap?${qs}`).then((r) => r.json()), enabled: tab === "Patterns" });
  const psych = useQuery<PsychData>({ queryKey: ["analytics-psych", range], queryFn: () => fetch(`/api/analytics/psychology?${qs}`).then((r) => r.json()), enabled: tab === "Psychology" });
  const risk = useQuery<RiskData>({ queryKey: ["analytics-risk", range], queryFn: () => fetch(`/api/analytics/risk?${qs}`).then((r) => r.json()), enabled: tab === "Risk" });
  const monteCarlo = useQuery<MonteCarloData>({ queryKey: ["analytics-mc", range], queryFn: () => fetch(`/api/analytics/monte-carlo?${qs}`).then((r) => r.json()), enabled: tab === "Risk" });
  const options = useQuery<OptionsData>({ queryKey: ["analytics-options", range], queryFn: () => fetch(`/api/analytics/options?${qs}`).then((r) => r.json()), enabled: tab === "Options" });

  const isLoading = summary.isLoading || (tab === "Patterns" && (symbols.isLoading || setups.isLoading || timeData.isLoading || heatmap.isLoading)) || (tab === "Psychology" && psych.isLoading) || (tab === "Risk" && (risk.isLoading || monteCarlo.isLoading)) || (tab === "Options" && options.isLoading);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Deep-dive into your trading performance</p>
        </div>
        <div className="flex gap-1 bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-1">
          {RANGE_OPTIONS.map((r) => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${range === r.value ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--card-border)]">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--muted)] hover:text-white"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </div>
      ) : summary.data?.empty ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-[var(--muted)] text-sm">No closed trades found for this period.</p>
          <p className="text-[var(--muted)] text-xs mt-1">Log some trades to see analytics.</p>
        </div>
      ) : summary.data && (
        <>
          {tab === "Performance" && <PerformanceTab summary={summary.data} range={range} />}
          {tab === "Patterns" && timeData.data && symbols.data && setups.data && (
            <PatternsTab time={timeData.data} symbols={symbols.data} setups={setups.data} heatmap={heatmap.data} />
          )}
          {tab === "Risk" && risk.data && !risk.data.empty && monteCarlo.data && (
            <RiskTab risk={risk.data} monteCarlo={monteCarlo.data} />
          )}
          {tab === "Risk" && risk.data?.empty && (
            <div className="flex items-center justify-center h-64 text-[var(--muted)] text-sm">No trade data for risk analysis.</div>
          )}
          {tab === "Psychology" && psych.data && <PsychologyTab psych={psych.data} />}
          {tab === "Options" && options.data && !options.data.empty && <OptionsTab data={options.data} />}
          {tab === "Options" && options.data?.empty && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-[var(--muted)] text-sm">No closed options trades found for this period.</p>
              <p className="text-[var(--muted)] text-xs mt-1">Import or log options trades to see greeks and expiry analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
