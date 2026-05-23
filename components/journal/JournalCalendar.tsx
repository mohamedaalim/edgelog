"use client";

import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayData {
  date: string;
  pnl: number;
  count: number;
}

interface JournalDay {
  date: string;
  dailyPnl: number;
}

interface Props {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  tradeDays: DayData[];
  journalDays: JournalDay[];
  streak: number;
  month: Date;
  onMonthChange: (d: Date) => void;
}

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function JournalCalendar({
  selectedDate, onSelectDate, tradeDays, journalDays, streak, month, onMonthChange,
}: Props) {
  const tradeMap = new Map(tradeDays.map((d) => [d.date, d]));
  const journalMap = new Map(journalDays.map((d) => [d.date, d]));

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let cur = calStart;
  while (cur <= calEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  function getDayStyle(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    const trade = tradeMap.get(key);
    const journal = journalMap.get(key);
    const isSelected = isSameDay(day, selectedDate);
    const inMonth = isSameMonth(day, month);

    if (!inMonth) return { bg: "transparent", text: "text-[var(--muted)]/30", dot: null };

    if (trade) {
      return {
        bg: isSelected
          ? "bg-[var(--accent)]"
          : trade.pnl > 0
          ? "bg-[var(--green)]/20 hover:bg-[var(--green)]/30 border border-green-800/40"
          : "bg-[var(--red)]/20 hover:bg-[var(--red)]/30 border border-red-800/40",
        text: isSelected
          ? "text-white"
          : trade.pnl > 0
          ? "text-[var(--green)]"
          : "text-[var(--red)]",
        pnl: trade.pnl,
        count: trade.count,
        hasJournal: !!journal,
      };
    }

    if (journal) {
      return {
        bg: isSelected ? "bg-[var(--accent)]" : "bg-blue-900/30 hover:bg-blue-900/40 border border-blue-800/40",
        text: isSelected ? "text-white" : "text-blue-400",
        hasJournal: true,
      };
    }

    return {
      bg: isSelected ? "bg-[var(--accent)]" : "hover:bg-[var(--card-border)]",
      text: isSelected ? "text-white" : "text-[var(--muted)]",
    };
  }

  return (
    <div className="w-64 shrink-0 bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden flex flex-col">
      {/* Streak banner */}
      {streak > 0 && (
        <div className="flex items-center justify-center gap-2 py-2.5 bg-orange-900/30 border-b border-orange-800/30">
          <Flame size={14} className="text-orange-400" />
          <span className="text-xs font-semibold text-orange-400">{streak} day streak</span>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--card-border)]">
        <button onClick={() => onMonthChange(subMonths(month, 1))}
          className="p-1 rounded hover:bg-[var(--card-border)] text-[var(--muted)] hover:text-white transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-white">{format(month, "MMMM yyyy")}</span>
        <button onClick={() => onMonthChange(addMonths(month, 1))}
          className="p-1 rounded hover:bg-[var(--card-border)] text-[var(--muted)] hover:text-white transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {DOW.map((d) => (
          <div key={d} className="text-center text-xs text-[var(--muted)] py-1 font-medium">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
        {days.map((day) => {
          const style = getDayStyle(day);
          const key = format(day, "yyyy-MM-dd");
          const trade = tradeMap.get(key);
          const inMonth = isSameMonth(day, month);

          return (
            <button
              key={key}
              onClick={() => inMonth && onSelectDate(day)}
              disabled={!inMonth}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg p-0.5 transition-colors",
                "h-9 text-xs font-medium",
                style.bg,
                style.text,
                !inMonth && "cursor-default"
              )}
            >
              <span className={cn(isToday(day) && "underline decoration-dotted")}>{format(day, "d")}</span>
              {trade && inMonth && (
                <span className="text-[9px] leading-none opacity-80">
                  {trade.pnl >= 0 ? "+" : ""}{Math.abs(trade.pnl) >= 1000 ? `${(trade.pnl / 1000).toFixed(1)}k` : trade.pnl.toFixed(0)}
                </span>
              )}
              {/* Journal dot */}
              {(style as { hasJournal?: boolean }).hasJournal && (
                <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-3 pb-3 pt-1 space-y-1 border-t border-[var(--card-border)]">
        <p className="text-xs text-[var(--muted)] font-medium mb-2">Legend</p>
        {[
          { color: "bg-[var(--green)]/20 border border-green-800/40", label: "Profitable day" },
          { color: "bg-[var(--red)]/20 border border-red-800/40", label: "Loss day" },
          { color: "bg-blue-900/30 border border-blue-800/40", label: "Journal only" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="text-xs text-[var(--muted)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
