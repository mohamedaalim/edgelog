"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: { time: string; pnl: number; count: number; winRate: number }[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { count: number; winRate: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-medium mb-1">{label}</p>
      <p className={item?.value && item.value >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
        P&L: {formatCurrency(item?.value ?? 0)}
      </p>
      <p className="text-[var(--muted)]">Trades: {item?.payload?.count}</p>
      <p className="text-[var(--muted)]">Win Rate: {item?.payload?.winRate?.toFixed(0)}%</p>
    </div>
  );
}

export function ByHour({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: "#6b7280", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          tick={{ fill: "#6b7280", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
