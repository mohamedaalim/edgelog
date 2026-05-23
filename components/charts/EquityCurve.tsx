"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface Point {
  date: string;
  dailyPnl: number;
  cumulative: number;
}

interface Props {
  data: Point[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const cum = payload[0]?.value ?? 0;
  const daily = payload[1]?.value ?? 0;
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--muted)] mb-1">{label}</p>
      <p className="text-white font-medium">Equity: {formatCurrency(cum)}</p>
      <p className={daily >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
        Day: {formatCurrency(daily)}
      </p>
    </div>
  );
}

export function EquityCurve({ data }: Props) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">No data for this period</div>;
  }

  const isPositive = (data[data.length - 1]?.cumulative ?? 0) >= 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.2} />
            <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(new Date(v), "MMM d")}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#2a2a32" />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={isPositive ? "#22c55e" : "#ef4444"}
          strokeWidth={2}
          fill="url(#equityGrad)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="dailyPnl"
          stroke="transparent"
          fill="transparent"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
