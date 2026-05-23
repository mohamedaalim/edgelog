import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

// Returns an HTML page styled for print-to-PDF (no heavy deps, works anywhere)
export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();

  const trades = await prisma.trade.findMany({
    where: {
      userId: userId!,
      status: "CLOSED",
      entryTime: { gte: new Date(`${year}-01-01`), lt: new Date(`${Number(year) + 1}-01-01`) },
    },
    orderBy: { entryTime: "asc" },
  });

  const user = await prisma.user.findUnique({ where: { id: userId! }, select: { name: true, currency: true } });

  const totalPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl < 0);
  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
  const grossWins = winners.reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(losers.reduce((s, t) => s + t.netPnl, 0));
  const pf = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : "∞";
  const commissions = trades.reduce((s, t) => s + t.commission, 0);

  // Monthly breakdown
  const byMonth: Record<string, { pnl: number; trades: number; wins: number }> = {};
  for (const t of trades) {
    const key = format(t.entryTime, "MMM yyyy");
    const cur = byMonth[key] ?? { pnl: 0, trades: 0, wins: 0 };
    byMonth[key] = { pnl: cur.pnl + t.netPnl, trades: cur.trades + 1, wins: cur.wins + (t.netPnl > 0 ? 1 : 0) };
  }

  const fmt = (v: number) => `${v >= 0 ? "" : "-"}$${Math.abs(v).toFixed(2)}`;

  const monthRows = Object.entries(byMonth).map(([month, d]) => `
    <tr>
      <td>${month}</td>
      <td>${d.trades}</td>
      <td style="color:${d.wins > 0 ? "#00c878" : "#ff4646"}">${((d.wins / d.trades) * 100).toFixed(0)}%</td>
      <td style="color:${d.pnl >= 0 ? "#00c878" : "#ff4646"}; font-weight:600">${fmt(d.pnl)}</td>
    </tr>`).join("");

  const tradeRows = trades.slice(0, 200).map((t) => `
    <tr>
      <td>${format(t.entryTime, "MM/dd")}</td>
      <td><strong>${t.symbol}</strong></td>
      <td>${t.side}</td>
      <td>${t.setupType ?? "—"}</td>
      <td>${fmt(t.grossPnl)}</td>
      <td style="color:#888">${fmt(-t.commission)}</td>
      <td style="color:${t.netPnl >= 0 ? "#00c878" : "#ff4646"}; font-weight:600">${fmt(t.netPnl)}</td>
      <td>${t.rRatio != null ? `${t.rRatio >= 0 ? "+" : ""}${t.rRatio.toFixed(2)}R` : "—"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>EdgeLog — ${year} Trade Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat { background: #f5f5f5; border-radius: 8px; padding: 12px; }
  .stat-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
  .stat-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #666; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  h2 { font-size: 14px; font-weight: 600; margin-bottom: 10px; border-bottom: 2px solid #eee; padding-bottom: 6px; }
  .green { color: #00a86b; } .red { color: #e53e3e; }
  .footer { color: #aaa; font-size: 10px; text-align: center; margin-top: 32px; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>EdgeLog — ${year} Trade Report</h1>
<p class="sub">Generated ${format(new Date(), "MMMM d, yyyy")} · ${user?.name ?? "Trader"}</p>

<div class="stats">
  <div class="stat"><div class="stat-label">Net P&L</div><div class="stat-value" style="color:${totalPnl >= 0 ? "#00a86b" : "#e53e3e"}">${fmt(totalPnl)}</div></div>
  <div class="stat"><div class="stat-label">Total Trades</div><div class="stat-value">${trades.length}</div></div>
  <div class="stat"><div class="stat-label">Win Rate</div><div class="stat-value">${winRate.toFixed(1)}%</div></div>
  <div class="stat"><div class="stat-label">Profit Factor</div><div class="stat-value">${pf}</div></div>
  <div class="stat"><div class="stat-label">Commissions</div><div class="stat-value" style="color:#e53e3e">${fmt(-commissions)}</div></div>
</div>

<h2>Monthly Summary</h2>
<table><thead><tr><th>Month</th><th>Trades</th><th>Win Rate</th><th>Net P&L</th></tr></thead>
<tbody>${monthRows}</tbody></table>

<h2>Trade Log${trades.length > 200 ? " (first 200 trades)" : ""}</h2>
<table><thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Setup</th><th>Gross</th><th>Comm.</th><th>Net P&L</th><th>R</th></tr></thead>
<tbody>${tradeRows}</tbody></table>

<p class="footer">EdgeLog Trading Journal · ${trades.length} closed trades in ${year}</p>
<script>window.onload = () => window.print();</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
