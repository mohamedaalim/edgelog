"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Clock, Target, AlertTriangle, BarChart2,
} from "lucide-react";
import { TradeChart } from "@/components/charts/TradeChart";
import { format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isSameMonth, isToday, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Execution {
  id: string;
  type: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
}

interface ReplayTrade {
  id: string;
  symbol: string;
  assetClass: string;
  side: "LONG" | "SHORT";
  status: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  entryTime: string;
  exitTime: string | null;
  holdDuration: number | null;
  grossPnl: number;
  netPnl: number;
  commission: number;
  rRatio: number | null;
  maxAdverseExcursion: number | null;
  maxFavorableExcursion: number | null;
  setupType: string | null;
  timeframe: string | null;
  marketCondition: string | null;
  emotionBefore: number | null;
  emotionAfter: number | null;
  confidence: number | null;
  mistakeTags: string[];
  setupTags: string[];
  notes: string | null;
  lessonsLearned: string | null;
  rulesFollowed: boolean;
  account: { name: string; broker: string | null } | null;
  executions: Execution[];
}

interface JournalData {
  marketBias: string | null;
  prePlanning: string | null;
  postReview: string | null;
  whatWentWell: string | null;
  whatWentWrong: string | null;
  mood: number | null;
  energyLevel: number | null;
  focus: number | null;
  grade: string | null;
  maxLossLimit: number | null;
  targetProfit: number | null;
  rulesFollowed: string[];
  rulesBroken: string[];
}

interface EquityPoint { time: string; pnl: number; cumPnl: number; symbol: string }

interface SessionStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  totalPnl: number;
  totalCommissions: number;
  avgWin: number;
  avgLoss: number;
  avgR: number;
  maxIntradayDrawdown: number;
  bestTrade: number;
  worstTrade: number;
}

