"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isToday } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { JournalCalendar } from "@/components/journal/JournalCalendar";
import { DayStats } from "@/components/journal/DayStats";
import { AICoachCard } from "@/components/journal/AICoachCard";
import { Textarea } from "@/components/shared/Input";
import {
  Save, CheckCircle, Circle, ChevronDown, ChevronUp,
  BookOpen, ListChecks, BarChart3, TrendingUp, TrendingDown,
} from "lucide-react";

const BIASES = ["Bullish", "Bearish", "Neutral", "Wait"];
const GRADES = ["A", "B", "C", "D", "F"];
const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-600 text-white", B: "bg-emerald-700 text-white",
  C: "bg-yellow-600 text-white", D: "bg-orange-600 text-white",
  F: "bg-red-700 text-white",
};
const TAGS = ["FOMC", "Earnings", "Expiry", "Choppy", "Trending", "Gap Day", "News Event", "High Volatility"];

type Section = "pre" | "trades" | "post" | "stats";

interface TradeRow {
  id: string;
  symbol: string;
  side: string;
  setupType?: string;
  entryTime: string;
  netPnl: number;
  rRatio?: number;
}

interface DayStatsData {
  dailyPnl: number;
  dailyWins: number;
  dailyLosses: number;
  totalTrades: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  totalR: number;
  grossPnl: number;
  commissions: number;
}

function SectionHeader({
  icon, title, open, onToggle, badge,
}: {
  icon: React.ReactNode; title: string; open: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-3 text-left group"
    >
      <span className="text-[var(--accent)]">{icon}</span>
      <span className="font-semibold text-white flex-1">{title}</span>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-border)] text-[var(--muted)]">{badge}</span>
      )}
      {open ? <ChevronUp size={14} className="text-[var(--muted)]" /> : <ChevronDown size={14} className="text-[var(--muted)]" />}
    </button>
  );
}

