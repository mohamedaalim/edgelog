"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { Card } from "@/components/shared/Card";
import { Sparkline } from "@/components/charts/Sparkline";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { DailyPnLBars } from "@/components/charts/DailyPnLBars";
import { SetupBars } from "@/components/charts/SetupBars";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Download } from "lucide-react";

const TABS = ["Overview", "Comparative", "Seasonality"] as const;
type Tab = typeof TABS[number];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthSummary {
  month: string;
  label: string;
  netPnl: number;
  grossPnl: number;
  commissions: number;
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  sparkline: number[];
  hasTrades: boolean;
}

interface YearData {
  year: number;
  months: MonthSummary[];
  yearNetPnl: number;
  profitableMonths: number;
  bestMonth: string;
  worstMonth: string;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
}

interface DetailData {
  netPnl: number;
  grossPnl: number;
  commissions: number;
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  bestDay: number;
  worstDay: number;
  avgDay: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxWinStreak: number;
  maxLossStreak: number;
  dailyPnl: { date: string; pnl: number; cumulative: number }[];
  weeklyPnl: { week: string; pnl: number; count: number }[];
  bySymbol: { symbol: string; pnl: number; count: number; winRate: number }[];
  bySetup: { setup: string; pnl: number; count: number; winRate: number }[];
}

function StatPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className={cn("text-sm font-semibold", positive === true ? "text-[var(--green)]" : positive === false ? "text-[var(--red)]" : "text-white")}>
        {value}
      </span>
    </div>
  );
}

