"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  data: { setup: string; winRate: number; count: number; pnl: number }[];
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: { setup: string; count: number; pnl: number; winRate: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-medium mb-1">{d?.setup}</p>
      <p className="text-[var(--muted)]">{d?.count} trades</p>
      <p className={d && d.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>${d?.pnl.toFixed(0)}</p>
    </div>
  );
}

export function SetupBars({ data }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">No setup data</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="setup" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} width={88} />
        <Tooltip content={<Tip />} />
        <Bar dataKey="winRate" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.winRate >= 50 ? "#22c55e" : "#ef4444"} opacity={0.8} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
