"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert, TrendingUp, TrendingDown, X, Settings2, ChevronUp,
  ChevronDown, CircleDot, CheckCircle2, AlertTriangle, Ban
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

interface SessionData {
  accountName: string;
  netPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  openPositions: number;
  dailyLossLimit: number | null;
  maxDailyTrades: number | null;
  status: "safe" | "warning" | "halt";
}

function ProgressBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color =
    pct >= 100 ? "bg-[var(--red)]" :
    pct >= 75  ? "bg-yellow-500" :
                 danger ? "bg-[var(--red)]" : "bg-[var(--green)]";
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SessionWidget() {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lossInput, setLossInput] = useState("");
  const [tradesInput, setTradesInput] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery<SessionData>({
    queryKey: ["session-status"],
    queryFn: () => fetch("/api/session").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // Pre-fill settings inputs when data loads
  useEffect(() => {
    if (session) {
      setLossInput(session.dailyLossLimit?.toString() ?? "");
      setTradesInput(session.maxDailyTrades?.toString() ?? "");
    }
  }, [session?.dailyLossLimit, session?.maxDailyTrades]);

  const { mutate: saveLimits, isPending: saving } = useMutation({
    mutationFn: (payload: { dailyLossLimit: number | null; maxDailyTrades: number | null }) =>
      fetch("/api/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-status"] });
      setShowSettings(false);
    },
  });

  const handleSave = useCallback(() => {
    saveLimits({
      dailyLossLimit: lossInput ? parseFloat(lossInput) : null,
      maxDailyTrades: tradesInput ? parseInt(tradesInput) : null,
    });
  }, [lossInput, tradesInput, saveLimits]);

  if (isLoading || !session) return null;
  if (dismissed) return null;

  // If no limits set and status is safe and not expanded, show minimal chip
  const hasLimits = session.dailyLossLimit !== null || session.maxDailyTrades !== null;
  const showHaltBanner = session.status === "halt";

  const statusIcon =
    session.status === "halt"    ? <Ban className="w-3.5 h-3.5 text-[var(--red)]" /> :
    session.status === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> :
                                   <CheckCircle2 className="w-3.5 h-3.5 text-[var(--green)]" />;

  const lossUsed = session.dailyLossLimit !== null ? Math.max(0, -session.netPnl) : 0;
  const lossLimitPct = session.dailyLossLimit ? Math.min(100, (lossUsed / session.dailyLossLimit) * 100) : 0;
  const tradeLimitPct = session.maxDailyTrades ? Math.min(100, (session.totalTrades / session.maxDailyTrades) * 100) : 0;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Halt banner */}
      {showHaltBanner && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--red)]/20 border border-[var(--red)]/40 text-[var(--red)] text-xs font-semibold animate-pulse">
          <Ban className="w-4 h-4" />
          Daily limit reached — stop trading
        </div>
      )}

      {/* Main widget */}
      <div
        className={cn(
          "rounded-xl border shadow-2xl overflow-hidden transition-all duration-200",
          "bg-[var(--card)] border-[var(--card-border)]",
          session.status === "halt"    && "border-[var(--red)]/60",
          session.status === "warning" && "border-yellow-500/40",
          expanded ? "w-64" : "w-auto"
        )}
      >
        {/* Header / chip */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
        >
          {statusIcon}
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            session.netPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
          )}>
            {formatCurrency(session.netPnl)}
          </span>
          <span className="text-[var(--muted)] text-xs">{session.totalTrades}T</span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] ml-auto" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--muted)] ml-auto" />
          )}
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="border-t border-[var(--card-border)] px-3 pb-3 pt-2 space-y-3">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-[var(--muted)]">Trades</div>
                <div className="text-sm font-semibold">{session.totalTrades}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)]">W/L</div>
                <div className="text-sm font-semibold">
                  <span className="text-[var(--green)]">{session.wins}</span>
                  <span className="text-[var(--muted)]">/</span>
                  <span className="text-[var(--red)]">{session.losses}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)]">Win%</div>
                <div className="text-sm font-semibold">
                  {session.winRate !== null ? `${Math.round(session.winRate * 100)}%` : "—"}
                </div>
              </div>
            </div>

            {session.openPositions > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <CircleDot className="w-3 h-3 animate-pulse" />
                {session.openPositions} open position{session.openPositions > 1 ? "s" : ""}
              </div>
            )}

            {/* Daily loss limit bar */}
            {session.dailyLossLimit !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--muted)]">Loss limit</span>
                  <span className={cn(lossLimitPct >= 75 ? "text-[var(--red)]" : "text-[var(--muted)]")}>
                    {formatCurrency(lossUsed)} / {formatCurrency(session.dailyLossLimit)}
                  </span>
                </div>
                <ProgressBar value={lossUsed} max={session.dailyLossLimit} danger />
              </div>
            )}

            {/* Max trades bar */}
            {session.maxDailyTrades !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--muted)]">Trade limit</span>
                  <span className={cn(tradeLimitPct >= 80 ? "text-yellow-400" : "text-[var(--muted)]")}>
                    {session.totalTrades} / {session.maxDailyTrades}
                  </span>
                </div>
                <ProgressBar value={session.totalTrades} max={session.maxDailyTrades} />
              </div>
            )}

            {/* No limits configured nudge */}
            {!hasLimits && (
              <p className="text-xs text-[var(--muted)] text-center">
                Set daily limits to protect your account
              </p>
            )}

            {/* Settings toggle */}
            {showSettings ? (
              <div className="space-y-2 pt-1 border-t border-[var(--card-border)]">
                <p className="text-xs font-medium text-[var(--muted)]">Daily limits</p>
                <label className="block text-xs text-[var(--muted)]">Max loss ($)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  value={lossInput}
                  onChange={(e) => setLossInput(e.target.value)}
                  className="w-full text-xs rounded-md border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
                <label className="block text-xs text-[var(--muted)]">Max trades</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  value={tradesInput}
                  onChange={(e) => setTradesInput(e.target.value)}
                  className="w-full text-xs rounded-md border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md py-1.5 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 text-xs border border-[var(--card-border)] text-[var(--muted)] rounded-md py-1.5 hover:text-[var(--foreground)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-1 border-t border-[var(--card-border)]">
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] py-1 transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  Limits
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] py-1 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Hide
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
