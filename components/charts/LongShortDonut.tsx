"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  longs: { count: number; pnl: number; wins: number };
  shorts: { count: number; pnl: number; wins: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pnl: number; winRate: number; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-medium mb-1">{item?.name}</p>
      <p className="text-[var(--muted)]">Trades: {item?.payload?.count}</p>
      <p className={item?.payload?.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
        P&L: {formatCurrency(item?.payload?.pnl ?? 0)}
      </p>
      <p className="text-[var(--muted)]">Win Rate: {item?.payload?.winRate?.toFixed(0)}%</p>
    </div>
  );
}

export function LongShortDonut({ longs, shorts }: Props) {
  const total = longs.count + shorts.count;
  if (total === 0) return <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">No data</div>;

  const data = [
    {
      name: "Long",
      value: longs.count,
      pnl: longs.pnl,
      winRate: longs.count > 0 ? (longs.wins / longs.count) * 100 : 0,
      count: longs.count,
    },
    {
      name: "Short",
      value: shorts.count,
      pnl: shorts.pnl,
      winRate: shorts.count > 0 ? (shorts.wins / shorts.count) * 100 : 0,
      count: shorts.count,
    },
  ];

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
              <Cell fill="#6366f1" />
              <Cell fill="#f59e0b" />
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: i === 0 ? "#6366f1" : "#f59e0b" }} />
            <div>
              <p className="text-xs font-medium text-white">{d.name}</p>
              <p className="text-xs text-[var(--muted)]">{d.count} trades · {d.winRate.toFixed(0)}% WR</p>
              <p className={`text-xs font-medium ${d.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                {formatCurrency(d.pnl)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
