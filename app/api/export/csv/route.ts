import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const accountId = searchParams.get("accountId");

  const where: Record<string, unknown> = { userId: userId!, status: "CLOSED" };
  if (year) {
    where.entryTime = {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${Number(year) + 1}-01-01`),
    };
  }
  if (accountId) where.accountId = accountId;

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { entryTime: "asc" },
    include: { account: { select: { name: true } } },
  });

  const HEADERS = [
    "Date", "Symbol", "Asset Class", "Side", "Account",
    "Qty", "Entry Price", "Exit Price", "Gross P&L", "Commission", "Net P&L",
    "R-Ratio", "Hold (min)", "Setup", "Timeframe", "Market",
    "Stop Loss", "Take Profit", "Emotion Before", "Emotion After",
    "Mistake Tags", "Setup Tags", "Notes",
  ];

  const rows = trades.map((t) => [
    format(t.entryTime, "yyyy-MM-dd HH:mm"),
    t.symbol,
    t.assetClass,
    t.side,
    t.account.name,
    t.quantity,
    t.entryPrice,
    t.exitPrice ?? "",
    t.grossPnl.toFixed(2),
    t.commission.toFixed(2),
    t.netPnl.toFixed(2),
    t.rRatio?.toFixed(2) ?? "",
    t.holdDuration != null ? Math.round(t.holdDuration / 60) : "",
    t.setupType ?? "",
    t.timeframe ?? "",
    t.marketCondition ?? "",
    t.stopLoss ?? "",
    t.takeProfit ?? "",
    t.emotionBefore ?? "",
    t.emotionAfter ?? "",
    (t.mistakeTags ?? []).join(";"),
    (t.setupTags ?? []).join(";"),
    (t.notes ?? "").replace(/"/g, '""'),
  ]);

  const csv = [HEADERS, ...rows]
    .map((row) => row.map((v) => (String(v).includes(",") || String(v).includes('"') ? `"${v}"` : v)).join(","))
    .join("\n");

  const filename = `edgelog-trades${year ? `-${year}` : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
