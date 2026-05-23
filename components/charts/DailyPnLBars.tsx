"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: { date: string; pnl: number; cumulative: number }[];
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { cumulative: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const pnl = payload[0]?.value ?? 0;
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--muted)] mb-1">{label}</p>
      <p className={pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>Day: {formatCurrency(pnl)}</p>
      <p className="text-[var(--muted)]">Cumulative: {formatCurrency(payload[0]?.payload?.cumulative ?? 0)}</p>
    </div>
  );
}

export function DailyPnLBars({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">No data</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false}
          tickFormatter={(v) => v.slice(8)} interval={Math.floor(data.length / 8)} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} width={48}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
        <Tooltip content={<Tip />} />
        <ReferenceLine y={0} stroke="#2a2a32" />
        <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#22c55e" : "#ef4444"} opacity={0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