interface ReplayData {
  date: string;
  trades: ReplayTrade[];
  equityCurve: EquityPoint[];
  journal: JournalData | null;
  stats: SessionStats;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  (n >= 0 ? "+" : "") + n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const fmtDur = (s: number | null) => {
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const emotionLabel = (v: number | null) => {
  if (!v) return "—";
  const labels = ["", "Fearful", "Anxious", "Uneasy", "Calm", "Neutral", "Focused", "Confident", "In-the-zone", "Peak", "Flow"];
  return labels[v] ?? `${v}/10`;
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-3">
      <div className="text-xs text-[var(--muted)] mb-1">{label}</div>
      <div className={`text-lg font-semibold ${positive === true ? "text-[var(--green)]" : positive === false ? "text-[var(--red)]" : "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Trade card ────────────────────────────────────────────────────────────────
function TradeCard({ trade, index, cumPnl }: { trade: ReplayTrade; index: number; cumPnl: number }) {
  const [open, setOpen] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const win = trade.netPnl > 0;
  const lose = trade.netPnl < 0;
  const tradeDate = trade.entryTime.slice(0, 10);

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${win ? "border-[var(--green)] border-opacity-40" : lose ? "border-[var(--red)] border-opacity-40" : "border-[var(--card-border)]"} bg-[var(--card)]`}>
      {/* Header row */}
      <button
        className="w-full text-left p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Trade number */}
        <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-white shrink-0">
          {index + 1}
        </div>

        {/* Symbol + side */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{trade.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trade.side === "LONG" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]"}`}>
              {trade.side}
            </span>
            {trade.setupType && (
              <span className="text-xs text-[var(--muted)] bg-white/5 px-2 py-0.5 rounded-full">{trade.setupType}</span>
            )}
            {trade.status === "OPEN" && (
              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">OPEN</span>
            )}
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-3 flex-wrap">
            <span>{format(parseISO(trade.entryTime), "HH:mm")}
              {trade.exitTime && <> → {format(parseISO(trade.exitTime), "HH:mm")}</>}
            </span>
            <span>{fmtDur(trade.holdDuration)}</span>
            <span>{trade.quantity}{trade.entryPrice != null ? ` @ ${trade.entryPrice.toFixed(2)}` : ""}</span>
            {trade.exitPrice && <span>→ {trade.exitPrice.toFixed(2)}</span>}
          </div>
        </div>

        {/* P&L + running total */}
        <div className="text-right shrink-0">
          <div className={`font-bold text-base ${win ? "text-[var(--green)]" : lose ? "text-[var(--red)]" : "text-[var(--muted)]"}`}>
            {fmt$(trade.netPnl)}
          </div>
          <div className="text-xs text-[var(--muted)]">
            cum: <span className={cumPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>{fmt$(cumPnl)}</span>
          </div>
        </div>

        {/* R-ratio */}
        {trade.rRatio !== null && (
          <div className="text-center shrink-0 w-12">
            <div className={`text-sm font-semibold ${trade.rRatio >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {trade.rRatio >= 0 ? "+" : ""}{trade.rRatio.toFixed(2)}R
            </div>
          </div>
        )}

        {open ? <ChevronUp size={16} className="text-[var(--muted)] shrink-0" /> : <ChevronDown size={16} className="text-[var(--muted)] shrink-0" />}
      </button>

      {/* Chart toggle button */}
      {open && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowChart((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showChart
                ? "bg-[var(--accent)]/20 border-[var(--accent)]/40 text-[var(--accent)]"
                : "border-[var(--card-border)] text-[var(--muted)] hover:text-white hover:border-white/20"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            {showChart ? "Hide Chart" : "View Chart"}
          </button>
        </div>
      )}

      {/* TradingView chart */}
      {open && showChart && (
        <div className="border-t border-[var(--card-border)] p-4">
          <TradeChart
            symbol={trade.symbol}
            date={tradeDate}
            entryTime={trade.entryTime}
            exitTime={trade.exitTime}
            entryPrice={trade.entryPrice}
            exitPrice={trade.exitPrice}
            side={trade.side}
            stopLoss={trade.stopLoss}
            takeProfit={trade.takeProfit}
          />
        </div>
      )}

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-[var(--card-border)] p-4 space-y-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><div className="text-[var(--muted)] text-xs">Gross P&L</div><div className="text-white">{fmt$(trade.grossPnl)}</div></div>
            <div><div className="text-[var(--muted)] text-xs">Commission</div><div className="text-white">-{Math.abs(trade.commission).toFixed(2)}</div></div>
            <div><div className="text-[var(--muted)] text-xs">Stop Loss</div><div className="text-white">{trade.stopLoss?.toFixed(2) ?? "—"}</div></div>
            <div><div className="text-[var(--muted)] text-xs">Take Profit</div><div className="text-white">{trade.takeProfit?.toFixed(2) ?? "—"}</div></div>
            {trade.maxAdverseExcursion !== null && (
              <div><div className="text-[var(--muted)] text-xs">MAE</div><div className="text-[var(--red)]">-{Math.abs(trade.maxAdverseExcursion).toFixed(2)}</div></div>
            )}
            {trade.maxFavorableExcursion !== null && (
              <div><div className="text-[var(--muted)] text-xs">MFE</div><div className="text-[var(--green)]">+{trade.maxFavorableExcursion.toFixed(2)}</div></div>
            )}
            <div><div className="text-[var(--muted)] text-xs">Emotion Before</div><div className="text-white">{emotionLabel(trade.emotionBefore)}</div></div>
            <div><div className="text-[var(--muted)] text-xs">Emotion After</div><div className="text-white">{emotionLabel(trade.emotionAfter)}</div></div>
            {trade.confidence !== null && (
              <div><div className="text-[var(--muted)] text-xs">Confidence</div><div className="text-white">{trade.confidence}/10</div></div>
            )}
            {trade.timeframe && (
              <div><div className="text-[var(--muted)] text-xs">Timeframe</div><div className="text-white">{trade.timeframe}</div></div>
            )}
            {trade.marketCondition && (
              <div><div className="text-[var(--muted)] text-xs">Market Condition</div><div className="text-white">{trade.marketCondition}</div></div>
            )}
          </div>

          {/* Tags */}
          {(trade.mistakeTags.length > 0 || trade.setupTags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {trade.setupTags.map((t) => (
                <span key={t} className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{t}</span>
              ))}
              {trade.mistakeTags.map((t) => (
                <span key={t} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} />{t}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {trade.notes && (
            <div>
              <div className="text-xs text-[var(--muted)] mb-1">Notes</div>
              <p className="text-sm text-white/80 bg-white/5 rounded-lg p-3 leading-relaxed">{trade.notes}</p>
            </div>
          )}
          {trade.lessonsLearned && (
            <div>
              <div className="text-xs text-[var(--muted)] mb-1">Lessons Learned</div>
              <p className="text-sm text-white/80 bg-white/5 rounded-lg p-3 leading-relaxed">{trade.lessonsLearned}</p>
            </div>
          )}

          {/* Executions */}
          {trade.executions.length > 0 && (
            <div>
              <div className="text-xs text-[var(--muted)] mb-2">Executions</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--muted)] border-b border-[var(--card-border)]">
                      <th className="text-left py-1 pr-4">Time</th>
                      <th className="text-left py-1 pr-4">Type</th>
                      <th className="text-left py-1 pr-4">Side</th>
                      <th className="text-right py-1 pr-4">Qty</th>
                      <th className="text-right py-1 pr-4">Price</th>
                      <th className="text-right py-1">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trade.executions.map((ex) => (
                      <tr key={ex.id} className="border-b border-[var(--card-border)] last:border-0">
                        <td className="py-1.5 pr-4 text-white">{format(parseISO(ex.timestamp), "HH:mm:ss")}</td>
                        <td className="py-1.5 pr-4 text-[var(--muted)]">{ex.type}</td>
                        <td className={`py-1.5 pr-4 ${ex.side === "LONG" ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{ex.side}</td>
                        <td className="py-1.5 pr-4 text-right text-white">{ex.quantity}</td>
                        <td className="py-1.5 pr-4 text-right text-white">{ex.price.toFixed(2)}</td>
                        <td className="py-1.5 text-right text-[var(--muted)]">{ex.commission.toFixed(2)}</td>
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

// ── Calendar ──────────────────────────────────────────────────────────────────
function CalendarPicker({
  selected,
  onSelect,
  activeDates,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  activeDates: Set<string>;
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const all = eachDayOfInterval({ start, end });
    const firstDow = (start.getDay() + 6) % 7; // Mon=0
    return { days: all, offset: firstDow };
  }, [viewMonth]);

  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 w-full">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewMonth((m) => subMonths(m, 1))} className="p-1 hover:bg-white/10 rounded">
          <ChevronLeft size={16} className="text-[var(--muted)]" />
        </button>
        <span className="text-sm font-medium text-white">{format(viewMonth, "MMMM yyyy")}</span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={isSameMonth(viewMonth, new Date())}
          className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} className="text-[var(--muted)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-xs text-[var(--muted)] py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: days.offset }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const hasData = activeDates.has(key);
          const isSelected = isSameDay(day, selected);
          const todayDay = isToday(day);
          const future = day > new Date();

          return (
            <button
              key={key}
              disabled={future}
              onClick={() => onSelect(day)}
              className={`
                relative aspect-square rounded-lg text-xs font-medium transition-all
                ${isSelected ? "bg-[var(--accent)] text-white" : ""}
                ${!isSelected && hasData ? "bg-white/10 text-white hover:bg-white/20" : ""}
                ${!isSelected && !hasData && !future ? "text-[var(--muted)] hover:bg-white/5" : ""}
                ${future ? "text-white/20 cursor-not-allowed" : "cursor-pointer"}
                ${todayDay && !isSelected ? "ring-1 ring-[var(--accent)]" : ""}
              `}
            >
              {day.getDate()}
              {hasData && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--green)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReplayPage() {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const qDate = searchParams.get("date");
    if (qDate) {
      const parsed = new Date(qDate + "T12:00:00");
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });

  // Sync if URL param changes after mount (e.g. email link)
  useEffect(() => {
    const qDate = searchParams.get("date");
    if (qDate) {
      const parsed = new Date(qDate + "T12:00:00");
      if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
    }
  }, [searchParams]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data, isLoading, isError } = useQuery<ReplayData>({
    queryKey: ["replay", dateStr],
    queryFn: () => fetch(`/api/replay/${dateStr}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Fetch calendar month of active dates (simple: fetch last 90 days trade dates)
  const { data: calData } = useQuery<{ dates: string[] }>({
    queryKey: ["replay-calendar"],
    queryFn: () => fetch("/api/replay/calendar").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });
  const activeDates = useMemo(() => new Set(calData?.dates ?? []), [calData]);

  const trades = data?.trades ?? [];
  const stats = data?.stats;
  const journal = data?.journal;
  const equityCurve = data?.equityCurve ?? [];

  // Running cumPnl per trade (for trade cards)
  const cumulativePnl = useMemo(() => {
    const acc: number[] = [];
    let sum = 0;
    for (const t of trades) { sum += t.netPnl; acc.push(sum); }
    return acc;
  }, [trades]);

  const pnlColor = stats && stats.totalPnl >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Session Replay</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Review any trading session in detail</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel: calendar + journal */}
        <div className="lg:w-72 space-y-4 shrink-0">
          <CalendarPicker
            selected={selectedDate}
            onSelect={setSelectedDate}
            activeDates={activeDates}
          />

          {/* Date label */}
          <div className="text-center text-sm font-medium text-white">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </div>

          {/* Journal snippets */}
          {journal && (
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Journal</h3>
              {journal.grade && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Grade</span>
                  <span className="text-sm font-bold text-[var(--accent)]">{journal.grade}</span>
                </div>
              )}
              {journal.mood !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Mood</span>
                  <span className="text-sm text-white">{journal.mood}/10</span>
                </div>
              )}
              {journal.focus !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Focus</span>
                  <span className="text-sm text-white">{journal.focus}/10</span>
                </div>
              )}
              {journal.marketBias && (
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Market Bias</div>
                  <div className="text-xs text-white/80 bg-white/5 rounded p-2 leading-relaxed">{journal.marketBias}</div>
                </div>
              )}
              {journal.rulesFollowed.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Rules Followed</div>
                  <div className="flex flex-wrap gap-1">
                    {journal.rulesFollowed.map((r) => (
                      <span key={r} className="text-xs bg-[var(--green-dim)] text-[var(--green)] px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {journal.rulesBroken.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Rules Broken</div>
                  <div className="flex flex-wrap gap-1">
                    {journal.rulesBroken.map((r) => (
                      <span key={r} className="text-xs bg-[var(--red-dim)] text-[var(--red)] px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {journal.maxLossLimit !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">Max Loss Limit</span>
                  <span className="text-[var(--red)]">${journal.maxLossLimit.toFixed(0)}</span>
                </div>
              )}
              {journal.targetProfit !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">Target Profit</span>
                  <span className="text-[var(--green)]">${journal.targetProfit.toFixed(0)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 space-y-5">
          {isLoading && (
            <div className="text-center py-20 text-[var(--muted)]">Loading session…</div>
          )}

          {isError && (
            <div className="text-center py-20 text-[var(--red)]">Failed to load session data.</div>
          )}

          {!isLoading && !isError && trades.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4">
                <Clock size={28} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-white font-semibold mb-1">No trades on this day</h3>
              <p className="text-[var(--muted)] text-sm">Select a date with a green dot to replay a session.</p>
            </div>
          )}

          {!isLoading && !isError && trades.length > 0 && stats && (
            <>
              {/* Session stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Net P&L"
                  value={fmt$(stats.totalPnl)}
                  sub={`${stats.closedTrades} closed trades`}
                  positive={stats.totalPnl > 0 ? true : stats.totalPnl < 0 ? false : undefined}
                />
                <StatCard
                  label="Win Rate"
                  value={`${(stats.winRate ?? 0).toFixed(1)}%`}
                  sub={`${stats.winners}W / ${stats.losers}L`}
                  positive={stats.winRate >= 50}
                />
                <StatCard
                  label="Avg R"
                  value={stats.avgR != null && stats.avgR !== 0 ? `${stats.avgR >= 0 ? "+" : ""}${stats.avgR.toFixed(2)}R` : "—"}
                  positive={stats.avgR > 0 ? true : stats.avgR < 0 ? false : undefined}
                />
                <StatCard
                  label="Max Drawdown"
                  value={stats.maxIntradayDrawdown > 0 ? `-${fmt$(stats.maxIntradayDrawdown).replace("+", "")}` : "$0.00"}
                  positive={stats.maxIntradayDrawdown === 0}
                />
                <StatCard label="Best Trade" value={fmt$(stats.bestTrade)} positive={stats.bestTrade > 0} />
                <StatCard label="Worst Trade" value={fmt$(stats.worstTrade)} positive={stats.worstTrade >= 0} />
                <StatCard label="Avg Win" value={stats.avgWin !== 0 ? fmt$(stats.avgWin) : "—"} positive={stats.avgWin > 0} />
                <StatCard label="Commissions" value={`-$${(stats.totalCommissions ?? 0).toFixed(2)}`} />
              </div>

              {/* Intraday equity curve */}
              {equityCurve.length > 1 && (
                <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Intraday P&L Curve</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={pnlColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={pnlColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: unknown) => `$${(v as number).toFixed(0)}`} width={55} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8 }}
                        labelStyle={{ color: "var(--muted)", fontSize: 11 }}
                        formatter={(v: unknown, _n: unknown, props: { payload?: EquityPoint }) => [
                          `$${(v as number).toFixed(2)}`,
                          props.payload?.symbol ?? "Cum P&L",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumPnl"
                        stroke={pnlColor}
                        strokeWidth={2}
                        fill="url(#replayGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Trade cards */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock size={15} className="text-[var(--muted)]" />
                  Trade Timeline
                  <span className="text-[var(--muted)] text-xs font-normal">({trades.length} trades)</span>
                </h3>
                <div className="space-y-2">
                  {trades.map((trade, i) => (
                    <TradeCard
                      key={trade.id}
                      trade={trade}
                      index={i}
                      cumPnl={cumulativePnl[i]}
                    />
                  ))}
                </div>
              </div>

              {/* Post-review */}
              {journal?.postReview && (
                <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Target size={15} className="text-[var(--accent)]" /> Post-Session Review
                  </h3>
                  <p className="text-sm text-white/80 leading-relaxed">{journal.postReview}</p>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {journal.whatWentWell && (
                      <div>
                        <div className="flex items-center gap-1 text-xs text-[var(--green)] mb-1">
                          <TrendingUp size={11} /> What Went Well
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">{journal.whatWentWell}</p>
                      </div>
                    )}
                    {journal.whatWentWrong && (
                      <div>
                        <div className="flex items-center gap-1 text-xs text-[var(--red)] mb-1">
                          <TrendingDown size={11} /> What Went Wrong
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">{journal.whatWentWrong}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