function MonthCard({ m, isSelected, isBest, isWorst, onClick }: {
  m: MonthSummary; isSelected: boolean; isBest: boolean; isWorst: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-all",
        isSelected
          ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]"
          : m.hasTrades
            ? m.netPnl >= 0
              ? "border-green-800/40 bg-[var(--green)]/5 hover:bg-[var(--green)]/10"
              : "border-red-800/40 bg-[var(--red)]/5 hover:bg-[var(--red)]/10"
            : "border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--card-border)]"
      )}
    >
      {(isBest || isWorst) && (
        <span className={cn("absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded", isBest ? "bg-green-800/60 text-[var(--green)]" : "bg-red-800/60 text-[var(--red)]")}>
          {isBest ? "BEST" : "WORST"}
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">{m.label}</span>
        {m.hasTrades && <Sparkline data={m.sparkline} width={60} height={24} positive={m.netPnl >= 0} />}
      </div>
      <span className={cn("text-base font-bold", m.hasTrades ? m.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]" : "text-[var(--muted)]")}>
        {m.hasTrades ? formatCurrency(m.netPnl) : "—"}
      </span>
      {m.hasTrades && (
        <div className="flex gap-2 text-xs text-[var(--muted)]">
          <span>{m.totalTrades}T</span>
          <span>{(m.winRate ?? 0).toFixed(0)}%WR</span>
          <span>{(m.avgR ?? 0).toFixed(1)}R</span>
        </div>
      )}
    </button>
  );
}

// ── Comparative tab ────────────────────────────────────────────────────────
function ComparativeTab({ months, year }: { months: MonthSummary[]; year: number }) {
  const activeMths = months.filter((m) => m.hasTrades);
  const [monthA, setMonthA] = useState(activeMths[activeMths.length - 2]?.month ?? "");
  const [monthB, setMonthB] = useState(activeMths[activeMths.length - 1]?.month ?? "");

  const { data: dataA } = useQuery<DetailData>({
    queryKey: ["month-detail", monthA],
    queryFn: () => fetch(`/api/stats/monthly/detail?month=${monthA}`).then((r) => r.json()),
    enabled: !!monthA,
  });
  const { data: dataB } = useQuery<DetailData>({
    queryKey: ["month-detail", monthB],
    queryFn: () => fetch(`/api/stats/monthly/detail?month=${monthB}`).then((r) => r.json()),
    enabled: !!monthB,
  });

  const rows = [
    { label: "Net P&L", aVal: dataA?.netPnl, bVal: dataB?.netPnl, fmt: formatCurrency, higherBetter: true },
    { label: "Win Rate", aVal: dataA?.winRate, bVal: dataB?.winRate, fmt: (v: number) => `${v.toFixed(1)}%`, higherBetter: true },
    { label: "Trades", aVal: dataA?.totalTrades, bVal: dataB?.totalTrades, fmt: (v: number) => String(v), higherBetter: null },
    { label: "Profit Factor", aVal: dataA?.profitFactor, bVal: dataB?.profitFactor, fmt: (v: number) => v.toFixed(2), higherBetter: true },
    { label: "Avg R", aVal: dataA?.avgR, bVal: dataB?.avgR, fmt: (v: number) => `${v.toFixed(2)}R`, higherBetter: true },
    { label: "Best Day", aVal: dataA?.bestDay, bVal: dataB?.bestDay, fmt: formatCurrency, higherBetter: true },
    { label: "Worst Day", aVal: dataA?.worstDay, bVal: dataB?.worstDay, fmt: formatCurrency, higherBetter: true },
    { label: "Max Drawdown", aVal: dataA?.maxDrawdown, bVal: dataB?.maxDrawdown, fmt: formatCurrency, higherBetter: false },
  ];

  const mOpts = activeMths.map((m) => ({ value: m.month, label: format(parseISO(`${m.month}-01`), "MMMM yyyy") }));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {[{ val: monthA, set: setMonthA, label: "Month A" }, { val: monthB, set: setMonthB, label: "Month B" }].map(({ val, set, label }) => (
          <div key={label} className="flex-1">
            <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
            <select value={val} onChange={(e) => set(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--accent)]">
              {mOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--card-border)]">
              <th className="text-left text-xs text-[var(--muted)] px-4 py-3">Metric</th>
              <th className="text-right text-xs text-[var(--muted)] px-4 py-3">{monthA ? format(parseISO(`${monthA}-01`), "MMM yy") : "—"}</th>
              <th className="text-right text-xs text-[var(--muted)] px-4 py-3">{monthB ? format(parseISO(`${monthB}-01`), "MMM yy") : "—"}</th>
              <th className="text-right text-xs text-[var(--muted)] px-4 py-3">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const a = row.aVal, b = row.bVal;
              const delta = a != null && b != null ? b - a : null;
              const aWins = row.higherBetter != null && a != null && b != null ? (row.higherBetter ? a > b : a < b) : false;
              const bWins = row.higherBetter != null && a != null && b != null ? (row.higherBetter ? b > a : b < a) : false;
              return (
                <tr key={row.label} className="border-b border-[var(--card-border)] last:border-0">
                  <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.label}</td>
                  <td className={cn("px-4 py-2.5 text-right text-sm font-medium", aWins ? "text-[var(--green)]" : "text-white")}>
                    {a != null ? row.fmt(a) : "—"}
                  </td>
                  <td className={cn("px-4 py-2.5 text-right text-sm font-medium", bWins ? "text-[var(--green)]" : "text-white")}>
                    {b != null ? row.fmt(b) : "—"}
                  </td>
                  <td className={cn("px-4 py-2.5 text-right text-xs", delta == null ? "text-[var(--muted)]" : delta > 0 ? "text-[var(--green)]" : delta < 0 ? "text-[var(--red)]" : "text-[var(--muted)]")}>
                    {delta != null ? `${delta > 0 ? "+" : ""}${row.fmt(delta)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Seasonality tab ────────────────────────────────────────────────────────
function SeasonalityTab({ allYears }: { allYears: number[] }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["seasonality"],
    queryFn: async () => {
      const results = await Promise.all(
        allYears.map((y) => fetch(`/api/stats/monthly?year=${y}`).then((r) => r.json()))
      );
      // avg P&L per month across all years
      const totals: Record<number, { pnl: number; count: number }> = {};
      for (let i = 0; i < 12; i++) totals[i] = { pnl: 0, count: 0 };
      for (const yr of results) {
        for (const m of yr.months ?? []) {
          const idx = parseInt(m.month.slice(5, 7)) - 1;
          if (m.hasTrades) { totals[idx].pnl += m.netPnl; totals[idx].count++; }
        }
      }
      return Array.from({ length: 12 }, (_, i) => ({
        month: MONTH_NAMES[i],
        avgPnl: totals[i].count > 0 ? totals[i].pnl / totals[i].count : 0,
        count: totals[i].count,
      }));
    },
    enabled: allYears.length > 0,
  });

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.avgPnl)), 1);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted)]">Average P&L per calendar month across all years of data</p>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {rows.map((r) => {
          const intensity = Math.abs(r.avgPnl) / maxAbs;
          const isPos = r.avgPnl >= 0;
          return (
            <div key={r.month} className="flex flex-col items-center gap-1">
              <div
                className={cn("w-full rounded-lg flex items-end justify-center pb-1", isPos ? "bg-[var(--green)]" : "bg-[var(--red)]")}
                style={{ height: `${Math.max(intensity * 80, 8)}px`, opacity: 0.3 + intensity * 0.7 }}
              />
              <span className="text-xs font-medium text-white">{r.month}</span>
              <span className={cn("text-xs", isPos ? "text-[var(--green)]" : "text-[var(--red)]")}>
                {r.avgPnl >= 0 ? "+" : ""}{(r.avgPnl / 1000).toFixed(1)}k
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MonthlyPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data: yearData, isLoading } = useQuery<YearData>({
    queryKey: ["monthly", year],
    queryFn: () => fetch(`/api/stats/monthly?year=${year}`).then((r) => r.json()),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<DetailData>({
    queryKey: ["month-detail", selectedMonth],
    queryFn: () => fetch(`/api/stats/monthly/detail?month=${selectedMonth}`).then((r) => r.json()),
    enabled: !!selectedMonth,
  });

  const months = yearData?.months ?? [];
  const allYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const detailMonth = selectedMonth ? format(parseISO(`${selectedMonth}-01`), "MMMM yyyy") : "";

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Monthly Performance</h1>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors", activeTab === t ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)]")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Overview" && (
        <>
          {/* Year selector + year stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(y => Math.max(y - 1, 2000))} disabled={year <= 2000} className="p-1.5 rounded-lg hover:bg-[var(--card-border)] text-[var(--muted)] hover:text-white transition-colors disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="text-base font-bold text-white w-12 text-center">{year}</span>
              <button onClick={() => setYear(y => Math.min(y + 1, currentYear))} disabled={year >= currentYear}
                className="p-1.5 rounded-lg hover:bg-[var(--card-border)] text-[var(--muted)] hover:text-white transition-colors disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
            {yearData && (
              <div className="flex gap-5">
                <StatPill label="Year P&L" value={formatCurrency(yearData.yearNetPnl)} positive={yearData.yearNetPnl >= 0} />
                <StatPill label="Profitable Months" value={`${yearData.profitableMonths}/12`} positive={yearData.profitableMonths >= 6} />
                <StatPill label="Win Rate" value={`${yearData.winRate?.toFixed(1) ?? 0}%`} positive={(yearData.winRate ?? 0) >= 50} />
                <StatPill label="Total Trades" value={String(yearData.totalTrades)} />
                <StatPill label="Max Drawdown" value={formatCurrency(yearData.maxDrawdown ?? 0)} positive={false} />
              </div>
            )}
          </div>

          {/* 12-month grid */}
          {isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-28 bg-[var(--card)] border border-[var(--card-border)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {months.map((m) => (
                <MonthCard
                  key={m.month}
                  m={m}
                  isSelected={selectedMonth === m.month}
                  isBest={yearData?.bestMonth === m.month && m.hasTrades}
                  isWorst={yearData?.worstMonth === m.month && m.hasTrades && m.netPnl < 0}
                  onClick={() => setSelectedMonth(selectedMonth === m.month ? null : m.month)}
                />
              ))}
            </div>
          )}

          {/* Month detail panel */}
          {selectedMonth && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">{detailMonth}</h2>
                <button onClick={() => setSelectedMonth(null)} className="text-xs text-[var(--muted)] hover:text-white transition-colors">✕ Close</button>
              </div>

              {detailLoading ? (
                <div className="h-48 bg-[var(--card)] border border-[var(--card-border)] rounded-xl animate-pulse" />
              ) : detail ? (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                    {[
                      { label: "Net P&L", value: formatCurrency(detail.netPnl), positive: detail.netPnl >= 0 },
                      { label: "Win Rate", value: `${(detail.winRate ?? 0).toFixed(1)}%`, positive: (detail.winRate ?? 0) >= 50 },
                      { label: "Profit Factor", value: (detail.profitFactor ?? 0).toFixed(2), positive: (detail.profitFactor ?? 0) >= 1 },
                      { label: "Avg R", value: `${(detail.avgR ?? 0).toFixed(2)}R`, positive: (detail.avgR ?? 0) >= 0 },
                      { label: "Best Day", value: formatCurrency(detail.bestDay), positive: true },
                      { label: "Worst Day", value: formatCurrency(detail.worstDay), positive: false },
                      { label: "Max Streak W", value: String(detail.maxWinStreak) },
                      { label: "Max Streak L", value: String(detail.maxLossStreak) },
                    ].map(({ label, value, positive }) => (
                      <div key={label} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
                        <p className={cn("text-sm font-bold", positive === true ? "text-[var(--green)]" : positive === false ? "text-[var(--red)]" : "text-white")}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card title="Equity Curve">
                      <div className="px-4 pb-4 h-52">
                        <EquityCurve data={detail.dailyPnl.map((d) => ({ date: d.date, dailyPnl: d.pnl, cumulative: d.cumulative }))} />
                      </div>
                    </Card>
                    <Card title="Daily P&L">
                      <div className="px-4 pb-4 h-52">
                        <DailyPnLBars data={detail.dailyPnl} />
                      </div>
                    </Card>
                  </div>

                  {/* Bottom row */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card title="Win Rate by Setup">
                      <div className="px-4 pb-4 h-48">
                        <SetupBars data={detail.bySetup} />
                      </div>
                    </Card>
                    <Card title="Top Symbols">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--card-border)]">
                            {["Symbol", "Trades", "Win %", "Net P&L"].map((h) => (
                              <th key={h} className="text-left text-xs text-[var(--muted)] px-4 py-2.5">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.bySymbol.map((s) => (
                            <tr key={s.symbol} className="border-b border-[var(--card-border)] last:border-0">
                              <td className="px-4 py-2 font-medium text-white">{s.symbol}</td>
                              <td className="px-4 py-2 text-[var(--muted)]">{s.count}</td>
                              <td className="px-4 py-2 text-[var(--muted)]">{(s.winRate ?? 0).toFixed(0)}%</td>
                              <td className={cn("px-4 py-2 font-medium", s.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>{formatCurrency(s.pnl)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}

      {activeTab === "Comparative" && (
        <ComparativeTab months={months} year={year} />
      )}

      {activeTab === "Seasonality" && (
        <SeasonalityTab allYears={allYears} />
      )}
    </div>
  );
}
