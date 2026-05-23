import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const [setupRows, symbolRows] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: userId!, setupType: { not: null } },
      select: { setupType: true },
      distinct: ["setupType"],
    }),
    prisma.trade.findMany({
      where: { userId: userId! },
      select: { symbol: true },
      distinct: ["symbol"],
      orderBy: { symbol: "asc" },
    }),
  ]);

  return NextResponse.json({
    setups: setupRows.map((r) => r.setupType).filter(Boolean),
    symbols: symbolRows.map((r) => r.symbol),
  });
}