function MoodSlider({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[var(--muted)]">{label}</label>
        <span className="text-xs font-medium text-white">{value ?? "—"}/10</span>
      </div>
      <input
        type="range" min={1} max={10}
        value={value ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

export default function DailyJournalPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date());
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(["pre", "trades", "post", "stats"]));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [marketBias, setMarketBias] = useState("");
  const [prePlanning, setPrePlanning] = useState("");
  const [postReview, setPostReview] = useState("");
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [grade, setGrade] = useState("");
  const [mood, setMood] = useState<number | undefined>();
  const [energyLevel, setEnergyLevel] = useState<number | undefined>();
  const [focus, setFocus] = useState<number | undefined>();
  const [sleepQuality, setSleepQuality] = useState<number | undefined>();
  const [maxLossLimit, setMaxLossLimit] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const dateKey = format(selectedDate, "yyyy-MM-dd");

  // Fetch journal + trades for selected day
  const { data: dayData, isLoading } = useQuery({
    queryKey: ["journal-day", dateKey],
    queryFn: () => fetch(`/api/journal/${dateKey}`).then((r) => r.json()),
  });

  // Fetch calendar data
  const { data: calendarData = [] } = useQuery({
    queryKey: ["calendar"],
    queryFn: () => fetch("/api/stats/calendar?months=6").then((r) => r.json()),
  });

  // Fetch streak + journal calendar dots
  const { data: streakData } = useQuery({
    queryKey: ["journal-streak"],
    queryFn: () => fetch("/api/journal/streak").then((r) => r.json()),
  });

  // Load entry into form when day changes
  useEffect(() => {
    const entry = dayData?.entry;
    setMarketBias(entry?.marketBias ?? "");
    setPrePlanning(entry?.prePlanning ?? "");
    setPostReview(entry?.postReview ?? "");
    setWhatWentWell(entry?.whatWentWell ?? "");
    setWhatWentWrong(entry?.whatWentWrong ?? "");
    setTomorrowPlan(entry?.tomorrowPlan ?? "");
    setGrade(entry?.grade ?? "");
    setMood(entry?.mood ?? undefined);
    setEnergyLevel(entry?.energyLevel ?? undefined);
    setFocus(entry?.focus ?? undefined);
    setSleepQuality(entry?.sleepQuality ?? undefined);
    setMaxLossLimit(entry?.maxLossLimit ? String(entry.maxLossLimit) : "");
    setTargetProfit(entry?.targetProfit ? String(entry.targetProfit) : "");
    setSelectedTags(entry?.tags ?? []);
    setSaved(false);
  }, [dayData?.entry, dateKey]);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/journal/${dateKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketBias: marketBias || null,
        prePlanning: prePlanning || null,
        postReview: postReview || null,
        whatWentWell: whatWentWell || null,
        whatWentWrong: whatWentWrong || null,
        tomorrowPlan: tomorrowPlan || null,
        grade: grade || null,
        mood, energyLevel, focus, sleepQuality,
        maxLossLimit: maxLossLimit ? Number(maxLossLimit) : null,
        targetProfit: targetProfit ? Number(targetProfit) : null,
        tags: selectedTags,
      }),
    });
    await qc.invalidateQueries({ queryKey: ["journal-day", dateKey] });
    await qc.invalidateQueries({ queryKey: ["journal-streak"] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [dateKey, marketBias, prePlanning, postReview, whatWentWell, whatWentWrong, tomorrowPlan, grade, mood, energyLevel, focus, sleepQuality, maxLossLimit, targetProfit, selectedTags, qc]);

  // Auto-save with debounce
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (prePlanning || postReview || marketBias || grade) save();
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [prePlanning, postReview, marketBias, grade, save]);

  function toggleSection(s: Section) {
    const n = new Set(openSections);
    n.has(s) ? n.delete(s) : n.add(s);
    setOpenSections(n);
  }

  const trades: TradeRow[] = dayData?.trades ?? [];
  const dayStats: DayStatsData | null = dayData?.dayStats ?? null;

  return (
    <div className="flex gap-4 max-w-[1400px] mx-auto" style={{ height: "calc(100vh - 100px)" }}>
      {/* Left — Calendar */}
      <div className="flex flex-col gap-3 shrink-0">
        <JournalCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          tradeDays={calendarData}
          journalDays={streakData?.calendarData ?? []}
          streak={streakData?.streak ?? 0}
          month={calMonth}
          onMonthChange={setCalMonth}
        />

        {/* Today button */}
        {!isToday(selectedDate) && (
          <button onClick={() => { setSelectedDate(new Date()); setCalMonth(new Date()); }}
            className="text-xs text-center text-[var(--accent)] hover:underline">
            ← Go to today
          </button>
        )}
      </div>

      {/* Right — Journal content */}
      <div className="flex-1 overflow-y-auto space-y-0 min-w-0">
        {/* Date header */}
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-[var(--background)] z-10 pb-3 border-b border-[var(--card-border)]">
          <div>
            <h1 className="text-lg font-bold text-white">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h1>
            {isToday(selectedDate) && <span className="text-xs text-[var(--accent)]">Today</span>}
          </div>
          <div className="flex items-center gap-2">
            {grade && (
              <span className={cn("text-sm font-bold px-2.5 py-1 rounded-lg", GRADE_COLORS[grade] ?? "bg-[var(--card-border)] text-white")}>
                Grade: {grade}
              </span>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saved ? <><CheckCircle size={13} /> Saved</> : <><Save size={13} /> {saving ? "Saving…" : "Save"}</>}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-[var(--card)] border border-[var(--card-border)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* ── SECTION 1: Pre-Market Plan ── */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-5 overflow-hidden">
              <SectionHeader
                icon={<BookOpen size={15} />}
                title="Pre-Market Plan"
                open={openSections.has("pre")}
                onToggle={() => toggleSection("pre")}
                badge={marketBias || undefined}
              />
              {openSections.has("pre") && (
                <div className="pb-5 space-y-4 border-t border-[var(--card-border)] pt-4">
                  {/* Market bias */}
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-2">Market Bias</p>
                    <div className="flex gap-2">
                      {BIASES.map((b) => (
                        <button key={b} onClick={() => setMarketBias(marketBias === b ? "" : b)}
                          className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                            marketBias === b
                              ? b === "Bullish" ? "bg-[var(--green)]/20 border-green-700 text-[var(--green)]"
                                : b === "Bearish" ? "bg-[var(--red)]/20 border-red-700 text-[var(--red)]"
                                  : "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
                              : "border-[var(--card-border)] text-[var(--muted)] hover:text-white")}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mental check */}
                  <div className="grid grid-cols-2 gap-4">
                    <MoodSlider label="Sleep Quality" value={sleepQuality} onChange={setSleepQuality} />
                    <MoodSlider label="Energy Level" value={energyLevel} onChange={setEnergyLevel} />
                    <MoodSlider label="Mood" value={mood} onChange={setMood} />
                    <MoodSlider label="Focus" value={focus} onChange={setFocus} />
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--muted)] block mb-1">Max Daily Loss ($)</label>
                      <input type="number" value={maxLossLimit} onChange={(e) => setMaxLossLimit(e.target.value)}
                        placeholder="e.g. 300"
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted)] block mb-1">Target Profit ($)</label>
                      <input type="number" value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                    </div>
                  </div>

                  <Textarea label="Pre-market plan & key levels" value={prePlanning}
                    onChange={(e) => setPrePlanning(e.target.value)}
                    placeholder="What are you watching today? Key levels, catalysts, setups you're looking for…" rows={4} />

                  {/* Day tags */}
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-2">Day Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TAGS.map((tag) => (
                        <button key={tag} onClick={() => setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag])}
                          className={cn("px-2.5 py-1 text-xs rounded-full border transition-colors",
                            selectedTags.includes(tag)
                              ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
                              : "border-[var(--card-border)] text-[var(--muted)] hover:text-white")}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── SECTION 2: Today's Trades ── */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-5 overflow-hidden">
              <SectionHeader
                icon={<ListChecks size={15} />}
                title="Trade Log"
                open={openSections.has("trades")}
                onToggle={() => toggleSection("trades")}
                badge={trades.length ? `${trades.length} trades` : "No trades"}
              />
              {openSections.has("trades") && (
                <div className="pb-4 border-t border-[var(--card-border)] pt-4">
                  {trades.length === 0 ? (
                    <p className="text-sm text-[var(--muted)] py-4 text-center">No closed trades on this day</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--card-border)]">
                          {["Time", "Symbol", "Side", "Setup", "P&L", "R"].map((h) => (
                            <th key={h} className="text-left text-xs text-[var(--muted)] pb-2 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t) => (
                          <tr key={t.id} className="border-b border-[var(--card-border)] last:border-0">
                            <td className="py-2 pr-4 text-xs text-[var(--muted)]">{format(new Date(t.entryTime), "HH:mm")}</td>
                            <td className="py-2 pr-4 font-medium text-white">{t.symbol}</td>
                            <td className="py-2 pr-4">
                              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                                t.side === "LONG" ? "bg-[var(--green-dim)] text-[var(--green)]" : "bg-[var(--red-dim)] text-[var(--red)]")}>
                                {t.side}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-xs text-[var(--muted)]">{t.setupType ?? "—"}</td>
                            <td className={cn("py-2 pr-4 font-semibold", t.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                              {formatCurrency(t.netPnl)}
                            </td>
                            <td className={cn("py-2 text-xs", t.rRatio == null ? "text-[var(--muted)]" : t.rRatio >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                              {t.rRatio != null ? `${t.rRatio >= 0 ? "+" : ""}${t.rRatio.toFixed(2)}R` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* ── SECTION 3: Post-Market Review ── */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-5 overflow-hidden">
              <SectionHeader
                icon={grade ? (dayStats && dayStats.dailyPnl >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />) : <BookOpen size={15} />}
                title="Post-Market Review"
                open={openSections.has("post")}
                onToggle={() => toggleSection("post")}
                badge={grade ? `Grade: ${grade}` : undefined}
              />
              {openSections.has("post") && (
                <div className="pb-5 space-y-4 border-t border-[var(--card-border)] pt-4">
                  <Textarea label="Overall review" value={postReview}
                    onChange={(e) => setPostReview(e.target.value)}
                    placeholder="How did the session go? What happened in the market? How did you execute?" rows={4} />

                  <div className="grid grid-cols-2 gap-3">
                    <Textarea label="✅ What went well" value={whatWentWell}
                      onChange={(e) => setWhatWentWell(e.target.value)} rows={3}
                      placeholder="• Patient entry on NVDA&#10;• Took profits at target" />
                    <Textarea label="❌ What went wrong" value={whatWentWrong}
                      onChange={(e) => setWhatWentWrong(e.target.value)} rows={3}
                      placeholder="• Chased TSLA after the move&#10;• Moved stop loss" />
                  </div>

                  <Textarea label="Tomorrow's plan" value={tomorrowPlan}
                    onChange={(e) => setTomorrowPlan(e.target.value)}
                    placeholder="What will you focus on tomorrow? Any setups to watch?" rows={2} />

                  {/* Grade */}
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-2">Session Grade</p>
                    <div className="flex gap-2">
                      {GRADES.map((g) => (
                        <button key={g} onClick={() => setGrade(grade === g ? "" : g)}
                          className={cn("w-10 h-10 rounded-lg text-sm font-bold border-2 transition-colors",
                            grade === g
                              ? GRADE_COLORS[g] + " border-transparent"
                              : "border-[var(--card-border)] text-[var(--muted)] hover:text-white hover:border-[var(--muted)]")}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── SECTION 4: Day Stats ── */}
            {dayStats && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-5 overflow-hidden">
                <SectionHeader
                  icon={<BarChart3 size={15} />}
                  title="Day Statistics"
                  open={openSections.has("stats")}
                  onToggle={() => toggleSection("stats")}
                  badge={dayStats.totalTrades > 0 ? formatCurrency(dayStats.dailyPnl) : "No trades"}
                />
                {openSections.has("stats") && (
                  <div className="pb-5 border-t border-[var(--card-border)] pt-4">
                    {dayStats.totalTrades > 0 ? (
                      <DayStats stats={dayStats} />
                    ) : (
                      <p className="text-sm text-[var(--muted)] text-center py-4">No trades on this day</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── AI Coach Feedback ── */}
            <AICoachCard
              date={dateKey}
              journal={{ prePlanning, postReview, mood, focus }}
              existingFeedback={dayData?.entry?.aiCoachFeedback}
            />
          </div>
        )}
      </div>
    </div>
  );
}
