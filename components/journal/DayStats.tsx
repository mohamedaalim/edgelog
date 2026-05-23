import { cn, formatCurrency, formatR } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

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

interface Props {
  stats: DayStatsData;
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-[var(--muted)] mb-0.5">{label}</p>
      <p className={cn("text-sm font-bold", positive === true ? "text-[var(--green)]" : positive === false ? "text-[var(--red)]" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

export function DayStats({ stats }: Props) {
  const isPositive = stats.dailyPnl >= 0;
  return (
    <div className={cn("rounded-xl border p-4", isPositive ? "bg-[var(--green)]/5 border-green-800/30" : "bg-[var(--red)]/5 border-red-800/30")}>
      <div className="flex items-center gap-2 mb-4">
        {isPositive ? <TrendingUp size={16} className="text-[var(--green)]" /> : <TrendingDown size={16} className="text-[var(--red)]" />}
        <span className={cn("text-lg font-bold", isPositive ? "text-[var(--green)]" : "text-[var(--red)]")}>
          {formatCurrency(stats.dailyPnl)}
        </span>
        <span className="text-xs text-[var(--muted)] ml-auto">{stats.totalTrades} trades</span>
      </div>
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-7">
        <Stat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} positive={stats.winRate >= 50} />
        <Stat label="W / L" value={`${stats.dailyWins} / ${stats.dailyLosses}`} />
        <Stat label="Best" value={formatCurrency(stats.bestTrade)} positive={stats.bestTrade >= 0} />
        <Stat label="Worst" value={formatCurrency(stats.worstTrade)} positive={stats.worstTrade >= 0} />
        <Stat label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} positive={stats.profitFactor >= 1} />
        <Stat label="Total R" value={formatR(stats.totalR)} positive={stats.totalR >= 0} />
        <Stat label="Commissions" value={formatCurrency(stats.commissions)} positive={false} />
      </div>
    </div>
  );
}
