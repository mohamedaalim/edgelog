import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  positive?: boolean;
  loading?: boolean;
}

export function MetricCard({ label, value, sub, trend, positive, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 min-w-[150px] animate-pulse">
        <div className="h-3 w-16 bg-[var(--card-border)] rounded mb-3" />
        <div className="h-6 w-24 bg-[var(--card-border)] rounded mb-2" />
        <div className="h-3 w-20 bg-[var(--card-border)] rounded" />
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 min-w-[150px] flex flex-col gap-1 hover:border-[var(--accent)] transition-colors">
      <p className="text-xs text-[var(--muted)] font-medium">{label}</p>
      <p
        className={cn(
          "text-xl font-bold",
          positive === true ? "text-[var(--green)]" : positive === false ? "text-[var(--red)]" : "text-white"
        )}
      >
        {value}
      </p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-1.5">
          {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
          {trend !== undefined && (
            <span className={cn("flex items-center gap-0.5 text-xs", trend >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
              {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
