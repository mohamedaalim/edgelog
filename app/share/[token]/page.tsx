import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

interface Props { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const trade = await prisma.trade.findFirst({
    where: { shareToken: token, isPublic: true },
    select: { symbol: true, netPnl: true, side: true },
  });
  if (!trade) return { title: "Trade Not Found" };
  const pnl = trade.netPnl >= 0 ? `+$${trade.netPnl.toFixed(2)}` : `-$${Math.abs(trade.netPnl).toFixed(2)}`;
  return {
    title: `${trade.symbol} ${trade.side} ${pnl} — EdgeLog`,
    description: "Shared trade from EdgeLog Trading Journal",
  };
}

export default async function SharedTradePage({ params }: Props) {
  const { token } = await params;
  const trade = await prisma.trade.findFirst({
    where: { shareToken: token, isPublic: true },
    include: {
      screenshots: { orderBy: { order: "asc" }, take: 1 },
      user: { select: { name: true } },
    },
  });
  if (!trade) notFound();

  const pnlPos = trade.netPnl >= 0;
  const fmt = (v: number) => `${v >= 0 ? "" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const stats = [
    { label: "Symbol",     value: trade.symbol },
    { label: "Side",       value: trade.side },
    { label: "Asset",      value: trade.assetClass },
    { label: "Qty",        value: trade.quantity.toString() },
    { label: "Entry",      value: `$${trade.entryPrice}` },
    { label: "Exit",       value: trade.exitPrice ? `$${trade.exitPrice}` : "Open" },
    { label: "Gross P&L",  value: fmt(trade.grossPnl) },
    { label: "Commission", value: fmt(-trade.commission) },
    { label: "R-Ratio",    value: trade.rRatio != null ? `${trade.rRatio >= 0 ? "+" : ""}${trade.rRatio.toFixed(2)}R` : "—" },
    { label: "Setup",      value: trade.setupType ?? "—" },
    { label: "Duration",   value: trade.holdDuration ? `${Math.round(trade.holdDuration / 60)}m` : "—" },
    { label: "Date",       value: format(trade.entryTime, "MMM d, yyyy") },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f11] flex flex-col items-center justify-start p-6 py-12">
      {/* Header */}
      <div className="flex items-center gap-2 mb-10">
        <TrendingUp size={20} className="text-[#6c5ce7]" />
        <span className="text-white font-bold text-lg tracking-wide">EdgeLog</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#1a1a22] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* P&L banner */}
        <div className={`px-6 py-5 ${pnlPos ? "bg-[rgba(0,200,120,0.08)] border-b border-[rgba(0,200,120,0.2)]" : "bg-[rgba(255,70,70,0.08)] border-b border-[rgba(255,70,70,0.2)]"}`}>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black" style={{ color: pnlPos ? "var(--green, #00c878)" : "var(--red, #ff4646)" }}>
              {fmt(trade.netPnl)}
            </span>
            <span className="text-[#888] text-sm">net P&L</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-white font-bold text-xl">{trade.symbol}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trade.side === "LONG" ? "bg-[rgba(0,200,120,0.15)] text-[#00c878]" : "bg-[rgba(255,70,70,0.15)] text-[#ff4646]"}`}>
              {trade.side}
            </span>
            {trade.setupType && (
              <span className="text-xs text-[#888] px-2 py-0.5 bg-white/5 rounded-full">{trade.setupType}</span>
            )}
          </div>
          <p className="text-[#888] text-xs mt-1">{format(trade.entryTime, "MMMM d, yyyy")} · {trade.user.name}</p>
        </div>

        {/* Screenshot */}
        {trade.screenshots[0] && (
          <img src={trade.screenshots[0].url} alt="Trade chart" className="w-full h-48 object-cover" />
        )}

        {/* Stats grid */}
        <div className="p-5 grid grid-cols-3 gap-x-4 gap-y-3">
          {stats.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-[#666] uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-white text-sm font-semibold truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {trade.notes && (
          <div className="px-5 pb-4">
            <p className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Notes</p>
            <p className="text-[#aaa] text-sm leading-relaxed">{trade.notes}</p>
          </div>
        )}

        {/* Lessons */}
        {trade.lessonsLearned && (
          <div className="px-5 pb-5">
            <p className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Lessons</p>
            <p className="text-[#aaa] text-sm leading-relaxed">{trade.lessonsLearned}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-[#555] text-xs">Shared via EdgeLog</span>
          <a href="/register" className="text-xs text-[#6c5ce7] hover:underline">Start your journal →</a>
        </div>
      </div>
    </div>
  );
}
