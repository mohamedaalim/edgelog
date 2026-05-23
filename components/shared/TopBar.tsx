"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Bell, ChevronDown, LogOut, User, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Quarter", value: "quarter" },
  { label: "YTD", value: "ytd" },
  { label: "All Time", value: "all" },
];

interface TopBarProps {
  dateRange: string;
  onDateRangeChange: (v: string) => void;
  onLogTrade: () => void;
}

export function TopBar({ dateRange, onDateRangeChange, onLogTrade }: TopBarProps) {
  const { data: session } = useSession();
  const [showRange, setShowRange] = useState(false);
  const [showUser, setShowUser] = useState(false);

  const currentRange = DATE_RANGES.find((r) => r.value === dateRange) ?? DATE_RANGES[2];
  const initials = session?.user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-5 border-b border-[var(--card-border)] bg-[var(--card)] shrink-0">

      {/* Mobile left: logo */}
      <div className="flex md:hidden items-center gap-2">
        <TrendingUp size={17} className="text-[var(--accent)]" />
        <span className="font-bold text-white text-sm tracking-wide">EdgeLog</span>
      </div>

      {/* Desktop left: date range picker */}
      <div className="hidden md:flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowRange(!showRange)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm text-white hover:border-[var(--accent)] transition-colors"
          >
            {currentRange.label}
            <ChevronDown size={13} className="text-[var(--muted)]" />
          </button>
          {showRange && (
            <div className="absolute left-0 top-9 z-50 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-xl py-1 min-w-[130px]">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { onDateRangeChange(r.value); setShowRange(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm transition-colors",
                    r.value === dateRange ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)]"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Log Trade — desktop only; mobile uses FAB in BottomNav */}
        <button
          onClick={onLogTrade}
          className="hidden md:flex px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Log Trade
        </button>

        <button className="p-1.5 text-[var(--muted)] hover:text-white rounded-lg hover:bg-[var(--card-border)] transition-colors">
          <Bell size={16} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUser(!showUser)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--card-border)] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          </button>
          {showUser && (
            <div className="absolute right-0 top-10 z-50 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-xl py-1 min-w-[160px]">
              <div className="px-3 py-2 border-b border-[var(--card-border)]">
                <p className="text-xs font-medium text-white truncate">{session?.user?.name}</p>
                <p className="text-xs text-[var(--muted)] truncate">{session?.user?.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)] transition-colors">
                <User size={13} /> Profile
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--red)] hover:bg-[var(--card-border)] transition-colors"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
